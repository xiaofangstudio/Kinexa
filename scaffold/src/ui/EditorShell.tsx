import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import BrandMark from "./components/BrandMark";
import MenuBar, { type MenuGroup } from "./components/MenuBar";
import Modal from "./components/Modal";
import {
  IconBrush,
  IconBucket,
  IconChevronDown,
  IconChevronUp,
  IconCopy,
  IconEraser,
  IconEye,
  IconEyeOff,
  IconHand,
  IconLayers,
  IconLock,
  IconMoon,
  IconPen,
  IconPlay,
  IconPlus,
  IconRedo,
  IconSave,
  IconShape,
  IconSun,
  IconTrash,
  IconUndo,
  IconUnlock,
} from "./components/Icons";
import CanvasStage, { type StageHandle } from "./CanvasStage";
import { api, regionToDataUrl, type DocInfo, type LayerInfo } from "../core/api";
import { pushRecent } from "../core/recent";
import type { ResolvedTheme, UiSettings } from "../stores/uiSettings";
import {
  DEFAULT_BRUSH,
  type BrushSettings,
  type ToolId,
} from "../core/tools";
import "./EditorShell.css";

interface Props {
  doc: DocInfo;
  onDocChange: (doc: DocInfo) => void;
  onClose: () => void;
  ui: UiSettings;
  theme: ResolvedTheme;
  onUpdateUi: (patch: Partial<UiSettings>) => void;
  onToggleTheme: () => void;
  onResetUi: () => void;
}

const SWATCHES = ["#262420", "#ffffff", "#ffe29a", "#8f8a80"];

function msgOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * 编辑壳（M0）。
 *
 * 布局：顶栏（品牌 / 工程名 / 菜单 / 撤销 / 缩放 / 保存）
 * → 主体三栏（工具轨｜画布｜图层面板 + 画笔面板）→ 时间轴 → 状态栏。
 * 所有像素都在 Rust 侧生成，这里只负责把脏矩形贴到画布上。
 */
