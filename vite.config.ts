import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative base so the built assets load from file:// inside the iOS WKWebView.
  base: "./",
  build: {
    outDir: "dist",
    target: "es2020",
    sourcemap: false,
    chunkSizeWarningLimit: 4000,
  },
});
