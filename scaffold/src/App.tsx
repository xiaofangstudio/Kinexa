import { useState } from "react";
import StartPage from "./ui/StartPage";
import EditorShell from "./ui/EditorShell";
import { useUiSettings } from "./stores/uiSettings";
import type { DocInfo } from "./core/api";

/**
 * 应用根。
 *
 * 启动先到欢迎页；新建或打开工程后进编辑壳；关闭工程回到欢迎页，
 * 程序不退出。界面偏好全局共享，两页共用一套。
 */
export default function App() {
  const { settings, theme, update, toggleTheme, reset } = useUiSettings();
  const [doc, setDoc] = useState<DocInfo | null>(null);

  if (doc) {
    return (
      <EditorShell
        doc={doc}
        onDocChange={setDoc}
        onClose={() => setDoc(null)}
        ui={settings}
        theme={theme}
        onUpdateUi={update}
        onToggleTheme={toggleTheme}
        onResetUi={reset}
      />
    );
  }

  return (
    <StartPage
      themeMode={theme}
      onToggleTheme={toggleTheme}
      onOpenDoc={(d) => setDoc(d)}
    />
  );
}
