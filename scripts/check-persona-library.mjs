import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LEGACY_PERSONAS,
  PERSONA_LIBRARY_SCHEMA_VERSION,
  PERSONA_PRESET_THEME_IDS,
  PERSONA_SLOT_KEYS,
  PERSONA_THEMES,
  getPersonaTheme,
  resolvePersonaCasts,
  resolvePersonaCastsForPreset,
} from "../public/persona-library.js";
import {
  getNebulaPreset,
  listNebulaPresets,
} from "../public/nebula-scene/presets.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = join(root, "public");

function jpegDimensions(buffer) {
  assert.equal(buffer.readUInt16BE(0), 0xffd8, "persona asset must be JPEG");
  let offset = 2;
  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const segmentLength = buffer.readUInt16BE(offset + 2);
    assert.ok(segmentLength >= 2, "JPEG segment length must be valid");
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      ![0xc4, 0xc8, 0xcc].includes(marker)
    ) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    offset += segmentLength + 2;
  }
  throw new Error("persona asset has no JPEG size marker");
}

assert.equal(PERSONA_LIBRARY_SCHEMA_VERSION, 1);
assert.equal(PERSONA_THEMES.length, 8, "PRD requires eight top-level themes");
assert.equal(new Set(PERSONA_THEMES.map(({ id }) => id)).size, 8);
assert.ok(
  PERSONA_THEMES.every(
    ({ id, name, status, scopes, source }) =>
      /^[a-z0-9-]+$/.test(id) &&
      typeof name === "string" &&
      name.length > 0 &&
      ["ready", "planned"].includes(status) &&
      Array.isArray(scopes) &&
      scopes.length > 0 &&
      source.startsWith("https://"),
  ),
  "every theme must satisfy the catalog contract",
);

const readyThemes = PERSONA_THEMES.filter(({ status }) => status === "ready");
assert.equal(readyThemes.length, 2, "life choices and AI math themes must be ready");
assert.equal(
  getPersonaTheme("relationships-family"),
  null,
  "planned themes must not enter runtime",
);
const lifeChoices = getPersonaTheme("life-choices");
const workTechFuture = getPersonaTheme("work-tech-future");
assert.ok(lifeChoices);
assert.ok(workTechFuture);
assert.equal(lifeChoices.personas.length, 9);
assert.equal(workTechFuture.personas.length, 9);
assert.deepEqual(
  [...lifeChoices.personas.map(({ slot }) => slot)].sort(),
  [...PERSONA_SLOT_KEYS].sort(),
  "the ready theme must fill every stable cast slot exactly once",
);
assert.equal(new Set(lifeChoices.personas.map(({ id }) => id)).size, 9);
assert.equal(new Set(lifeChoices.personas.map(({ name }) => name)).size, 9);
assert.ok(
  lifeChoices.personas
    .filter(({ origin }) => origin === "china")
    .every(({ period }) => period === "pre-modern"),
  "modern Chinese figures are outside the accepted selection boundary",
);
assert.deepEqual(
  [...workTechFuture.personas.map(({ slot }) => slot)].sort(),
  [...PERSONA_SLOT_KEYS].sort(),
  "the AI math theme must fill every stable cast slot exactly once",
);
assert.deepEqual(
  workTechFuture.personas.map(({ name }) => name),
  [
    "图灵",
    "笛卡尔",
    "庞加莱",
    "哥德尔",
    "希尔伯特",
    "欧几里得",
    "莱布尼茨",
    "拉卡托斯",
    "拉马努金",
  ],
  "AI math personas must use the accepted historical-figure set",
);

for (const theme of readyThemes) {
  for (const persona of theme.personas) {
    assert.match(persona.id, /^[a-z0-9-]+$/);
    assert.ok(persona.name.length > 0);
    assert.ok(persona.role.length > 0);
    assert.ok(persona.description.length >= 20);
    assert.ok(persona.selectionReason.length >= 20);
    assert.ok(persona.signals.length >= 3);
    assert.match(persona.portrait, /^personas\/[a-z0-9-]+\.jpg$/);
    assert.equal(persona.art.kind, "project-original-symbolic-illustration");
    assert.equal(persona.art.historicalLikeness, false);
    assert.equal(persona.art.reviewed, true);

    const assetPath = resolve(publicRoot, persona.portrait);
    assert.ok(assetPath.startsWith(`${publicRoot}/`), "asset must stay in public");
    const assetStat = await stat(assetPath);
    assert.ok(assetStat.size >= 10_000, `${persona.name} asset is unexpectedly small`);
    const dimensions = jpegDimensions(await readFile(assetPath));
    assert.deepEqual(dimensions, { width: 512, height: 512 });
  }
}

