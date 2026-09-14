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
const peopleSource = readFileSync(
  new URL("../src/people.ts", import.meta.url),
  "utf8",
);
const cardDrawSource = readFileSync(
  new URL("../src/CardDraw.tsx", import.meta.url),
  "utf8",
);
const appCssSource = readFileSync(
  new URL("../src/app.css", import.meta.url),
  "utf8",
);
const nebulaSource = readFileSync(
  new URL("../src/Nebula.tsx", import.meta.url),
  "utf8",
);
const nebulaSceneSource = readFileSync(
  new URL("../public/nebula-scene/index.html", import.meta.url),
  "utf8",
);
const thoughtMapStoreSource = readFileSync(
  new URL("../src/thoughtMapStore.ts", import.meta.url),
  "utf8",
);

const CAST_KEYS = new Set([
  "fox", "bear", "cat", "owl", "rabbit", "penguin", "redpanda", "goat", "frog",
]);
const KNOWN_PRESETS = new Set(["career-35", "ai-math"]);
const MAX_SHARE_MATCH_ENTRIES = 6;

function encodeStance(stance) {
  return Math.round(Math.max(-1, Math.min(1, stance)) * 100);
}

function decodeStance(code) {
  if (!Number.isInteger(code) || code < -100 || code > 100) return null;
  return code / 100;
}

function validEntry(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (
    typeof value.preset !== "string" ||
    !KNOWN_PRESETS.has(value.preset) ||
    typeof value.version !== "string" ||
    !/^[a-z0-9-]{1,15}$/.test(value.version) ||
    !CAST_KEYS.has(value.cast) ||
    typeof value.stance !== "number" ||
    !Number.isFinite(value.stance)
  ) return null;
  return {
    preset: value.preset,
    version: value.version,
    cast: value.cast,
    stance: Math.max(-1, Math.min(1, value.stance)),
  };
}

function uniqueEntries(values) {
  const presets = new Set();
  const entries = [];
  values.forEach((value) => {
    const entry = validEntry(value);
    if (!entry || presets.has(entry.preset)) return;
    presets.add(entry.preset);
    entries.push(entry);
  });
  return entries.slice(0, MAX_SHARE_MATCH_ENTRIES);
}

function encodeMapEntry(entry) {
  return [
    entry.preset,
    entry.version,
    entry.cast,
    encodeStance(entry.stance),
  ].join("~");
}

function parseMapEntry(value) {
  const [preset, version, cast, stanceValue, ...rest] = value.split("~");
  if (rest.length || !/^-?\d{1,3}$/.test(stanceValue ?? "")) return null;
  const stance = decodeStance(Number(stanceValue));
  return stance === null
    ? null
    : validEntry({ preset, version, cast, stance });
}

function buildShareMatchUrl(origin, basePath, payload) {
  const base = basePath.endsWith("/") ? basePath : `${basePath}/`;
  const s = encodeStance(payload.stance);
  const entries = uniqueEntries([payload, ...(payload.entries ?? [])]);
  const additionalEntries = entries.filter(({ preset }) =>
    preset !== payload.preset
  );
  const mapQuery = additionalEntries.length
    ? `&m=${encodeURIComponent(additionalEntries.map(encodeMapEntry).join(","))}`
    : "";
  return `${origin}${base}match?preset=${encodeURIComponent(payload.preset)}` +
    `&version=${encodeURIComponent(payload.version)}` +
    `&cast=${encodeURIComponent(payload.cast)}` +
    `&s=${s}${mapQuery}`;
}

