import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { api, type DocInfo, type Region } from "../core/api";
import type { BrushSettings, ToolId } from "../core/tools";
import "./CanvasStage.css";

export interface StageHandle {
  /** 整幅重读（切画格、切图层、撤销之后用）。 */
  refresh: () => Promise<void>;
  /** 贴一块内核返回的像素（撤销、重做）。 */
  apply: (region: Region) => void;
  zoomBy: (factor: number) => void;
  fit: () => void;
  /** 取消正在进行的笔迹并清掉预览。 */
  cancel: () => void;
}

interface Props {
  doc: DocInfo;
  tool: ToolId;
  brush: BrushSettings;
  onZoomChange: (zoom: number) => void;
  onStrokeEnd: () => void;
  onError: (message: string) => void;
}

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 32;

/**
 * 画布舞台。
 *
 * 这里只做三件事：把指针坐标换算成画布像素、把内核返回的脏矩形贴上去、
 * 管理缩放与平移。光栅化、合成、撤销全在 Rust 侧，前端不碰像素运算。
 */
const CanvasStage = forwardRef<StageHandle, Props>(function CanvasStage(
  { doc, tool, brush, onZoomChange, onStrokeEnd, onError },
  ref,
) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoomState] = useState(1);
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });

  const drawingRef = useRef(false);
  const pendingRef = useRef<{ x: number; y: number; p: number } | null>(null);
  const pumpingRef = useRef(false);
  const endRequestedRef = useRef(false);
  const spaceRef = useRef(false);

  const applyTransform = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const { x, y } = panRef.current;
    stage.style.transform = `translate(${x}px, ${y}px) scale(${zoomRef.current})`;
  }, []);

  const clampZoom = (next: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));

  /** 以视口内某一点为锚点缩放：锚点下的画布像素保持不动。 */
  const zoomAt = useCallback(
    (next: number, cx: number, cy: number) => {
      const z = clampZoom(next);
      const k = z / zoomRef.current;
      const { x, y } = panRef.current;
      panRef.current = { x: cx - (cx - x) * k, y: cy - (cy - y) * k };
      zoomRef.current = z;
      setZoomState(z);
      applyTransform();
    },
    [applyTransform],
  );

  useEffect(() => {
    onZoomChange(zoom);
  }, [zoom, onZoomChange]);

  const ctxOf = () => canvasRef.current?.getContext("2d") ?? null;

  // 错误兜底要能自引用，所以先立一个引用槽
  const applyRegionRef = useRef<(region: Region) => void>(() => undefined);

  const applyRegion = useCallback((region: Region) => {
    if (region.w <= 0 || region.h <= 0) return;
    const ctx = ctxOf();
    if (!ctx) return;
    try {
      ctx.putImageData(new ImageData(region.data, region.w, region.h), region.x, region.y);
    } catch {
      /* 尺寸对不上就整幅重读，不能让画面停在半截 */
      void api
        .readFull()
        .then((r) => applyRegionRef.current(r))
        .catch(() => undefined);
    }
  }, []);
  applyRegionRef.current = applyRegion;

  const refresh = useCallback(async () => {
    const c = canvasRef.current;
    if (!c) return;
    try {
      const region = await api.readFull();
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.putImageData(new ImageData(region.data, doc.width, doc.height), 0, 0);
    } catch (e) {
      onError(`画面读取失败：${e instanceof Error ? e.message : String(e)}`);
    }
  }, [doc.width, doc.height, onError]);

  const fit = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const pad = 96;
    const cw = Math.max(1, wrap.clientWidth);
    const ch = Math.max(1, wrap.clientHeight);
    const z = clampZoom(Math.min((cw - pad) / doc.width, (ch - pad) / doc.height, 1));
    zoomRef.current = z;
    panRef.current = {
      x: (cw - doc.width * z) / 2,
      y: (ch - doc.height * z) / 2,
    };
    setZoomState(z);
    applyTransform();
  }, [doc.width, doc.height, applyTransform]);

  useImperativeHandle(
    ref,
    () => ({
      refresh,
      apply: applyRegion,
      zoomBy: (factor: number) => {
        const wrap = wrapRef.current;
        zoomAt(zoomRef.current * factor, (wrap?.clientWidth ?? 0) / 2, (wrap?.clientHeight ?? 0) / 2);
      },
      fit,
      cancel: () => {
        drawingRef.current = false;
        pendingRef.current = null;
        endRequestedRef.current = false;
        void api.cancelStroke().finally(() => void refresh());
      },
    }),
    [fit, refresh, applyRegion, zoomAt],
  );

  // 尺寸变了就重建画布；新工程先读整幅再适应窗口，窗口缩放时自动重新适配。
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = doc.width;
    c.height = doc.height;
    void refresh();
    const wrap = wrapRef.current;
    let raf = 0;
    const refit = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => fit());
    };
    refit();
    let ro: ResizeObserver | null = null;
    if (wrap && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(refit);
      ro.observe(wrap);
    }
    return () => {
      ro?.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [doc.width, doc.height, fit, refresh]);

  // 滚轮缩放：不在输入框里就接管，避免整页滚动；以光标为锚点
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const wr = wrap.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * 0.0015);
      zoomAt(zoomRef.current * factor, e.clientX - wr.left, e.clientY - wr.top);
    };
    wrap.addEventListener("wheel", onWheel, { passive: false });
    return () => wrap.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // 空格临时抓手；输入框里不抢键
  useEffect(() => {
    const isTyping = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      const tag = el?.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable;
    };
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isTyping(e.target)) {
        e.preventDefault();
        spaceRef.current = true;
        wrapRef.current?.classList.add("is-space");
      }
    };
    const up = () => {
      spaceRef.current = false;
      wrapRef.current?.classList.remove("is-space");
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", up);
    };
  }, []);

  const pointOf = (clientX: number, clientY: number) => {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    return {
      x: (clientX - r.left) / zoomRef.current,
      y: (clientY - r.top) / zoomRef.current,
    };
  };

  const pressureOf = (e: React.PointerEvent) =>
    e.pointerType === "pen" ? (e.pressure > 0 ? e.pressure : 0.5) : 1;

  const finishStroke = useCallback(async () => {
    if (!drawingRef.current) return;
    if (pumpingRef.current) {
      endRequestedRef.current = true;
      return;
    }
    drawingRef.current = false;
    try {
      const region = await api.endStroke();
      applyRegion(region);
      onStrokeEnd();
    } catch (e) {
      onError(`笔迹落笔失败：${e instanceof Error ? e.message : String(e)}`);
    }
  }, [applyRegion, onError, onStrokeEnd]);

  const pump = useCallback(() => {
    if (pumpingRef.current) return;
    pumpingRef.current = true;
    void (async () => {
      while (pendingRef.current) {
        const pt = pendingRef.current;
        pendingRef.current = null;
        try {
          const region = await api.strokeTo(pt.x, pt.y, pt.p);
          applyRegion(region);
        } catch (e) {
          onError(`笔迹中断：${e instanceof Error ? e.message : String(e)}`);
          pendingRef.current = null;
          break;
        }
      }
      pumpingRef.current = false;
      if (endRequestedRef.current) {
        endRequestedRef.current = false;
        void finishStroke();
      }
    })();
  }, [applyRegion, finishStroke, onError]);

  const moveRing = (clientX: number, clientY: number, visible: boolean) => {
    const ring = ringRef.current;
    const wrap = wrapRef.current;
    if (!ring || !wrap) return;
    if (!visible) {
      ring.style.display = "none";
      return;
    }
    const wr = wrap.getBoundingClientRect();
    ring.style.display = "block";
    ring.style.left = `${clientX - wr.left}px`;
    ring.style.top = `${clientY - wr.top}px`;
    const size = Math.max(6, brush.size * zoomRef.current);
    ring.style.width = `${size}px`;
    ring.style.height = `${size}px`;
  };

  const onCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    if (spaceRef.current || tool === "hand") return;
    if (tool !== "brush" && tool !== "eraser") return;
    e.preventDefault();
    const p = pointOf(e.clientX, e.clientY);
    const pressure = pressureOf(e);
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    pendingRef.current = null;
    endRequestedRef.current = false;
    void api
      .beginStroke({
        x: p.x,
        y: p.y,
        pressure,
        color: tool === "eraser" ? "#000000" : brush.color,
        size: brush.size,
        hardness: tool === "eraser" ? 1 : brush.hardness,
        opacity: brush.opacity,
        erase: tool === "eraser",
      })
      .then(applyRegion)
      .catch((err) => {
        drawingRef.current = false;
        onError(err instanceof Error ? err.message : String(err));
      });
  };

  const onCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    moveRing(e.clientX, e.clientY, tool !== "hand" && !spaceRef.current);
    if (!drawingRef.current) return;
    const p = pointOf(e.clientX, e.clientY);
    pendingRef.current = { x: p.x, y: p.y, p: pressureOf(e) };
    pump();
  };

  const onCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    pendingRef.current = null;
    void finishStroke();
  };

  // 抓手平移（工具、空格、中键）
  const panState = useRef<{ id: number; ox: number; oy: number; bx: number; by: number } | null>(
    null,
  );

  const onWrapPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const wantPan = tool === "hand" || spaceRef.current || e.button === 1;
    if (!wantPan) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    panState.current = {
      id: e.pointerId,
      ox: e.clientX,
      oy: e.clientY,
      bx: panRef.current.x,
      by: panRef.current.y,
    };
    e.currentTarget.classList.add("is-panning");
  };

  const onWrapPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (panState.current && panState.current.id === e.pointerId) {
      panRef.current = {
        x: panState.current.bx + (e.clientX - panState.current.ox),
        y: panState.current.by + (e.clientY - panState.current.oy),
      };
      applyTransform();
    }
    if (tool === "hand" || spaceRef.current) {
      moveRing(e.clientX, e.clientY, false);
    }
  };

  const endPan = (e: React.PointerEvent<HTMLDivElement>) => {
    if (panState.current && panState.current.id === e.pointerId) {
      panState.current = null;
      e.currentTarget.classList.remove("is-panning");
    }
  };

  const cursorClass =
    tool === "hand" || spaceRef.current ? " is-hand" : tool === "brush" || tool === "eraser" ? " is-draw" : "";

  return (
    <div
      className={`kx-stage-wrap${cursorClass}`}
      ref={wrapRef}
      onPointerDown={onWrapPointerDown}
      onPointerMove={onWrapPointerMove}
      onPointerUp={endPan}
      onPointerCancel={endPan}
      onPointerLeave={() => moveRing(0, 0, false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className="kx-stage"
        ref={stageRef}
        style={{ width: doc.width, height: doc.height }}
      >
        <canvas
          className="kx-stage-canvas"
          ref={canvasRef}
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={onCanvasPointerUp}
          onPointerCancel={onCanvasPointerUp}
          onPointerLeave={() => moveRing(0, 0, false)}
        />
      </div>
      <div className="kx-brush-ring" ref={ringRef} />
    </div>
  );
});

export default CanvasStage;
