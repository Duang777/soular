import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const dir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  base: process.env.GITHUB_PAGES_BASE ?? "/",
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "@designcodeio/threeui/style.css",
        replacement: path.resolve(dir, "src/shaders/threeui.css"),
      },
      {
        find: "@designcodeio/threeui",
        replacement: path.resolve(dir, "src/threeui.tsx"),
      },
    ],
  },
  server: { port: 4325 },
});