function parseShareMatchQuery(params) {
  const preset = params.get("preset");
  const version = params.get("version") ?? "";
  const cast = params.get("cast") ?? "";
  const stanceValue = params.get("s");

  if (!preset || !KNOWN_PRESETS.has(preset)) return null;
  if (!/^[a-z0-9-]{1,15}$/.test(version)) return null;
  if (!CAST_KEYS.has(cast)) return null;
  if (stanceValue === null || !/^-?\d{1,3}$/.test(stanceValue)) return null;
  const stanceCode = Number(stanceValue);
  const stance = decodeStance(stanceCode);
  if (stance === null) return null;

  const primary = { preset, version, cast, stance };
  const encodedMap = params.get("m");
  const mapEntries = encodedMap && encodedMap.length <= 768
    ? encodedMap
        .split(",")
        .slice(0, MAX_SHARE_MATCH_ENTRIES)
        .map(parseMapEntry)
        .filter(Boolean)
    : [];
  return { ...primary, entries: uniqueEntries([primary, ...mapEntries]) };
}

function stanceLabel(stance, axis) {
  if (stance < -0.2) return axis.left;
  if (stance > 0.2) return axis.right;
  return axis.center;
}

function describeMatchRelationship(axis, hostCastName, hostStance, guestStance) {
  const gap = Math.abs(hostStance - guestStance);
  const hostSide = stanceLabel(hostStance, axis);
  const guestSide = stanceLabel(guestStance, axis);
  const side = (stance) => stance < -0.2 ? -1 : stance > 0.2 ? 1 : 0;
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
assert.equal(stanceLabel(-0.2, axis), axis.center);
assert.equal(stanceLabel(-0.21, axis), axis.left);
assert.equal(stanceLabel(0.2, axis), axis.center);
assert.equal(stanceLabel(0.21, axis), axis.right);

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
  entries: [{
    preset: "ai-math",
    version: "20260912",
    cast: "fox",
    stance: 0.42,
  }],
});

