import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const [app, audio, css] = await Promise.all([
  readFile(join(root, "src/App.tsx"), "utf8"),
  readFile(join(root, "src/AmbientAudio.tsx"), "utf8"),
  readFile(join(root, "src/app.css"), "utf8"),
]);

assert.match(
  app,
  /<\/OpeningExperience>\s*<AmbientAudio \/>/,
  "ambient audio must stay mounted across the opening and route changes",
);
assert.match(audio, /const TARGET_GAIN = 0\.035;/, "ambient audio must remain quiet");
assert.match(audio, /localStorage\.setItem\(STORAGE_KEY, "off"\)/, "mute preference must persist");
assert.match(audio, /visibilitychange/, "background tabs must silence the audio engine");
assert.match(audio, /aria-pressed=\{playing\}/, "the audio control must expose its state");
assert.match(css, /\.ambient-audio-control \{[\s\S]*z-index: 20001;[\s\S]*min-height: 44px;/, "the audio control must stay reachable above the opening");

console.log("ambient audio checks passed");
