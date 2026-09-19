import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_ROOT = resolve(ROOT, "node_modules/three-r165/examples/jsm");
const TARGET_ROOT = resolve(ROOT, "public/books/vendor/three");
const CHECK_ONLY = process.argv.includes("--check");

const FILES = [
  "environments/RoomEnvironment.js",
  "geometries/RoundedBoxGeometry.js",
  "lights/RectAreaLightUniformsLib.js",
];

for (const relativePath of FILES) {
  const source = resolve(SOURCE_ROOT, relativePath);
  const target = resolve(TARGET_ROOT, relativePath);

  if (CHECK_ONLY) {
    const sourceBytes = readFileSync(source);
    const targetBytes = readFileSync(target);
    if (!sourceBytes.equals(targetBytes)) {
      throw new Error(`书架 Three.js 本地资源已漂移：${relativePath}`);
    }
    continue;
  }

  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
}

console.log(
  CHECK_ONLY
    ? `books Three.js vendor check passed: ${FILES.length} files`
    : `books Three.js vendor updated: ${FILES.length} files`,
);
