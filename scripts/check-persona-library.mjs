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
assert.equal(readyThemes.length, 1, "only the accepted first theme is ready");
assert.equal(
  getPersonaTheme("relationships-family"),
  null,
  "planned themes must not enter runtime",
);
const lifeChoices = getPersonaTheme("life-choices");
assert.ok(lifeChoices);
assert.equal(lifeChoices.personas.length, 9);
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

for (const persona of lifeChoices.personas) {
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

assert.equal(PERSONA_PRESET_THEME_IDS["career-35"], "life-choices");
assert.equal(getNebulaPreset("career-35").personaTheme, "life-choices");
assert.equal(getNebulaPreset("ai-math").personaTheme, undefined);
assert.equal(
  listNebulaPresets().find(({ id }) => id === "career-35")?.personaTheme,
  "life-choices",
);

const themedCasts = resolvePersonaCastsForPreset("career-35");
assert.equal(themedCasts.length, 9);
assert.ok(themedCasts.every(({ themeId }) => themeId === "life-choices"));
assert.ok(themedCasts.every(({ signals }) => signals.length >= 3));
assert.ok(themedCasts.every(({ selectionReason }) => selectionReason.length >= 20));
assert.ok(themedCasts.some(({ name }) => name === "加缪"));

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

console.log(
  `persona library OK: ${PERSONA_THEMES.length} themes, ` +
    `${lifeChoices.personas.length} accepted personas, legacy fallback intact`,
);
