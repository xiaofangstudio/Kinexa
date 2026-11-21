/** 新建工程的画布预设。尺寸是成片规格，不是窗口大小。 */
export interface Preset {
  key: string;
  label: string;
  note: string;
  w: number;
  h: number;
  fps: number;
}

export const PRESETS: Preset[] = [
  { key: "hd", label: "全高清", note: "1920 × 1080", w: 1920, h: 1080, fps: 24 },
  { key: "hd720", label: "高清", note: "1280 × 720", w: 1280, h: 720, fps: 24 },
  { key: "square", label: "方屏", note: "1080 × 1080", w: 1080, h: 1080, fps: 24 },
  { key: "vertical", label: "竖屏", note: "1080 × 1920", w: 1080, h: 1920, fps: 24 },
  { key: "wide", label: "宽银幕", note: "1920 × 804", w: 1920, h: 804, fps: 24 },
  { key: "draft", label: "速写稿", note: "960 × 540", w: 960, h: 540, fps: 12 },
];

export const MIN_SIDE = 64;
export const MAX_SIDE = 4096;
export const FPS_OPTIONS = [12, 24, 30];

/** 用当前时间生成一个默认工程名，避免每次新建都叫「未命名」。 */
export function defaultProjectName(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `未命名动画 ${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}-${p(d.getMinutes())}`;
}
