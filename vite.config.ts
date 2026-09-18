import path from "node:path";
import { copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const dir = fileURLToPath(new URL(".", import.meta.url));
const neuformSource = path.resolve(
  dir,
  "src/shaders/neuform-isolated/NeuformIsolatedEffects.tsx",
);
const packagedNeuformSources = path.resolve(
  dir,
  "node_modules/@designcodeio/threeui/lib-dist/shaders/neuform-isolated/sources",
);
const unregisteredNeuformSources = new Set([
  "recursive-erosion.html",
  "synthesis-orb.html",
]);

function modulePath(id: string) {
  return id.split("?", 1)[0];
}

export default defineConfig({
  base: process.env.GITHUB_PAGES_BASE ?? "/",
  define: {
    __SCENE_VERSION__: JSON.stringify(String(Date.now())),
  },
  plugins: [
    {
      name: "threeui-neuform-source-bridge",
      enforce: "pre",
      resolveId(source, importer) {
        if (
          !importer
          || modulePath(importer) !== neuformSource
          || !source.startsWith("./sources/")
          || !source.endsWith(".html?raw")
        ) {
          return null;
        }

        const filename = source.slice("./sources/".length, -"?raw".length);
        const localSource = path.resolve(path.dirname(neuformSource), "sources", filename);
        if (existsSync(localSource)) return null;

        const packagedSource = path.resolve(packagedNeuformSources, `${filename}.js`);
        if (existsSync(packagedSource)) return packagedSource;

        if (!unregisteredNeuformSources.has(filename)) {
          throw new Error(`Missing ThreeUI Neuform source dependency: ${filename}`);
        }
        // These variants are not exposed by the local collection, but their static
        // imports still need a valid document while the exact source is bundled.
        return path.resolve(packagedNeuformSources, "epilude-footer.html.js");
      },
      transform(code, id) {
        if (modulePath(id) !== neuformSource) return null;

        const replacements = [
          [">SHADERS</text>", ">Soular</text>"],
          ['font-size="240"', 'font-size="300"'],
          ['letter-spacing="-8"', 'letter-spacing="0"'],
          ['title: "Shaders particle wordmark"', 'title: "Soular particle wordmark"'],
          ['background: "#0c0c0d",', 'background: "#050607",'],
          ['darkBackground: "#0c0c0d",', 'darkBackground: "#050607",'],
        ] as const;
        let transformed = code;
        for (const [from, to] of replacements) {
          if (!transformed.includes(from)) {
            throw new Error(`ThreeUI particle wordmark source changed: missing ${from}`);
          }
          transformed = transformed.replace(from, to);
        }
        return { code: transformed, map: null };
      },
    },
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
    alias: [
      {
        find: /^@designcodeio\/threeui$/,
        replacement: path.resolve(dir, "src/shaders/threeui.ts"),
      },
      {
        find: /^@designcodeio\/threeui\/style\.css$/,
        replacement: path.resolve(dir, "src/shaders/threeui.css"),
      },
      { find: "@", replacement: path.resolve(dir, "src") },
    ],
  },
  server: {
    port: 4325,
    proxy: { "/api": "http://127.0.0.1:8787" },
  },
});
