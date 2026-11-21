import { useCallback, useEffect, useMemo, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";
export type UiDensity = "comfortable" | "compact";

export interface UiSettings {
  /** 浅色是默认；深色与跟随系统只是选项。 */
  theme: ThemeMode;
  density: UiDensity;
  /** 轻磨砂：面板半透明 + 背景模糊，默认开启但可关。 */
  frosted: boolean;
  /** 后续版本的工具默认收起，让工具栏保持简单。 */
  showFuture: boolean;
}

export const DEFAULT_UI: UiSettings = {
  theme: "light",
  density: "comfortable",
  frosted: true,
  showFuture: false,
};

const KEY = "kinexa.ui.v1";
const LEGACY_THEME_KEY = "kinexa.theme";

function readSettings(): UiSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UiSettings>;
      return {
        theme:
          parsed.theme === "dark" ||
          parsed.theme === "system" ||
          parsed.theme === "light"
            ? parsed.theme
            : DEFAULT_UI.theme,
        density: parsed.density === "compact" ? "compact" : "comfortable",
        frosted: parsed.frosted !== false,
        showFuture: parsed.showFuture === true,
      };
    }
    // 旧版本只存了明暗，迁移过来，其余用默认值。
    const legacy = localStorage.getItem(LEGACY_THEME_KEY);
    if (legacy === "dark") return { ...DEFAULT_UI, theme: "dark" };
  } catch {
    /* 读不到就用默认浅色 */
  }
  return DEFAULT_UI;
}

/**
 * 界面偏好：主题 / 密度 / 磨砂 / 是否显示后续工具。
 * 全部落在 <html> 的 data-* 上，CSS 只认令牌，不认具体页面。
 */
export function useUiSettings() {
  const [settings, setSettings] = useState<UiSettings>(readSettings);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false,
  );

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const theme: ResolvedTheme = useMemo(() => {
    if (settings.theme === "system") return systemDark ? "dark" : "light";
    return settings.theme;
  }, [settings.theme, systemDark]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.density = settings.density;
    root.dataset.frosted = settings.frosted ? "on" : "off";
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
      localStorage.setItem(LEGACY_THEME_KEY, theme);
    } catch {
      /* 存不了下次回默认，不影响本次使用 */
    }
  }, [settings, theme]);

  const update = useCallback((patch: Partial<UiSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const toggleTheme = useCallback(() => {
    setSettings((prev) => {
      const current: ResolvedTheme =
        prev.theme === "system" ? (systemDark ? "dark" : "light") : prev.theme;
      return { ...prev, theme: current === "light" ? "dark" : "light" };
    });
  }, [systemDark]);

  const reset = useCallback(() => setSettings(DEFAULT_UI), []);

  return { settings, theme, update, toggleTheme, reset };
}
