import assert from "node:assert/strict";

const CAST_KEYS = new Set([
  "fox", "bear", "cat", "owl", "rabbit", "penguin", "redpanda", "goat", "frog",
]);

function encodeStance(stance) {
  return Math.round(Math.max(-1, Math.min(1, stance)) * 100);
}

function decodeStance(code) {
  if (!Number.isInteger(code) || code < -100 || code > 100) return null;
  return code / 100;
}

function buildShareMatchUrl(origin, basePath, payload) {
  const base = basePath.endsWith("/") ? basePath : `${basePath}/`;
  const s = encodeStance(payload.stance);
  return `${origin}${base}match?preset=${encodeURIComponent(payload.preset)}` +
    `&version=${encodeURIComponent(payload.version)}` +
    `&cast=${encodeURIComponent(payload.cast)}` +
    `&s=${s}`;
}

function parseShareMatchQuery(params) {
  const preset = params.get("preset") ?? "";
  const version = params.get("version") ?? "";
  const cast = params.get("cast") ?? "";
  const stanceCode = Number(params.get("s"));
  const knownPresets = new Set(["career-35", "ai-math"]);

  if (!knownPresets.has(preset)) return null;
  if (!/^[a-z0-9-]{1,15}$/.test(version)) return null;
  if (!CAST_KEYS.has(cast)) return null;
  const stance = decodeStance(stanceCode);
  if (stance === null) return null;

  return { preset, version, cast, stance };
}

function stanceLabel(stance, axis) {
  if (stance <= -0.35) return axis.left;
  if (stance >= 0.35) return axis.right;
  return axis.center;
}

function describeMatchRelationship(axis, hostCastName, hostStance, guestStance) {
  const gap = Math.abs(hostStance - guestStance);
  const hostSide = stanceLabel(hostStance, axis);
  const guestSide = stanceLabel(guestStance, axis);
  const sameDirection = hostStance * guestStance >= 0;

  let headline = "你们在光谱上相遇了";
  if (gap < 0.15) headline = "立场几乎重合";
  else if (gap < 0.4 && sameDirection) headline = "同侧观察，细节不同";
  else if (!sameDirection && gap >= 0.4) headline = "站在争议两侧";

  const body = [
    `朋友落在「${hostSide}」一侧，人格呈现为「${hostCastName}」；`,
    `你完成三次表态后落在「${guestSide}」一侧。`,
    "以上只基于本题公开立场与分享者人格，不构成心理判断。",
  ].join("");

  return { headline, body };
}

const axis = {
  left: "必须转行",
  center: "中立观察",
  right: "深耕不转",
};

assert.equal(encodeStance(0.42), 42);
assert.equal(decodeStance(42), 0.42);
assert.equal(decodeStance(101), null);

const url = buildShareMatchUrl("https://soular.top", "/", {
  preset: "ai-math",
  version: "20260912",
  cast: "fox",
  stance: 0.42,
});
assert.equal(
  url,
  "https://soular.top/match?preset=ai-math&version=20260912&cast=fox&s=42",
);

const parsed = parseShareMatchQuery(new URL(url).searchParams);
assert.deepEqual(parsed, {
  preset: "ai-math",
  version: "20260912",
  cast: "fox",
  stance: 0.42,
});

assert.equal(parseShareMatchQuery(new URLSearchParams("preset=ai-math&cast=fox&s=42")), null);

const relationship = describeMatchRelationship(axis, "长答派", 0.8, -0.7);
assert.match(relationship.headline, /两侧/);
assert.match(relationship.body, /不构成心理判断/);

console.log("share match checks passed");
