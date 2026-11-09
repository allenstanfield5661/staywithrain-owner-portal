import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  base: "./",
  resolve: {
    alias: {
      "@": path.resolve(root, ".."),
    },
  },
  build: {
    outDir: path.resolve(root, "../static-drop"),
    emptyOutDir: true,
  },
});