const presetThemeIds = Object.fromEntries(
  listNebulaPresets()
    .filter(({ personaTheme }) => typeof personaTheme === "string")
    .map(({ id, personaTheme }) => [id, personaTheme]),
);
assert.deepEqual(
  presetThemeIds,
  PERSONA_PRESET_THEME_IDS,
  "snapshot personaTheme bindings and persona library mappings must stay in sync",
);
for (const [presetId, themeId] of Object.entries(PERSONA_PRESET_THEME_IDS)) {
  assert.ok(getPersonaTheme(themeId), `${presetId} must reference a ready theme`);
  assert.ok(
    resolvePersonaCastsForPreset(presetId)
      .every(({ themeId: resolvedThemeId }) => resolvedThemeId === themeId),
    `${presetId} must resolve one complete themed cast set`,
  );
}
assert.equal(PERSONA_PRESET_THEME_IDS["career-35"], "life-choices");
assert.equal(PERSONA_PRESET_THEME_IDS["ai-math"], "work-tech-future");
assert.equal(PERSONA_PRESET_THEME_IDS["scholars-ai-math"], "work-tech-future");
assert.equal(getNebulaPreset("career-35").personaTheme, "life-choices");
assert.equal(getNebulaPreset("ai-math").personaTheme, "work-tech-future");
assert.equal(
  getNebulaPreset("scholars-ai-math").personaTheme,
  "work-tech-future",
);

const themedCasts = resolvePersonaCastsForPreset("career-35");
assert.equal(themedCasts.length, 9);
assert.ok(themedCasts.every(({ themeId }) => themeId === "life-choices"));
assert.ok(themedCasts.every(({ signals }) => signals.length >= 3));
assert.ok(themedCasts.every(({ selectionReason }) => selectionReason.length >= 20));
assert.ok(themedCasts.some(({ name }) => name === "加缪"));
for (const presetId of ["ai-math", "scholars-ai-math"]) {
  const aiMathCasts = resolvePersonaCastsForPreset(presetId);
  assert.equal(aiMathCasts.length, 9);
  assert.ok(
    aiMathCasts.every(({ themeId }) => themeId === "work-tech-future"),
  );
  assert.ok(aiMathCasts.some(({ name }) => name === "图灵"));
  assert.ok(aiMathCasts.every(({ name }) => !name.endsWith("派")));
}

const fallbackCasts = resolvePersonaCasts("missing-theme");
assert.deepEqual(
  fallbackCasts.map(({ key, name, role, portrait }) => ({
    key,
    name,
    role,
    portrait,
  })),
  PERSONA_SLOT_KEYS.map((key) => {
    const { name, role, portrait } = LEGACY_PERSONAS[key];
    return { key, name, role, portrait };
  }),
  "missing themes must preserve the existing nine casts",
);

