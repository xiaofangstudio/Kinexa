import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Kinexa 的 dev 端口固定为 1423。
// 1420 Strata / 1421 FangBox / 1422 Reelix，三家各有各的坑位，不抢。
const DEV_PORT = 1423;

export default defineConfig({
  // 相对路径，确保 Qt WebEngine / Tauri 都能从本地文件加载构建产物。
  base: "./",
  plugins: [react()],
  clearScreen: false,
  server: {
    port: DEV_PORT,
    strictPort: true,
    host: process.env.TAURI_DEV_HOST || false,
    watch: {
      // Rust 侧由 cargo 自己监视，前端 dev server 不重复扫描
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  build: {
    // 目标为系统 WebView2（Windows 优先）
    target: "chrome110",
    minify: "esbuild",
    sourcemap: false,
    chunkSizeWarningLimit: 1024,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) {
            return "vendor-react";
          }
          if (id.includes("@tauri-apps")) return "vendor-tauri";
          return "vendor";
        },
      },
    },
  },
});
