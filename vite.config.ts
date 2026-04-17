import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { viteSingleFile } from "vite-plugin-singlefile";
import legacy from "@vitejs/plugin-legacy";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

/** 构建后自动删除 dist/avatars（头像由 Supabase 提供，本地文件不需打包） */
const removeDistAvatars = {
  name: "remove-dist-avatars",
  closeBundle() {
    const dir = path.resolve(__dirname, "dist/avatars");
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  },
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  root: path.resolve(__dirname),
  base: process.env.VITE_BASE ?? "/star-planner/",
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    mode === "production" && !process.env.VITE_NO_SINGLEFILE && viteSingleFile(),
    mode === "production" && process.env.VITE_LEGACY === "1" && legacy({
      targets: ["android >= 5", "chrome >= 49", "ios >= 10"],
    }),
    mode === "production" && removeDistAvatars,
  ].filter(Boolean),
  build: {
    target: ["es2015", "chrome60", "safari11"],
    modulePreload: false,
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
