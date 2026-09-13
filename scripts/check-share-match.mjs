import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const productionSource = readFileSync(
  new URL("../src/shareMatch.ts", import.meta.url),
  "utf8",
);
const matchPageSource = readFileSync(
  new URL("../src/MatchReveal.tsx", import.meta.url),
  "utf8",
);
const appCssSource = readFileSync(
  new URL("../src/app.css", import.meta.url),
  "utf8",
);

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
  const preset = params.get("preset");
  const version = params.get("version") ?? "";
  const cast = params.get("cast") ?? "";
  const stanceValue = params.get("s");
  const knownPresets = new Set(["career-35", "ai-math"]);

  if (!preset || !knownPresets.has(preset)) return null;
  if (!/^[a-z0-9-]{1,15}$/.test(version)) return null;
  if (!CAST_KEYS.has(cast)) return null;
  if (stanceValue === null || !/^-?\d{1,3}$/.test(stanceValue)) return null;
  const stanceCode = Number(stanceValue);
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
  const side = (stance) => stance <= -0.35 ? -1 : stance >= 0.35 ? 1 : 0;
  const hostDirection = side(hostStance);
  const guestDirection = side(guestStance);
  const sameDirection =
    hostDirection !== 0 && hostDirection === guestDirection;
  const oppositeDirection = hostDirection * guestDirection === -1;

  let headline = "你们在光谱上相遇了";
  if (gap < 0.15) headline = "立场几乎重合";
  else if (gap < 0.4 && sameDirection) headline = "同侧观察，细节不同";
  else if (oppositeDirection) headline = "站在争议两侧";
  else if (hostDirection === 0 || guestDirection === 0) headline = "一方仍在中间观察";
  else if (gap >= 0.7) headline = "相距较远，对照鲜明";

  const body = [
    `朋友落在「${hostSide}」一侧，人格呈现为「${hostCastName}」；`,
    `你完成三次表态后落在「${guestSide}」一侧。`,
    gap < 0.2
      ? "双方坐标接近，说明你们对这道题的第一反应相当一致。"
      : sameDirection
        ? "你们仍处在同一侧，但对议题的轻重判断并不完全相同。"
        : oppositeDirection
          ? `本题主轴是「${axis.left}」与「${axis.right}」，你们分别靠近不同一端。`
          : "其中一方仍在中间观察，暂时没有落到争议的任一端。",
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
assert.equal(
  parseShareMatchQuery(new URLSearchParams("preset=ai-math&version=20260912&cast=fox")),
  null,
);
assert.equal(
  parseShareMatchQuery(new URLSearchParams("preset=unknown&version=20260912&cast=fox&s=0")),
  null,
);
assert.equal(
  parseShareMatchQuery(new URLSearchParams("preset=ai-math&version=20260912&cast=fox&s=1e2")),
  null,
);

const relationship = describeMatchRelationship(axis, "长答派", 0.8, -0.7);
assert.match(relationship.headline, /两侧/);
assert.match(relationship.body, /不构成心理判断/);
const neutralRelationship = describeMatchRelationship(axis, "长答派", 0, 0.75);
assert.match(neutralRelationship.headline, /中间/);
assert.doesNotMatch(neutralRelationship.body, /仍处在同一侧/);

assert.doesNotMatch(
  productionSource,
  /resolveNebulaPreset/,
  "生产解析不得把未知快照降级为默认快照",
);
assert.match(
  productionSource,
  /stanceValue === null[\s\S]*\/\^-\?\\d\{1,3\}\$\//,
  "生产解析必须拒绝缺失或非十进制整数立场",
);
assert.match(
  matchPageSource,
  /payload\.version !== currentVersion[\s\S]*分享链接已过期/,
  "对照页必须明确拒绝旧版快照链接",
);
assert.doesNotMatch(
  matchPageSource,
  /AppChrome/,
  "对照页不得重新依赖主线已删除的旧外壳",
);
assert.match(
  appCssSource,
  /\.match-marker--host\s*\{[^}]*top:\s*calc\(50% - 9px\)/,
  "分享者标记必须与朋友标记错层显示",
);
assert.match(
  appCssSource,
  /\.match-marker--guest\s*\{[^}]*top:\s*calc\(50% \+ 9px\)/,
  "朋友标记必须与分享者标记错层显示",
);

console.log("share match checks passed");
