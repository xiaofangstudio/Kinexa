import { useCallback, useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import BrandMark from "./components/BrandMark";
import MenuBar, { type MenuGroup } from "./components/MenuBar";
import Modal from "./components/Modal";
import {
  IconClose,
  IconFilm,
  IconMoon,
  IconPlus,
  IconSun,
} from "./components/Icons";
import { api, type AppInfo, type DocInfo } from "../core/api";
import {
  FPS_OPTIONS,
  MAX_SIDE,
  MIN_SIDE,
  PRESETS,
  defaultProjectName,
} from "../core/presets";
import {
  clearRecent,
  loadRecent,
  patchRecent,
  pushRecent,
  removeRecent,
  type RecentEntry,
} from "../core/recent";
import type { ResolvedTheme } from "../stores/uiSettings";
import "./StartPage.css";

interface Props {
  themeMode: ResolvedTheme;
  onToggleTheme: () => void;
  onOpenDoc: (doc: DocInfo) => void;
}

const PREVIEW_W = 248;
const PREVIEW_H = 156;

function msgOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * 欢迎页：启动后的第一屏。
 *
 * 结构对齐 Strata：顶部品牌与菜单，主体「新建动画工程 / 最近工程」两张卡，
 * 下方一条「打开已有工程」，底部工具入口。
 * 新建即进编辑壳，打开工程也直接进编辑壳，不额外弹窗。
 */
export default function StartPage({
  themeMode,
  onToggleTheme,
  onOpenDoc,
}: Props) {
  const [width, setWidth] = useState("1920");
  const [height, setHeight] = useState("1080");
  const [fps, setFps] = useState(24);
  const [transparent, setTransparent] = useState(false);
  const [recent, setRecent] = useState<RecentEntry[]>(() => loadRecent());
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<"about" | "shortcuts" | null>(null);
  const [info, setInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .appInfo()
      .then((it) => {
        if (alive) setInfo(it);
      })
      .catch(() => {
        /* 浏览器预览里拿不到，关于弹窗退回静态文案 */
      });
    return () => {
      alive = false;
    };
  }, []);

  // 启动时核对最近工程是否还在原位；丢了的标灰，不静默消失。
  useEffect(() => {
    let alive = true;
    const snapshot = recent;
    void (async () => {
      for (const it of snapshot) {
        try {
          const exists = await api.fileExists(it.path);
          if (!alive) return;
          if (!exists && !it.missing) {
            patchRecent(it.path, { missing: true });
            setRecent((list) =>
              list.map((x) => (x.path === it.path ? { ...x, missing: true } : x)),
            );
          }
        } catch {
          return;
        }
      }
    })();
    return () => {
      alive = false;
    };
    // 只在挂载时跑一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createProject = useCallback(async () => {
    const w = Number.parseInt(width, 10);
    const h = Number.parseInt(height, 10);
    if (!Number.isFinite(w) || !Number.isFinite(h)) {
      setError("请输入有效的宽高");
      return;
    }
    if (w < MIN_SIDE || h < MIN_SIDE || w > MAX_SIDE || h > MAX_SIDE) {
      setError(`宽高需在 ${MIN_SIDE} ~ ${MAX_SIDE} 之间`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const doc = await api.newProject({
        width: w,
        height: h,
        fps,
        name: defaultProjectName(),
        transparent,
      });
      onOpenDoc(doc);
    } catch (e) {
      setError(`新建失败：${msgOf(e)}`);
    } finally {
      setBusy(false);
    }
  }, [fps, height, onOpenDoc, transparent, width]);

  const openPath = useCallback(
    async (path: string) => {
      setBusy(true);
      setOpening(path);
      setError(null);
      try {
        const doc = await api.openProject(path);
        pushRecent(doc);
        setRecent(loadRecent());
        onOpenDoc(doc);
      } catch (e) {
        setError(`打开失败：${msgOf(e)}`);
      } finally {
        setBusy(false);
        setOpening(null);
      }
    },
    [onOpenDoc],
  );

  const pickFile = useCallback(async () => {
    try {
      const picked = await open({
        title: "打开 Kinexa 工程",
        multiple: false,
        directory: false,
        filters: [{ name: "Kinexa 动画工程", extensions: ["kin"] }],
      });
      if (typeof picked === "string") await openPath(picked);
    } catch (e) {
      setError(`打开失败：${msgOf(e)}`);
    }
  }, [openPath]);

  const quit = useCallback(() => {
    void api.exitApp().catch(() => setError("退出失败，直接关窗口即可"));
  }, []);

  const menuGroups = useMemo<MenuGroup[]>(() => {
    return [
      {
        label: "文件",
        items: [
          { label: "新建动画工程", shortcut: "Ctrl+N", onSelect: () => void createProject() },
          { label: "打开工程…", shortcut: "Ctrl+O", onSelect: () => void pickFile() },
          { separator: true },
          { label: "退出", onSelect: quit },
        ],
      },
      {
        label: "编辑",
        items: [
          { label: "撤销", shortcut: "Ctrl+Z", disabled: true },
          { label: "重做", shortcut: "Ctrl+Shift+Z", disabled: true },
        ],
      },
      {
        label: "视图",
        items: [
          {
            label: themeMode === "light" ? "切换到深色" : "切换到浅色",
            onSelect: onToggleTheme,
          },
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
  }, [createProject, onToggleTheme, pickFile, quit, themeMode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "n") {
        e.preventDefault();
        void createProject();
      } else if (key === "o") {
        e.preventDefault();
        void pickFile();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [createProject, pickFile]);

  const preview = useMemo(() => {
    const w = Number.parseInt(width, 10);
    const h = Number.parseInt(height, 10);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1) return null;
    const s = Math.min(PREVIEW_W / w, PREVIEW_H / h);
    return {
      w: Math.max(10, Math.round(w * s)),
      h: Math.max(10, Math.round(h * s)),
      label: `${w} × ${h}`,
      mp: `${((w * h) / 1_000_000).toFixed(1)} 百万像素`,
    };
  }, [height, width]);

  return (
    <div className="kx-start">
      <header className="kx-start-top">
        <div className="kx-start-brand">
          <BrandMark size={28} />
          <span className="kx-start-name">Kinexa</span>
          <span className="kx-start-tag">二维动画 · 逐帧与矢量</span>
        </div>
        <MenuBar groups={menuGroups} />
        <span className="kx-start-gap" />
        <button
          className="kx-btn-ghost"
          onClick={onToggleTheme}
          title={themeMode === "light" ? "切换到深色" : "切换到浅色"}
        >
          {themeMode === "light" ? <IconMoon size={16} /> : <IconSun size={16} />}
          {themeMode === "light" ? "深色" : "浅色"}
        </button>
      </header>

      <main className="kx-start-main">
        {/* ---------- 新建 ---------- */}
        <section className="kx-card kx-card-new">
          <div className="kx-card-head">
            <h2 className="kx-card-title">新建动画工程</h2>
            <span className="kx-card-note">先定画幅与帧率，再动手</span>
          </div>

          <div className="kx-presets">
            {PRESETS.map((p) => {
              const on = width === String(p.w) && height === String(p.h);
              return (
                <button
                  key={p.key}
                  className={on ? "kx-preset is-on" : "kx-preset"}
                  onClick={() => {
                    setWidth(String(p.w));
                    setHeight(String(p.h));
                    setFps(p.fps);
                  }}
                >
                  <span className="kx-preset-label">{p.label}</span>
                  <span className="kx-preset-note">{p.note}</span>
                </button>
              );
            })}
          </div>

          <div className="kx-canvas-body">
            <div className="kx-form">
              <div className="kx-field-row">
                <label className="kx-field">
                  <span className="kx-field-label">宽度</span>
                  <span className="kx-field-box">
                    <input
                      className="kx-field-input"
                      type="number"
                      min={MIN_SIDE}
                      max={MAX_SIDE}
                      value={width}
                      onChange={(e) => setWidth(e.target.value)}
                    />
                    <span className="kx-field-unit">px</span>
                  </span>
                </label>
                <span className="kx-field-x">×</span>
                <label className="kx-field">
                  <span className="kx-field-label">高度</span>
                  <span className="kx-field-box">
                    <input
                      className="kx-field-input"
                      type="number"
                      min={MIN_SIDE}
                      max={MAX_SIDE}
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                    />
                    <span className="kx-field-unit">px</span>
                  </span>
                </label>
              </div>

              <div className="kx-field">
                <span className="kx-field-label">帧率</span>
                <div className="kx-segmented">
                  {FPS_OPTIONS.map((f) => (
                    <button
                      key={f}
                      className={fps === f ? "kx-seg is-on" : "kx-seg"}
                      onClick={() => setFps(f)}
                    >
                      {f} fps
                    </button>
                  ))}
                </div>
              </div>

              <div className="kx-field">
                <span className="kx-field-label">底色</span>
                <div className="kx-segmented">
                  <button
                    className={transparent ? "kx-seg" : "kx-seg is-on"}
                    onClick={() => setTransparent(false)}
                  >
                    白纸
                  </button>
                  <button
                    className={transparent ? "kx-seg is-on" : "kx-seg"}
                    onClick={() => setTransparent(true)}
                  >
                    透明
                  </button>
                </div>
              </div>
            </div>

            <figure className="kx-preview">
              <div className="kx-preview-stage">
                {preview && (
                  <span
                    className={
                      transparent ? "kx-preview-rect is-checker" : "kx-preview-rect"
                    }
                    style={{ width: preview.w, height: preview.h }}
                  >
                    <span className="kx-preview-safe" />
                  </span>
                )}
              </div>
              <figcaption className="kx-preview-meta">
                {preview ? `${preview.label} · ${preview.mp}` : "等待有效尺寸"}
              </figcaption>
            </figure>
          </div>

          <div className="kx-start-tips">
            <span className="kx-tips-title">上手速记</span>
            <span className="kx-tip"><kbd>B</kbd>画笔</span>
            <span className="kx-tip"><kbd>E</kbd>橡皮</span>
            <span className="kx-tip"><kbd>H</kbd>抓手</span>
            <span className="kx-tip"><kbd>空格</kbd>拖动画布</span>
            <span className="kx-tip"><kbd>滚轮</kbd>缩放</span>
          </div>

          <button
            className="kx-btn-primary kx-block"
            onClick={() => void createProject()}
            disabled={busy}
          >
            <IconPlus size={16} />
            {busy ? "正在创建…" : "创建工程"}
          </button>
        </section>

        {/* ---------- 最近 ---------- */}
        <section className="kx-card kx-card-recent">
          <div className="kx-card-head">
            <h2 className="kx-card-title">最近工程</h2>
            {recent.length > 0 && (
              <button
                className="kx-btn-link"
                onClick={() => {
                  clearRecent();
                  setRecent([]);
                }}
              >
                清空列表
              </button>
            )}
          </div>

          {recent.length === 0 ? (
            <div className="kx-empty">
              <div className="kx-empty-mark">
                <IconFilm size={38} />
              </div>
              <p className="kx-empty-title">还没有打开过工程</p>
              <p className="kx-empty-hint">
                工程保存为 .kin 文件，只放在你自己的磁盘上，不上传、不同步。
              </p>
            </div>
          ) : (
            <ul className="kx-recent-list">
              {recent.map((it) => (
                <li
                  key={it.path}
                  className={it.missing ? "kx-recent is-missing" : "kx-recent"}
                >
                  <button
                    className="kx-recent-open"
                    disabled={it.missing || busy}
                    onClick={() => void openPath(it.path)}
                    title={it.missing ? "文件已移动或被删除" : it.path}
                  >
                    <span className="kx-recent-thumb">
                      <IconFilm size={18} />
                    </span>
                    <span className="kx-recent-text">
                      <span className="kx-recent-name">
                        {it.name}
                        {it.missing && <span className="kx-recent-tag">已丢失</span>}
                        {opening === it.path && (
                          <span className="kx-recent-tag is-busy">打开中…</span>
                        )}
                      </span>
                      <span className="kx-recent-path">{it.path}</span>
                    </span>
                    <span className="kx-recent-meta">
                      {it.width} × {it.height}
                      <span className="kx-recent-fps">{it.fps} fps</span>
                    </span>
                  </button>
                  <button
                    className="kx-recent-remove"
                    title="从列表移除"
                    onClick={() => {
                      removeRecent(it.path);
                      setRecent(loadRecent());
                    }}
                  >
                    <IconClose size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {/* ---------- 打开已有工程 ---------- */}
      <section className="kx-open-strip">
        <div className="kx-open-text">
          <h2 className="kx-card-title">打开已有工程</h2>
          <p className="kx-open-hint">
            .kin 工程带着图层、画格与画布尺寸；打开即回到上次保存的样子。
          </p>
        </div>
        <button
          className="kx-btn-primary"
          onClick={() => void pickFile()}
          disabled={busy}
        >
          选择 .kin 文件
        </button>
      </section>

      {error && (
        <div className="kx-banner" role="alert">
          <span className="kx-banner-text">{error}</span>
          <button
            className="kx-banner-close"
            onClick={() => setError(null)}
            aria-label="关闭提示"
          >
            <IconClose size={14} />
          </button>
        </div>
      )}

      <footer className="kx-start-foot">
        <span className="kx-foot-label">其它</span>
        <button className="kx-btn-ghost" onClick={() => setModal("shortcuts")}>
          快捷键
        </button>
        <button className="kx-btn-ghost" onClick={() => setModal("about")}>
          关于
        </button>
        <span className="kx-foot-gap" />
        <span className="kx-foot-note">
          {info ? `v${info.version} · ` : ""}MIT · 小方工作室
        </span>
      </footer>

      {modal === "about" && (
        <Modal title="关于 Kinexa" onClose={() => setModal(null)} width={480}>
          <div className="kx-about">
            <BrandMark size={44} />
            <div>
              <p className="kx-about-name">Kinexa</p>
              <p className="kx-about-ver">
                {info ? `版本 ${info.version} · ${info.platform}` : "二维动画与矢量动画软件"}
              </p>
            </div>
          </div>
          <p className="kx-about-copy">
            管逐帧绘制与矢量动画，负责把角色画动。镜头与合成交给 Reelix。
          </p>
          <p className="kx-about-copy">
            全中文界面，MIT 许可，永久免费。不带任何 AI 功能，不设账号，不联网校验，
            也从不自动更新。工程只保存在你自己的磁盘上。
          </p>
          <p className="kx-about-copy">小方工作室出品。</p>
        </Modal>
      )}

      {modal === "shortcuts" && (
        <Modal title="快捷键" onClose={() => setModal(null)} width={470}>
          <div className="kx-keys">
            {[
              ["Ctrl + N", "新建工程"],
              ["Ctrl + O", "打开工程"],
              ["Ctrl + S", "保存工程"],
              ["Ctrl + Shift + S", "另存为"],
              ["Ctrl + Z", "撤销"],
              ["Ctrl + Shift + Z", "重做"],
              ["B / E", "画笔 / 橡皮"],
              ["[ / ]", "缩小 / 放大笔尖"],
              ["Space 拖动", "移动画布"],
              ["Ctrl + 0", "适应窗口"],
            ].map(([key, label]) => (
              <div className="kx-key-row" key={key}>
                <span className="kx-key-label">{label}</span>
                <span className="kx-key-cap">{key}</span>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