export default function EditorShell({
  doc,
  onDocChange,
  onClose,
  ui,
  theme,
  onUpdateUi,
  onToggleTheme,
  onResetUi,
}: Props) {
  const stageRef = useRef<StageHandle>(null);

  const [tool, setTool] = useState<ToolId>("brush");
  const [brush, setBrush] = useState<BrushSettings>(DEFAULT_BRUSH);
  const [zoom, setZoom] = useState(1);
  const [dirty, setDirty] = useState(false);
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [modal, setModal] = useState<"about" | "shortcuts" | "settings" | null>(null);
  const [onion, setOnion] = useState(false);
  const [editingLayer, setEditingLayer] = useState<number | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [opacityDraft, setOpacityDraft] = useState<number | null>(null);
  const opacityTimer = useRef<number | null>(null);

  const activeLayer = doc.layers.find((l) => l.id === doc.activeLayerId) ?? null;

  const fail = useCallback((prefix: string, e: unknown) => {
    setError(`${prefix}：${msgOf(e)}`);
  }, []);

  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(() => setError(null), 6000);
    return () => window.clearTimeout(t);
  }, [error]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    setOpacityDraft(null);
  }, [doc.activeLayerId]);

  /** 统一收口：更新工程信息、按需重读画面、刷新缩略图。 */
  const runDoc = useCallback(
    async (work: Promise<DocInfo>, opts?: { refresh?: boolean; toast?: string }) => {
      try {
        const info = await work;
        onDocChange(info);
        if (opts?.refresh !== false) void stageRef.current?.refresh();
        setRevision((n) => n + 1);
        if (opts?.toast) setToast(opts.toast);
      } catch (e) {
        fail("操作失败", e);
      }
    },
    [fail, onDocChange],
  );

  // 图层缩略图：每次工程信息或笔迹版本变化后重取。
  useEffect(() => {
    let alive = true;
    void (async () => {
      const map: Record<number, string> = {};
      for (const l of doc.layers) {
        try {
          const region = await api.layerThumb(l.id, 44);
          const url = regionToDataUrl(region);
          if (url) map[l.id] = url;
        } catch {
          /* 单层缩略图失败不影响其它层 */
        }
      }
      if (alive) setThumbs(map);
    })();
    return () => {
      alive = false;
    };
  }, [doc.layers, doc.currentFrame, revision]);

  const onStrokeEnd = useCallback(() => {
    setDirty(true);
    setRevision((n) => n + 1);
  }, []);

  const onZoomChange = useCallback((z: number) => setZoom(z), []);
  const onStageError = useCallback((m: string) => setError(m), []);

  const undo = useCallback(async () => {
    try {
      const region = await api.undo();
      stageRef.current?.apply(region);
      setRevision((n) => n + 1);
      setDirty(true);
    } catch (e) {
      fail("撤销失败", e);
    }
  }, [fail]);

  const redo = useCallback(async () => {
    try {
      const region = await api.redo();
      stageRef.current?.apply(region);
      setRevision((n) => n + 1);
      setDirty(true);
    } catch (e) {
      fail("重做失败", e);
    }
  }, [fail]);

  const saveProject = useCallback(
    async (forceDialog: boolean) => {
      let path = doc.path;
      if (forceDialog || !path) {
        try {
          const picked = await save({
            title: "保存 Kinexa 工程",
            defaultPath: `${doc.name}.kin`,
            filters: [{ name: "Kinexa 动画工程", extensions: ["kin"] }],
          });
          if (typeof picked !== "string" || !picked) return;
          path = picked;
        } catch (e) {
          fail("保存失败", e);
          return;
        }
      }
      try {
        const info = await api.saveProject(path);
        onDocChange(info);
        pushRecent(info);
        setDirty(false);
        setToast("已保存到磁盘");
      } catch (e) {
        fail("保存失败", e);
      }
    },
    [doc.name, doc.path, fail, onDocChange],
  );

  const openAnother = useCallback(async () => {
    try {
      const picked = await open({
        title: "打开 Kinexa 工程",
        multiple: false,
        directory: false,
        filters: [{ name: "Kinexa 动画工程", extensions: ["kin"] }],
      });
      if (typeof picked !== "string") return;
      const info = await api.openProject(picked);
      pushRecent(info);
      onDocChange(info);
      setDirty(false);
      setToast("已打开工程");
      window.setTimeout(() => {
        void stageRef.current?.refresh();
        stageRef.current?.fit();
      }, 80);
    } catch (e) {
      fail("打开失败", e);
    }
  }, [fail, onDocChange]);

  const closeProject = useCallback(() => {
    if (dirty && !window.confirm("工程还有改动没保存，确定关闭吗？")) return;
    onClose();
  }, [dirty, onClose]);

  const quitApp = useCallback(() => {
    void api.exitApp().catch(() => fail("退出失败", "直接关窗口即可"));
  }, [fail]);

  const addLayer = useCallback(() => {
    void runDoc(api.addLayer(""), { refresh: false, toast: "已新建图层" });
  }, [runDoc]);

  const deleteLayer = useCallback(() => {
    if (!activeLayer) return;
    if (doc.layers.length <= 1) {
      setToast("至少要保留一个图层");
      return;
    }
    void runDoc(api.deleteLayer(activeLayer.id));
  }, [activeLayer, doc.layers.length, runDoc]);

  const moveLayer = useCallback(
    (dir: number) => {
      if (!activeLayer) return;
      void runDoc(api.moveLayer(activeLayer.id, dir), { refresh: true });
    },
    [activeLayer, runDoc],
  );

  const selectLayer = useCallback(
    (layer: LayerInfo) => {
      void runDoc(api.setActiveLayer(layer.id), { refresh: false });
    },
    [runDoc],
  );

  const toggleVisible = useCallback(
    (layer: LayerInfo) => {
      void runDoc(api.setLayerVisible(layer.id, !layer.visible));
    },
    [runDoc],
  );

  const toggleLocked = useCallback(
    (layer: LayerInfo) => {
      void runDoc(api.setLayerLocked(layer.id, !layer.locked), { refresh: false });
    },
    [runDoc],
  );

  const commitRename = useCallback(
    (layer: LayerInfo) => {
      const name = nameDraft.trim();
      setEditingLayer(null);
      if (name && name !== layer.name) {
        void runDoc(api.renameLayer(layer.id, name), { refresh: false });
      }
    },
    [nameDraft, runDoc],
  );

  const setOpacity = useCallback(
    (value: number) => {
      if (!activeLayer) return;
      setOpacityDraft(value);
      if (opacityTimer.current) window.clearTimeout(opacityTimer.current);
      opacityTimer.current = window.setTimeout(() => {
        void runDoc(api.setLayerOpacity(activeLayer.id, value / 100), {
          refresh: true,
        });
        setOpacityDraft(null);
      }, 180);
    },
    [activeLayer, runDoc],
  );

  useEffect(() => {
    return () => {
      if (opacityTimer.current) window.clearTimeout(opacityTimer.current);
    };
  }, []);

  const selectFrame = useCallback(
    (index: number) => {
      if (index === doc.currentFrame) return;
      void runDoc(api.setFrame(index), { refresh: true });
    },
    [doc.currentFrame, runDoc],
  );

  const addFrame = useCallback(
    (duplicate: boolean) => {
      void runDoc(api.addFrame(duplicate), {
        toast: duplicate ? "已复制当前画格" : "已新建空白画格",
      });
    },
    [runDoc],
  );

  /** 洋葱皮：前一格红、后一格蓝，由 Rust 侧合成，开关后整幅重读。 */
  const toggleOnion = useCallback(async () => {
    const next = !onion;
    try {
      const info = await api.setOnion(next);
      onDocChange(info);
      setOnion(next);
      void stageRef.current?.refresh();
      setToast(next ? "洋葱皮已打开" : "洋葱皮已关闭");
    } catch (e) {
      fail("切换洋葱皮失败", e);
    }
  }, [fail, onDocChange, onion]);

  const menuGroups = useMemo<MenuGroup[]>(() => {
    return [
      {
        label: "文件",
        items: [
          { label: "保存", shortcut: "Ctrl+S", onSelect: () => void saveProject(false) },
          { label: "另存为…", shortcut: "Ctrl+Shift+S", onSelect: () => void saveProject(true) },
          { separator: true },
          { label: "打开工程…", shortcut: "Ctrl+O", onSelect: () => void openAnother() },
          { label: "新建工程…", shortcut: "Ctrl+N", onSelect: closeProject },
          { separator: true },
          { label: "关闭工程", onSelect: closeProject },
          { label: "退出 Kinexa", onSelect: quitApp },
        ],
      },
      {
        label: "编辑",
        items: [
          { label: "撤销", shortcut: "Ctrl+Z", onSelect: () => void undo() },
          { label: "重做", shortcut: "Ctrl+Shift+Z", onSelect: () => void redo() },
        ],
      },
      {
        label: "视图",
        items: [
          { label: "放大", shortcut: "Ctrl+ =", onSelect: () => stageRef.current?.zoomBy(1.25) },
          { label: "缩小", shortcut: "Ctrl+ -", onSelect: () => stageRef.current?.zoomBy(0.8) },
          { label: "适应窗口", shortcut: "Ctrl+0", onSelect: () => stageRef.current?.fit() },
          { separator: true },
          {
            label: theme === "light" ? "切换到深色" : "切换到浅色",
            onSelect: onToggleTheme,
          },
          {
            label: ui.density === "compact" ? "切换舒适密度" : "切换紧凑密度",
            onSelect: () =>
              onUpdateUi({ density: ui.density === "compact" ? "comfortable" : "compact" }),
          },
          { label: "界面设置…", onSelect: () => setModal("settings") },
        ],
      },
      {
        label: "帮助",
        items: [
          { label: "快捷键", onSelect: () => setModal("shortcuts") },
          { label: "关于 Kinexa", onSelect: () => setModal("about") },
        ],
      },
    ];
  }, [
    closeProject,
    openAnother,
    quitApp,
    redo,
    saveProject,
    undo,
    theme,
    ui.density,
    onUpdateUi,
    onToggleTheme,
  ]);

  // 键盘：桌面软件的手感靠这一层，常用动作不允许只能点菜单。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || t?.isContentEditable) return;

      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === "s") {
          e.preventDefault();
          void saveProject(e.shiftKey);
        } else if (key === "z") {
          e.preventDefault();
          if (e.shiftKey) void redo();
          else void undo();
        } else if (key === "y") {
          e.preventDefault();
          void redo();
        } else if (key === "o") {
          e.preventDefault();
          void openAnother();
        } else if (key === "n") {
          e.preventDefault();
          closeProject();
        } else if (key === "0") {
          e.preventDefault();
          stageRef.current?.fit();
        } else if (key === "=" || key === "+") {
          e.preventDefault();
          stageRef.current?.zoomBy(1.25);
        } else if (key === "-") {
          e.preventDefault();
          stageRef.current?.zoomBy(0.8);
        }
        return;
      }

      const key = e.key.toLowerCase();
      if (key === "b") setTool("brush");
      else if (key === "e") setTool("eraser");
      else if (key === "h") setTool("hand");
      else if (key === "[") setBrush((b) => ({ ...b, size: Math.max(1, b.size - Math.max(1, b.size * 0.15)) }));
      else if (key === "]") setBrush((b) => ({ ...b, size: Math.min(200, b.size + Math.max(1, b.size * 0.15)) }));
      else if (e.key === "Escape") stageRef.current?.cancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeProject, openAnother, redo, saveProject, undo]);

  const layersTopFirst = [...doc.layers].reverse();
  const opacityValue =
    opacityDraft ?? Math.round((activeLayer?.opacity ?? 1) * 100);

  const hint =
    tool === "brush"
      ? "画笔 · 左键绘制，空格拖动画布，滚轮缩放"
      : tool === "eraser"
        ? "橡皮 · 左键擦除，只擦当前图层"
        : "抓手 · 拖动平移画布";

  return (
    <div className="kx-editor">
      <header className="kx-editor-top">
        <BrandMark size={22} />
        <div className="kx-doc-title">
          <span className="kx-doc-name">{doc.name}</span>
          {dirty && <span className="kx-dirty-dot" title="有未保存的改动" />}
        </div>
        <MenuBar groups={menuGroups} />
        <span className="kx-top-gap" />
        <div className="kx-top-actions">
          <button className="kx-icon-btn" onClick={() => void undo()} title="撤销 (Ctrl+Z)">
            <IconUndo size={17} />
          </button>
          <button className="kx-icon-btn" onClick={() => void redo()} title="重做 (Ctrl+Shift+Z)">
            <IconRedo size={17} />
          </button>
          <span className="kx-top-divider" />
          <button
            className="kx-icon-btn"
            onClick={() => stageRef.current?.zoomBy(0.8)}
            title="缩小"
          >
            <span className="kx-zoom-glyph">−</span>
          </button>
          <span className="kx-zoom-label">{Math.round(zoom * 100)}%</span>
          <button
            className="kx-icon-btn"
            onClick={() => stageRef.current?.zoomBy(1.25)}
            title="放大"
          >
            <span className="kx-zoom-glyph">＋</span>
          </button>
          <button
            className="kx-btn-ghost kx-zoom-fit"
            onClick={() => stageRef.current?.fit()}
            title="适应窗口 (Ctrl+0)"
          >
            适应
          </button>
          <span className="kx-top-divider" />
          <button
            className="kx-icon-btn"
            onClick={onToggleTheme}
            title={theme === "light" ? "切换到深色" : "切换到浅色"}
          >
            {theme === "light" ? <IconMoon size={17} /> : <IconSun size={17} />}
          </button>
          <button
            className="kx-btn-primary kx-btn-sm"
            onClick={() => void saveProject(false)}
          >
            <IconSave size={15} />
            保存
          </button>
        </div>
      </header>

      <div className="kx-editor-main">
        <aside className="kx-toolrail">
          <span className="kx-rail-cap">工具</span>
          {(
            [
              { id: "brush", label: "画笔", key: "B", icon: IconBrush },
              { id: "eraser", label: "橡皮", key: "E", icon: IconEraser },
              { id: "hand", label: "抓手", key: "H", icon: IconHand },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                className={tool === t.id ? "kx-tool is-on" : "kx-tool"}
                onClick={() => setTool(t.id)}
              >
                <Icon size={18} />
                <span className="kx-tool-label">{t.label}</span>
                <span className="kx-tool-key">{t.key}</span>
              </button>
            );
          })}

          {ui.showFuture && (
            <>
              <div className="kx-rail-sep" />
              <span className="kx-rail-cap">后续开放</span>
              {[
                { label: "钢笔", icon: IconPen },
                { label: "形状", icon: IconShape },
                { label: "填充", icon: IconBucket },
              ].map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.label}
                    className="kx-tool is-off"
                    disabled
                    title={`${t.label}工具将在后续版本开放`}
                  >
                    <Icon size={18} />
                    <span className="kx-tool-label">{t.label}</span>
                    <span className="kx-tool-tag">后续</span>
                  </button>
                );
              })}
            </>
          )}

          <span className="kx-rail-spacer" />
          <div className="kx-swatches">
            <span className="kx-swatch-label">前景</span>
            <span className="kx-swatch" style={{ background: brush.color }} />
          </div>
        </aside>

        <div className="kx-center">
          <CanvasStage
            ref={stageRef}
            doc={doc}
            tool={tool}
            brush={brush}
            onZoomChange={onZoomChange}
            onStrokeEnd={onStrokeEnd}
            onError={onStageError}
          />
        </div>

        <aside className="kx-dock">
          <section className="kx-panel kx-panel-layers">
            <header className="kx-panel-head">
              <IconLayers size={16} />
              <h2 className="kx-panel-title">图层</h2>
              <span className="kx-panel-count">{doc.layers.length}</span>
              <span className="kx-gap" />
              <button className="kx-icon-btn" onClick={addLayer} title="新建图层">
                <IconPlus size={15} />
              </button>
            </header>

            <ul className="kx-layer-list">
              {layersTopFirst.map((layer) => (
                <li
                  key={layer.id}
                  className={
                    layer.id === doc.activeLayerId ? "kx-layer is-on" : "kx-layer"
                  }
                  onClick={() => selectLayer(layer)}
                >
                  <span className="kx-layer-thumb">
                    {thumbs[layer.id] ? (
                      <img src={thumbs[layer.id]} alt="" />
                    ) : (
                      <span className="kx-layer-thumb-empty" />
                    )}
                  </span>
                  {editingLayer === layer.id ? (
                    <input
                      className="kx-layer-rename"
                      autoFocus
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      onBlur={() => commitRename(layer)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename(layer);
                        if (e.key === "Escape") setEditingLayer(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span
                      className="kx-layer-name"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingLayer(layer.id);
                        setNameDraft(layer.name);
                      }}
                      title="双击重命名"
                    >
                      {layer.name}
                    </span>
                  )}
                  <button
                    className="kx-layer-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleVisible(layer);
                    }}
                    title={layer.visible ? "隐藏图层" : "显示图层"}
                  >
                    {layer.visible ? <IconEye size={15} /> : <IconEyeOff size={15} />}
                  </button>
                  <button
                    className={layer.locked ? "kx-layer-btn is-locked" : "kx-layer-btn"}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLocked(layer);
                    }}
                    title={layer.locked ? "解锁图层" : "锁定图层"}
                  >
                    {layer.locked ? <IconUnlock size={15} /> : <IconLock size={15} />}
                  </button>
                </li>
              ))}
            </ul>

            <div className="kx-layer-foot">
              <button
                className="kx-icon-btn"
                onClick={() => moveLayer(1)}
                title="上移一层"
              >
                <IconChevronUp size={15} />
              </button>
              <button
                className="kx-icon-btn"
                onClick={() => moveLayer(-1)}
                title="下移一层"
              >
                <IconChevronDown size={15} />
              </button>
              <span className="kx-gap" />
              <button
                className="kx-icon-btn"
                onClick={deleteLayer}
                title="删除当前图层"
                disabled={doc.layers.length <= 1}
              >
                <IconTrash size={15} />
              </button>
            </div>

            <div className="kx-layer-opacity">
              <span className="kx-opacity-label">不透明度</span>
              <input
                type="range"
                min={0}
                max={100}
                value={opacityValue}
                disabled={!activeLayer}
                onChange={(e) => setOpacity(Number(e.target.value))}
              />
              <span className="kx-opacity-value">{opacityValue}%</span>
            </div>
          </section>

          <section className="kx-panel kx-panel-brush">
            <header className="kx-panel-head">
              {tool === "eraser" ? <IconEraser size={16} /> : <IconBrush size={16} />}
              <h2 className="kx-panel-title">{tool === "eraser" ? "橡皮" : "画笔"}</h2>
              <span className="kx-gap" />
              <span className="kx-panel-note">Rust 光栅化</span>
            </header>

            <div className="kx-brush-body">
              <div className="kx-slider-row">
                <span className="kx-slider-label">直径</span>
                <span className="kx-slider-value">{Math.round(brush.size)} px</span>
              </div>
              <input
                type="range"
                min={1}
                max={200}
                value={brush.size}
                onChange={(e) =>
                  setBrush((b) => ({ ...b, size: Number(e.target.value) }))
                }
              />

              <div className="kx-slider-row">
                <span className="kx-slider-label">硬度</span>
                <span className="kx-slider-value">
                  {Math.round(brush.hardness * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(brush.hardness * 100)}
                disabled={tool === "eraser"}
                onChange={(e) =>
                  setBrush((b) => ({ ...b, hardness: Number(e.target.value) / 100 }))
                }
              />

              <div className="kx-slider-row">
                <span className="kx-slider-label">不透明度</span>
                <span className="kx-slider-value">
                  {Math.round(brush.opacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={100}
                value={Math.round(brush.opacity * 100)}
                onChange={(e) =>
                  setBrush((b) => ({ ...b, opacity: Number(e.target.value) / 100 }))
                }
              />

              {tool !== "eraser" && (
                <>
                  <div className="kx-slider-row">
                    <span className="kx-slider-label">颜色</span>
                    <span className="kx-slider-value">{brush.color}</span>
                  </div>
                  <div className="kx-color-row">
                    {SWATCHES.map((c) => (
                      <button
                        key={c}
                        className={
                          brush.color.toLowerCase() === c
                            ? "kx-color is-on"
                            : "kx-color"
                        }
                        style={{ background: c }}
                        onClick={() => setBrush((b) => ({ ...b, color: c }))}
                        title={c}
                        aria-label={`颜色 ${c}`}
                      />
                    ))}
                    <label className="kx-color-custom" title="自定义颜色">
                      <input
                        type="color"
                        value={brush.color}
                        onChange={(e) =>
                          setBrush((b) => ({ ...b, color: e.target.value }))
                        }
                      />
                      <span>自定义</span>
                    </label>
                  </div>
                </>
              )}

              {tool === "eraser" && (
                <p className="kx-brush-note">橡皮只擦当前图层，不产生颜色。</p>
              )}
            </div>
          </section>
        </aside>
      </div>

      <footer className="kx-timeline">
        <div className="kx-timeline-head">
          <span className="kx-timeline-title">时间轴</span>
          <span className="kx-timeline-meta">
            {doc.fps} fps · {doc.frameCount} 格
          </span>
          <span className="kx-gap" />
          <button
            className="kx-btn-ghost kx-tl-btn"
            onClick={() => addFrame(false)}
            title="在当前画格后新建空白画格"
          >
            <IconPlus size={14} />
            新建画格
          </button>
          <button
            className="kx-btn-ghost kx-tl-btn"
            onClick={() => addFrame(true)}
            title="复制当前画格"
          >
            <IconCopy size={14} />
            复制
          </button>
          <button
            className={onion ? "kx-btn-ghost kx-tl-btn is-on" : "kx-btn-ghost kx-tl-btn"}
            onClick={() => void toggleOnion()}
            title="显示前一画格（红）与后一画格（蓝）的叠影"
          >
            <IconLayers size={14} />
            洋葱皮
          </button>
          <button
            className="kx-tl-play"
            disabled
            title="播放与洋葱皮将在后续版本开放"
          >
            <IconPlay size={14} />
          </button>
        </div>

        <div className="kx-timeline-body">
          <div className="kx-timeline-label">
            <span>画格</span>
            <span className="kx-timeline-label-sub">1 层 · 当前第 {doc.currentFrame + 1} 格</span>
          </div>
          <div className="kx-frames">
            {Array.from({ length: doc.frameCount }, (_, i) => (
              <button
                key={i}
                className={i === doc.currentFrame ? "kx-frame is-on" : "kx-frame"}
                onClick={() => selectFrame(i)}
                title={`第 ${i + 1} 格`}
              >
                {i + 1}
              </button>
            ))}
            <button
              className="kx-frame kx-frame-add"
              onClick={() => addFrame(false)}
              title="新建画格"
            >
              <IconPlus size={13} />
            </button>
          </div>
        </div>
      </footer>

      <footer className="kx-statusbar">
        <span className="kx-status-hint">{hint}</span>
        <span className="kx-gap" />
        <span className="kx-status-item">
          {doc.width} × {doc.height}
        </span>
        <span className="kx-status-item">{doc.fps} fps</span>
        <span className="kx-status-item">
          画格 {doc.currentFrame + 1}/{doc.frameCount}
        </span>
        <span className="kx-status-item">{Math.round(zoom * 100)}%</span>
      </footer>

      {error && (
        <div className="kx-errorbar" role="alert">
          <span>{error}</span>
          <button
            className="kx-errorbar-close"
            onClick={() => setError(null)}
            aria-label="关闭"
          >
            ×
          </button>
        </div>
      )}

      {toast && <div className="kx-toast">{toast}</div>}

      {modal === "about" && (
        <Modal title="关于 Kinexa" onClose={() => setModal(null)} width={470}>
          <div className="kx-about-row">
            <BrandMark size={42} />
            <div>
              <p className="kx-about-name">Kinexa</p>
              <p className="kx-about-ver">M0 · 二维动画与矢量动画软件</p>
            </div>
          </div>
          <p className="kx-about-copy">
            全中文界面，MIT 许可，永久免费。不带 AI、不设账号、不联网、不自动更新。
          </p>
          <p className="kx-about-copy">小方工作室出品。</p>
        </Modal>
      )}

      {modal === "shortcuts" && (
        <Modal title="快捷键" onClose={() => setModal(null)} width={470}>
          <div className="kx-keys">
            {[
              ["Ctrl + S", "保存"],
              ["Ctrl + Shift + S", "另存为"],
              ["Ctrl + Z", "撤销"],
              ["Ctrl + Shift + Z", "重做"],
              ["B / E / H", "画笔 / 橡皮 / 抓手"],
              ["[ / ]", "缩小 / 放大笔尖"],
              ["Space 拖动", "移动画布"],
              ["Ctrl + 0", "适应窗口"],
              ["滚轮", "缩放画布"],
              ["Esc", "取消当前笔迹"],
            ].map(([key, label]) => (
              <div className="kx-key-row" key={key}>
                <span className="kx-key-label">{label}</span>
                <span className="kx-key-cap">{key}</span>
              </div>
            ))}
          </div>
        </Modal>
      )}
      {modal === "settings" && (
        <Modal title="界面设置" onClose={() => setModal(null)} width={540}>
          <div className="kx-set-list">
            <div className="kx-set-row">
              <div className="kx-set-copy">
                <p className="kx-set-title">主题</p>
                <p className="kx-set-note">默认浅色；深色适合夜间，跟随系统会自动切换。</p>
              </div>
              <div className="kx-seg">
                {(
                  [
                    { id: "light", label: "浅色" },
                    { id: "dark", label: "深色" },
                    { id: "system", label: "跟随系统" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    className={ui.theme === t.id ? "kx-seg-btn is-on" : "kx-seg-btn"}
                    onClick={() => onUpdateUi({ theme: t.id })}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="kx-set-row">
              <div className="kx-set-copy">
                <p className="kx-set-title">界面密度</p>
                <p className="kx-set-note">紧凑模式会收紧顶栏、工具栏与控件高度。</p>
              </div>
              <div className="kx-seg">
                {(
                  [
                    { id: "comfortable", label: "舒适" },
                    { id: "compact", label: "紧凑" },
                  ] as const
                ).map((d) => (
                  <button
                    key={d.id}
                    className={ui.density === d.id ? "kx-seg-btn is-on" : "kx-seg-btn"}
                    onClick={() => onUpdateUi({ density: d.id })}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="kx-set-row">
              <div className="kx-set-copy">
                <p className="kx-set-title">轻磨砂</p>
                <p className="kx-set-note">面板半透明并带背景模糊；低配机器可关掉换取更稳的帧率。</p>
              </div>
              <div className="kx-seg">
                {(
                  [
                    { id: true, label: "开启" },
                    { id: false, label: "关闭" },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.label}
                    className={ui.frosted === f.id ? "kx-seg-btn is-on" : "kx-seg-btn"}
                    onClick={() => onUpdateUi({ frosted: f.id })}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="kx-set-row">
              <div className="kx-set-copy">
                <p className="kx-set-title">后续工具</p>
                <p className="kx-set-note">钢笔、形状、填充尚未开放；收起后工具轨只留当前能用的三项。</p>
              </div>
              <div className="kx-seg">
                {(
                  [
                    { id: false, label: "收起" },
                    { id: true, label: "显示" },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.label}
                    className={ui.showFuture === s.id ? "kx-seg-btn is-on" : "kx-seg-btn"}
                    onClick={() => onUpdateUi({ showFuture: s.id })}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="kx-set-foot">
            <button
              className="kx-btn-ghost kx-btn-sm"
              onClick={() => {
                onResetUi();
                setToast("界面偏好已恢复默认");
              }}
            >
              恢复默认
            </button>
            <span className="kx-set-note">偏好只保存在这台电脑，不上传。</span>
          </div>
        </Modal>
      )}
    </div>
  );
}
