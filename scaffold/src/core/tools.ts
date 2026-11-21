export type ToolId = "brush" | "eraser" | "hand";

/** 笔的四个参数：直径、硬度、不透明度、颜色。 */
export interface BrushSettings {
  size: number;
  hardness: number;
  opacity: number;
  color: string;
}

export const DEFAULT_BRUSH: BrushSettings = {
  size: 10,
  hardness: 0.82,
  opacity: 0.92,
  color: "#262420",
};