const [
  cardDrawSource,
  matchRevealSource,
  personaThemeSource,
  shelfPageSource,
  shelfSceneSource,
  nebulaSceneSource,
] = await Promise.all([
  readFile(join(root, "src/CardDraw.tsx"), "utf8"),
  readFile(join(root, "src/MatchReveal.tsx"), "utf8"),
  readFile(join(root, "src/personaTheme.ts"), "utf8"),
  readFile(join(root, "src/Shelf.tsx"), "utf8"),
  readFile(join(publicRoot, "books/shelf.html"), "utf8"),
  readFile(join(publicRoot, "nebula-scene/index.html"), "utf8"),
]);
assert.match(
  cardDrawSource,
  /selfProfile\?\.claim\s*\?\?\s*cast\.description/,
  "self posters must preserve the user's current-question conclusion",
);
assert.match(
  personaThemeSource,
  /personaLibraryPromise\s*=\s*null;[\s\S]*personaLibraryAttempt\s*=\s*attempt\s*\+\s*1/,
  "failed React persona imports must advance to a fresh retry URL",
);
assert.match(
  personaThemeSource,
  /libraryUrl\.searchParams\.set\("retry", String\(attempt\)\)/,
  "React persona retries must bypass a rejected browser module entry",
);
assert.match(
  personaThemeSource,
  /attempt\s*>\s*0[\s\S]*PERSONA_LIBRARY_RETRY_TIMEOUT_MS/,
  "React persona retries must allow a slower recovery request",
);
assert.match(
  shelfPageSource,
  /disabled=\{personaLoading\}[\s\S]*!personaLoading\s*&&\s*phase/,
  "persona card actions must wait for the theme decision",
);
assert.match(
  shelfPageSource,
  /const personaLoading = reactPersonaLoading;/,
  "React must not block the persona card on the heavy 3D shelf handshake",
);
assert.match(
  shelfPageSource,
  /shelfParams\.set\("personaRetry", String\(personaState\.loadAttempt\)\)/,
  "the 3D shelf must receive the active persona retry attempt",
);
assert.match(
  shelfPageSource,
  /usesSnapshotPersona\s*&&\s*personaState\.status\s*===\s*"ready"/,
  "the 3D shelf must only receive a theme after React accepts the library",
);
assert.match(
  shelfPageSource,
  /!reactPersonaLoading\s*&&\s*\(\s*<iframe/,
  "the 3D shelf must wait for React's persona decision",
);
assert.match(
  shelfPageSource,
  /event\.origin\s*!==\s*window\.location\.origin[\s\S]*event\.source\s*!==\s*shelfFrameRef\.current\?\.contentWindow/,
  "the 3D shelf fallback handshake must validate origin and source window",
);
const personaBootstrapPosition = shelfSceneSource.indexOf(
  "window.__shelfPersonaLibraryPromise",
);
const threeImportPosition = shelfSceneSource.indexOf(
  'import * as THREE from "three"',
);
assert.ok(
  personaBootstrapPosition >= 0 &&
    threeImportPosition >= 0 &&
    personaBootstrapPosition < threeImportPosition,
  "the shelf must start loading its persona theme before the Three.js graph",
);
const nebulaPersonaBootstrapPosition = nebulaSceneSource.indexOf(
  "window.__nebulaPersonaLibraryPromise",
);
const nebulaThreeImportPosition = nebulaSceneSource.indexOf(
  'import * as THREE from "three"',
);
assert.ok(
  nebulaPersonaBootstrapPosition >= 0 &&
    nebulaThreeImportPosition >= 0 &&
    nebulaPersonaBootstrapPosition < nebulaThreeImportPosition,
  "the nebula must start loading its persona theme before the Three.js graph",
);
assert.match(
  matchRevealSource,
  /personaState\.status\s*===\s*"loading"/,
  "friend comparison must wait for the theme decision",
);
for (const source of [shelfSceneSource, nebulaSceneSource]) {
  assert.match(
    source,
    /Promise\.race\(\[[\s\S]*persona library load timed out/,
    "optional persona modules must not block a static scene indefinitely",
  );
}
assert.match(
  shelfSceneSource,
  /syncStaticFallbackCatalog\(\);/,
  "the WebGL fallback catalog must use the resolved theme",
);
assert.match(
  shelfSceneSource,
  /personaLibraryUrl\.searchParams\.set\("retry", String\(personaLoadAttempt\)\)/,
  "the 3D shelf must use a fresh module URL when React retries",
);
assert.match(
  shelfSceneSource,
  /isPersonaRetry[\s\S]*OPTIONAL_PERSONA_RETRY_TIMEOUT_MS/,
  "the 3D shelf must allow a slower recovery request",
);
assert.match(
  shelfSceneSource,
  /window\.parent\.postMessage\(\{[\s\S]*type:\s*"persona-shelf-status"[\s\S]*status[\s\S]*\}, location\.origin\)/,
  "the 3D shelf must report its final persona mode to the parent",
);

console.log(
  `persona library OK: ${PERSONA_THEMES.length} themes, ` +
    `${readyThemes.reduce((count, theme) => count + theme.personas.length, 0)} ` +
    "accepted personas, legacy fallback intact",
);
