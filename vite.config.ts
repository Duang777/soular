import path from "node:path";
import { copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const dir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  base: process.env.GITHUB_PAGES_BASE ?? "/",
  plugins: [
    react(),
    {
      name: "spa-github-pages-fallback",
      closeBundle() {
        const index = path.resolve(dir, "dist/index.html");
        if (existsSync(index)) copyFileSync(index, path.resolve(dir, "dist/404.html"));
      },
    },
  ],
  resolve: {
    alias: { "@": path.resolve(dir, "src") },
  },
  server: { port: 4325 },
});
