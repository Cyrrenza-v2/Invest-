import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist", sourcemap: true, rollupOptions: { input: { user: resolve(__dirname, "index.html"), admin: resolve(__dirname, "admin.html") } } }
});