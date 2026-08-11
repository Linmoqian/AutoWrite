import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  build: {
    // emptyOutDir=false：避免 vite 的 prepareOutDir 触发环境 safe-delete 守卫
    // 对批量删除的拦截。由 CI 或开发者手动清理 dist（如 trash dist/*）。
    emptyOutDir: false,
  },
  server: {
    port: 1422,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1423,
        }
      : undefined,
    watch: {
      ignored: ["**/app-tauri/**"],
    },
  },
}));
