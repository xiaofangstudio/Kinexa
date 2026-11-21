import { invoke } from "@tauri-apps/api/core";

/** 图层信息，与 Rust 侧 DocInfo 一一对应。 */
export interface LayerInfo {
  id: number;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
}

/** 工程信息。像素不在这里，像素按脏矩形单独取。 */
export interface DocInfo {
  name: string;
  path: string | null;
  width: number;
  height: number;
  fps: number;
  frameCount: number;
  currentFrame: number;
  activeLayerId: number;
  layers: LayerInfo[];
}

/** 一块 RGBA 像素。 */
export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
  data: Uint8ClampedArray<ArrayBuffer>;
}

export interface NewProjectOptions {
  width: number;
  height: number;
  fps: number;
  name: string;
  transparent: boolean;
}

export interface StrokeArgs {
  x: number;
  y: number;
  pressure: number;
  color: string;
  size: number;
  hardness: number;
  opacity: number;
  erase: boolean;
}

export interface AppInfo {
  name: string;
  version: string;
  platform: string;
  license: string;
}

/**
 * Tauri 的原始字节响应到 JS 侧是 ArrayBuffer。
 * 为兼容不同运行时（也会遇到 Uint8Array 或数字数组），统一成 Uint8Array。
 */
function toBytes(input: unknown): Uint8Array {
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) {
    const view = input as ArrayBufferView;
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }
  if (Array.isArray(input)) return new Uint8Array(input as number[]);
  throw new Error("内核返回了无法识别的像素格式");
}

/**
 * 解析「4 个 u32 头 + RGBA」的二进制包。
 * 空矩形（撤销到底、切工具取消）时头里 w/h 为 0，data 为空。
 */
export function parseRegion(input: unknown): Region {
  const bytes = toBytes(input);
  if (bytes.byteLength < 20) {
    throw new Error("内核返回的像素包不完整");
  }
  const head = new DataView(bytes.buffer, bytes.byteOffset, 20);
  const x = head.getUint32(0, true);
  const y = head.getUint32(4, true);
  const w = head.getUint32(8, true);
  const h = head.getUint32(12, true);
  const need = w * h * 4;
  const data = new Uint8ClampedArray(need);
  const src = bytes.subarray(20, 20 + need);
  data.set(src.subarray(0, Math.min(src.length, need)));
  return { x, y, w, h, data };
}

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : String(e));
  }
}

export const api = {
  newProject: (opts: NewProjectOptions) =>
    call<DocInfo>("new_project", { ...opts }),

  openProject: (path: string) =>
    call<DocInfo>("open_project", { path }),

  saveProject: (path: string) =>
    call<DocInfo>("save_project", { path }),

  renameProject: (name: string) =>
    call<DocInfo>("rename_project", { name }),

  readFull: async () => parseRegion(await call<unknown>("read_full")),

  readRegion: async (x: number, y: number, w: number, h: number) =>
    parseRegion(await call<unknown>("read_region", { x, y, w, h })),

  beginStroke: async (args: StrokeArgs) =>
    parseRegion(await call<unknown>("begin_stroke", { ...args })),

  strokeTo: async (x: number, y: number, pressure: number) =>
    parseRegion(await call<unknown>("stroke_to", { x, y, pressure })),

  endStroke: async () => parseRegion(await call<unknown>("end_stroke")),

  cancelStroke: () => call<null>("cancel_stroke"),

  undo: async () => parseRegion(await call<unknown>("undo")),

  redo: async () => parseRegion(await call<unknown>("redo")),

  layerThumb: async (layerId: number, max = 40) =>
    parseRegion(await call<unknown>("layer_thumb", { layerId, max })),

  addLayer: (name: string) => call<DocInfo>("add_layer", { name }),

  deleteLayer: (layerId: number) => call<DocInfo>("delete_layer", { layerId }),

  moveLayer: (layerId: number, dir: number) =>
    call<DocInfo>("move_layer", { layerId, dir }),

  setActiveLayer: (layerId: number) =>
    call<DocInfo>("set_active_layer", { layerId }),

  setLayerVisible: (layerId: number, visible: boolean) =>
    call<DocInfo>("set_layer_visible", { layerId, visible }),

  setLayerLocked: (layerId: number, locked: boolean) =>
    call<DocInfo>("set_layer_locked", { layerId, locked }),

  setLayerOpacity: (layerId: number, opacity: number) =>
    call<DocInfo>("set_layer_opacity", { layerId, opacity }),

  renameLayer: (layerId: number, name: string) =>
    call<DocInfo>("rename_layer", { layerId, name }),

  addFrame: (duplicate: boolean) =>
    call<DocInfo>("add_frame", { duplicate }),

  setFrame: (index: number) => call<DocInfo>("set_frame", { index }),

  setOnion: (enabled: boolean) => call<DocInfo>("set_onion", { enabled }),

  fileExists: (path: string) => call<boolean>("file_exists", { path }),

  appInfo: () => call<AppInfo>("app_info"),

  exitApp: () => call<null>("exit_app"),
};

/** 把区域像素画成 data URL（图层缩略图用）。 */
export function regionToDataUrl(region: Region): string | null {
  if (region.w <= 0 || region.h <= 0) return null;
  const canvas = document.createElement("canvas");
  canvas.width = region.w;
  canvas.height = region.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.putImageData(new ImageData(region.data, region.w, region.h), 0, 0);
  return canvas.toDataURL("image/png");
}