const mapUrl = buildShareMatchUrl("https://soular.top", "/", {
  preset: "ai-math",
  version: "20260912",
  cast: "fox",
  stance: 0.42,
  entries: [
    {
      preset: "ai-math",
      version: "20260912",
      cast: "fox",
      stance: 0.42,
    },
    {
      preset: "career-35",
      version: "1",
      cast: "owl",
      stance: -0.38,
    },
  ],
});
assert.equal(
  mapUrl,
  "https://soular.top/match?preset=ai-math&version=20260912&cast=fox&s=42" +
    "&m=career-35~1~owl~-38",
);
assert.deepEqual(
  parseShareMatchQuery(new URL(mapUrl).searchParams)?.entries,
  [
    {
      preset: "ai-math",
      version: "20260912",
      cast: "fox",
      stance: 0.42,
    },
    {
      preset: "career-35",
      version: "1",
      cast: "owl",
      stance: -0.38,
    },
  ],
);

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
  parseShareMatchQuery(new URLSearchParams("preset=constructor&version=1&cast=fox&s=0")),
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
  productionSource,
  /function stanceLabel[\s\S]*stance < -0\.2[\s\S]*stance > 0\.2/,
  "朋友对照必须与星云使用相同的立场分界",
);
assert.match(
  peopleSource,
  /Object\.hasOwn\(NEBULA_PRESET_VERSIONS, preset\)/,
  "快照版本查询必须拒绝对象原型上的未知键",
);
assert.match(
  cardDrawSource,
  /const ok = legacyCopy\(text\)[\s\S]*setState\(ok \? "done" : "error"\)/,
  "复制操作必须在用户点击时同步完成并反馈结果",
);
assert.doesNotMatch(
  cardDrawSource,
  /navigator\.clipboard/,
  "复制操作不得排队到用户激活失效后再写入剪贴板",
);
assert.match(
  cardDrawSource,
  /activeElement\?\.focus\(\{ preventScroll: true \}\)/,
  "同步复制后必须恢复触发控件的键盘焦点",
);
assert.match(
  matchPageSource,
  /payload\.version !== currentVersion[\s\S]*分享链接已过期/,
  "对照页必须明确拒绝旧版快照链接",
);
assert.match(
  matchPageSource,
  /QUIZ_CHOICE_LOCK_MS[\s\S]*choiceLockedRef\.current[\s\S]*disabled=\{choiceLocked\}/,
  "朋友对照问卷必须阻止双击跨题提交",
);
assert.match(
  matchPageSource,
  /onClick=\{\(\) => \{\s*lockChoices\(\);\s*setPhase\("quiz"\)/,
  "朋友对照问卷入口必须阻止重复激活穿透到第一题",
);
assert.match(
  matchPageSource,
  /firstChoiceRef\.current\?\.focus\(\{ preventScroll: true \}\)[\s\S]*aria-live="polite"[\s\S]*ref=\{choiceIndex === 0 \? firstChoiceRef : undefined\}/,
  "朋友对照问卷换题后必须恢复键盘焦点并播报进度",
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
assert.match(
  appCssSource,
  /Paper orbit theme[\s\S]*\.match-cta\s*\{[^}]*width:\s*auto[^}]*min-width:\s*10rem/,
  "对照页操作必须使用自然宽度，不能退回满宽胶囊按钮",
);
assert.match(
  appCssSource,
  /\.draw-overlay--sheet\s*\{[^}]*align-items:\s*flex-start[^}]*overflow-y:\s*auto/,
  "短屏分享面板必须允许纵向滚动",
);
assert.match(
  cardDrawSource,
  /share-sheet__url-label">\{shareLinkLabel\}[\s\S]*share-sheet__url-label">对照链接/,
  "分享面板必须明确区分人格卡链接与对照链接",
);
assert.match(
  productionSource,
  /export type ShareMatchEntry[\s\S]*MAX_SHARE_MATCH_ENTRIES = 6[\s\S]*params\.get\("m"\)/,
  "朋友对照链接必须支持最多 6 个经过校验的共同问题坐标",
);
assert.match(
  productionSource,
  /export function summarizeThoughtMap[\s\S]*averageGap[\s\S]*alignedCount/,
  "共同思想地图必须基于多题结果生成可解释摘要",
);
assert.match(
  cardDrawSource,
  /readThoughtMapPositions[\s\S]*entries:\s*matchEntries/,
  "分享人格卡时必须附带当前账号已完成的共同问题坐标",
);
assert.match(
  thoughtMapStoreSource,
  /STORAGE_PREFIX = "jiupai:thought-map:v1:"[\s\S]*profile\.likedCount >= 3[\s\S]*nebulaPresetVersion\(profile\.preset\) === profile\.version/,
  "本地共同问题目录必须按账号隔离且只保留已解锁的当前快照",
);
assert.match(
  nebulaSceneSource,
  /type:\s*"nebula-self-profile-update"/,
  "星云完成表态后必须向 React 外壳同步当前题目坐标",
);
assert.match(
  nebulaSource,
  /data\?\.type === "nebula-self-profile-update"[\s\S]*rememberThoughtMapPosition/,
  "React 外壳必须校验并保存当前账号的题目坐标",
);
assert.match(
  matchPageSource,
  /type Phase = "intro" \| "quiz" \| "reveal" \| "map"/,
  "朋友对照流程必须包含累计地图阶段",
);
assert.match(
  matchPageSource,
  /共同思想地图[\s\S]*继续下一道共同问题[\s\S]*match-map__row/,
  "揭晓后必须能继续答题并查看共同思想地图",
);
assert.match(
  matchPageSource,
  /双方位置才会同时显现[\s\S]*match-invite__orbit[\s\S]*等待你回答[\s\S]*我也回答这题/,
  "共同思想地图必须明确只累计双方都回答过的问题",
);
assert.doesNotMatch(
  matchPageSource,
  /(?:local|session)Storage/,
  "公开对照页不得读取分享者或接收者浏览器存储",
);
assert.match(
  appCssSource,
  /--match-host:\s*#bf4330[\s\S]*--match-guest:\s*#31594f/,
  "共同思想地图必须定义朱红朋友与墨绿自己配色",
);
assert.match(
  appCssSource,
  /\.match-map__marker--host[\s\S]*\.match-map__marker--guest/,
  "共同思想地图必须保留朋友与自己双星位标记",
);

console.log("share match checks passed");
