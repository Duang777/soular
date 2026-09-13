import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  getNebulaLodProfile,
  NEBULA_PARTICLE_LAYER_SCHEMA,
  resolveDistanceLod,
  visibleParticleBudget,
} from "../public/nebula-scene/lod.js";

const source = readFileSync(
  new URL("../public/nebula-scene/index.html", import.meta.url),
  "utf8",
);

assert.equal(resolveDistanceLod(8.2, "medium"), "near");
assert.equal(resolveDistanceLod(8.8, "near"), "near");
assert.equal(resolveDistanceLod(9.3, "near"), "medium");
assert.equal(resolveDistanceLod(12.3, "far"), "far");
assert.equal(resolveDistanceLod(12.1, "far"), "medium");
assert.equal(resolveDistanceLod(13.4, "medium"), "far");
assert.equal(
  resolveDistanceLod(Number.NaN, "far"),
  "far",
  "无效距离不得触发画质抖动",
);

assert.deepEqual(
  ["near", "medium", "far"].map((tier) => getNebulaLodProfile(tier).avatarSize),
  [256, 128, 64],
  "相机拉近时必须恢复清晰头像纹理",
);
assert.deepEqual(
  ["near", "medium", "far"].map((tier) => getNebulaLodProfile(tier).bloomRatio),
  [1, 0.82, 0.62],
  "远景必须同步收敛非关键泛光开销",
);
assert.deepEqual(
  ["near", "medium", "far"].map((tier) => getNebulaLodProfile(tier).bloomEnabled),
  [true, true, false],
  "远景必须跳过 Bloom 后处理管线",
);

const fullQuality = {
  farStars: 5500,
  haloStars: 2500,
  armDust: 16000,
  brightDust: 2600,
};
assert.deepEqual(
  Object.values(NEBULA_PARTICLE_LAYER_SCHEMA),
  ["farStars", "haloStars", "armDust", "brightDust"],
  "粒子层注册与预算必须共享同一组键",
);
const nearBudget = visibleParticleBudget(fullQuality, "near");
const mediumBudget = visibleParticleBudget(fullQuality, "medium");
const farBudget = visibleParticleBudget(fullQuality, "far");

assert.equal(nearBudget.total, 26600);
assert.ok(
  nearBudget.total > mediumBudget.total && mediumBudget.total > farBudget.total,
  "观察距离增加时粒子预算必须逐级下降",
);
assert.ok(
  farBudget.armDust > farBudget.farStars,
  "远景仍须保留观点光谱主体，不能退化为离散头像墙",
);
assert.match(
  source,
  /points\.geometry\.setDrawRange\(0, Math\.min\(count, budget\[budgetKey\]\)\)/,
  "渲染器必须把距离预算应用到粒子 draw range",
);
assert.match(
  source,
  /avatarCanvas:\s*holder\.canvas[\s\S]*function applyAvatarTextureForLod[\s\S]*material\.map = canvasAvatarTexture\(holder\.canvas\)[\s\S]*previousTexture\.dispose\(\)/,
  "头像 LOD 必须只保留当前 Canvas 纹理并释放旧档位",
);
assert.doesNotMatch(
  source,
  /avatarTextures/,
  "头像不得为每位用户长期保留三级纹理副本",
);
assert.match(
  source,
  /avatarState === "error"[\s\S]*retry\.dataset\.retryAvatar/,
  "单个头像失败后必须提供局部重试",
);
assert.match(
  source,
  /function retryUserAvatar[\s\S]*avatarRetrySource\(/,
  "星云头像显式重试必须绕过浏览器负缓存",
);
assert.match(
  source,
  /AVATAR_LOAD_TIMEOUT_MS\s*=\s*8000[\s\S]*markAvatarError\(true\)[\s\S]*settleOnce\(\)/,
  "单头像请求超时后必须进入可重试降级并忽略迟到回调",
);
assert.match(
  source,
  /failedCardAvatarSources[\s\S]*resolvedCardAvatarSources[\s\S]*function cardAvatar[\s\S]*placeholderTexture\(name, ringColor, 128\)[\s\S]*retry\.dataset\.avatarRetry/,
  "观点阅读卡必须记住失败和恢复状态、复用固定占位并提供就地重试",
);
assert.match(
  source,
  /function setDomAvatarSource[\s\S]*avatarFallbackApplied[\s\S]*discovery-result-avatar[\s\S]*setDomAvatarSource/,
  "星云中的辅助头像入口也必须使用本地占位",
);
assert.match(
  source,
  /e\.target instanceof HTMLImageElement[\s\S]*console\.warn\("resource"/,
  "头像图片失败不得进入整页错误状态",
);

console.log("nebula LOD checks passed");
