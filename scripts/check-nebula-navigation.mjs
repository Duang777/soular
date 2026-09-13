import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import {
  buildNebulaShelfUrl,
  getNebulaLikeStorageKey,
  listNebulaPresets,
} from "../public/nebula-scene/presets.js";

const source = readFileSync(new URL("../public/nebula-scene/index.html", import.meta.url), "utf8");
const nebulaHostSource = readFileSync(new URL("../src/Nebula.tsx", import.meta.url), "utf8");
const cardSource = readFileSync(new URL("../src/CardDraw.tsx", import.meta.url), "utf8");
const shelfSource = readFileSync(new URL("../src/Shelf.tsx", import.meta.url), "utf8");
const portraitSource = readFileSync(new URL("../src/zhihuPortrait.ts", import.meta.url), "utf8");
const oauthAccountSource = readFileSync(new URL("../src/OAuthAccount.tsx", import.meta.url), "utf8");
const nebulaStageSource = readFileSync(new URL("../src/NebulaStage.tsx", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const homeSource = readFileSync(new URL("../src/Home.tsx", import.meta.url), "utf8");
const reactCatalogSource = readFileSync(new URL("../src/people.ts", import.meta.url), "utf8");
const homeSourceFile = ts.createSourceFile(
  "src/Home.tsx",
  homeSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const reactSourceFile = ts.createSourceFile(
  "src/people.ts",
  reactCatalogSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);
function unwrapExpression(expression) {
  let current = expression;
  while (
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isParenthesizedExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function staticStringProperty(object, name) {
  const property = object.properties.find((candidate) =>
    ts.isPropertyAssignment(candidate) &&
    (
      (ts.isIdentifier(candidate.name) && candidate.name.text === name) ||
      (ts.isStringLiteral(candidate.name) && candidate.name.text === name)
    )
  );
  assert.ok(property && ts.isPropertyAssignment(property), `首页快照缺少 ${name}`);
  const value = unwrapExpression(property.initializer);
  assert.ok(ts.isStringLiteral(value), `首页快照 ${name} 必须是静态字符串`);
  return value.text;
}

let homeCatalogInitializer = null;
for (const statement of homeSourceFile.statements) {
  if (!ts.isVariableStatement(statement)) continue;
  for (const declaration of statement.declarationList.declarations) {
    if (
      ts.isIdentifier(declaration.name) &&
      declaration.name.text === "QUESTION_PRESETS" &&
      declaration.initializer
    ) {
      const initializer = unwrapExpression(declaration.initializer);
      if (ts.isArrayLiteralExpression(initializer)) homeCatalogInitializer = initializer;
    }
  }
}
assert.ok(homeCatalogInitializer, "首页问题目录不存在");

let reactCatalogInitializer = null;
for (const statement of reactSourceFile.statements) {
  if (!ts.isVariableStatement(statement)) continue;
  for (const declaration of statement.declarationList.declarations) {
    if (
      ts.isIdentifier(declaration.name) &&
      declaration.name.text === "NEBULA_PRESET_VERSIONS" &&
      declaration.initializer &&
      ts.isObjectLiteralExpression(declaration.initializer)
    ) {
      reactCatalogInitializer = declaration.initializer;
    }
  }
}
assert.ok(reactCatalogInitializer, "React 快照版本目录不存在");
const reactCatalogEntries = reactCatalogInitializer.properties.map((property) => {
  assert.ok(ts.isPropertyAssignment(property), "React 快照目录只能包含静态属性");
  assert.ok(
    ts.isStringLiteral(property.name) || ts.isIdentifier(property.name),
    "React 快照 id 必须是静态字符串",
  );
  assert.ok(ts.isStringLiteral(property.initializer), "React 快照版本必须是静态字符串");
  return [property.name.text, property.initializer.text];
});
const reactCatalog = new Map(reactCatalogEntries);
assert.equal(
  reactCatalog.size,
  reactCatalogEntries.length,
  "React 快照版本目录不得包含重复 id",
);
assert.doesNotMatch(
  source,
  /\.innerHTML\s*=|insertAdjacentHTML\s*\(/,
  "观点快照内容不得通过 HTML 字符串渲染",
);
assert.match(
  source,
  /DISCOVERY_CACHE_TTL_MS\s*=\s*10\s*\*\s*60\s*\*\s*1000/,
  "热榜浏览器缓存必须在 10 分钟后失效",
);
assert.match(appSource, /path="\/" element=\{<Home \/>\}/, "首页必须保留人格卡与问题入口");
assert.match(source, /PERSONA_MIN_LIKES\s*=\s*3/, "人格必须在三次有效表态后解锁");
assert.match(
  source,
  /entryMode === "discover"\s*\|\|\s*entryMode === "confirm"\s*\|\|\s*entryMode === "explore"/,
  "星云必须支持发现、确认与探索入口态",
);
assert.match(
  source,
  /if \(entryEnabled\) \{\s*if \(entryMode !== "explore"\) \{[\s\S]*userGroup\.visible = false/,
  "探索态冷启动不得隐藏已生成的星云节点",
);
assert.match(
  source,
  /controls\.enabled = entryMode === "explore" \|\| !entryEnabled;[\s\S]*controls\.autoRotate =\s*\(entryMode === "explore" \|\| !entryEnabled\) && !reduceMotion/,
  "探索态冷启动必须恢复旋转和缩放控制",
);
assert.match(
  source,
  /id="cardsQuickEntry"[\s\S]*id="cardsQuickCount"/,
  "观点卡片必须作为星云常驻入口展示",
);
assert.match(
  source,
  /cardsQuickEntryBtn\.addEventListener\("click",\s*openCards\)/,
  "常驻观点卡片入口必须直接打开光谱阅读",
);
assert.doesNotMatch(
  source,
  /id="modeCards"/,
  "观点卡片入口不得继续隐藏在银河工具箱中",
);
assert.match(
  source,
  /function renderRecommendations\(\)[\s\S]*recommendationIndexes\(\)/,
  "推荐入口必须渲染当前星云中的观点",
);
assert.match(
  source,
  /Math\.abs\(left\.stance\)[\s\S]*rankedByStance\[0\]\?\.index[\s\S]*rankedByStance\[rankedByStance\.length - 1\]\?\.index/,
  "无点赞推荐必须按实际立场选择两端与中点",
);
assert.match(
  source,
  /function renderHotFallback\(\)[\s\S]*availablePresets/,
  "热榜接口不可用时必须回退已发布星云",
);
assert.match(
  source,
  /personMatches[\s\S]*person\[3\]/,
  "站内搜索必须覆盖观点正文",
);
assert.doesNotMatch(
  source,
  /getElementById\("(?:clashBtn|circleBtn)"\)\.disabled/,
  "未解锁的碰撞与圈子入口必须保持可点击并说明门槛",
);
assert.match(
  source,
  /if \(wasUnlocked && !personaUnlocked\(\)\) \{\s*hideChip\(\);\s*if \(focusSet\) exitFocus\(\);\s*\}/,
  "点赞降到三次以下时必须退出已有的小圈子聚焦态",
);
assert.match(
  source,
  /function resetLikes\(\)[\s\S]*hideChip\(\);\s*if \(focusSet\) exitFocus\(\);[\s\S]*applyStance\(true\)/,
  "清空全部点赞时必须退出已有的小圈子聚焦态",
);
assert.match(
  source,
  /function returnToPersonaHome\(\)[\s\S]*type:\s*"nebula-entry-back"/,
  "星云确认页必须把返回动作通知 React 外壳",
);
assert.match(
  source,
  /getElementById\("entryBack"\)\.addEventListener\("click",\s*returnToPersonaHome\)/,
  "确认页次按钮必须真正返回人格卡首页",
);
assert.match(
  source,
  /getElementById\("entryHomeBack"\)\.addEventListener\("click",\s*returnToPersonaHome\)/,
  "确认页顶部返回入口必须真正返回人格卡首页",
);
assert.match(
  source,
  /id="sceneBack"[\s\S]*返回问题/,
  "生成后的星云必须提供返回问题确认页入口",
);
assert.match(
  source,
  /getElementById\("sceneBack"\)\.addEventListener\("click",\s*showEntryConfirmFromScene\)/,
  "星云返回入口必须恢复问题确认态",
);
assert.match(
  source,
  /function prepareEntryGenerationScene\(\)[\s\S]*composer\.render\(\)/,
  "生成动画揭开覆盖层前必须同步绘制暗场",
);
assert.match(
  source,
  /function startEntryGeneration\(\)\s*\{\s*prepareEntryGenerationScene\(\);\s*setEntryState\("generating"\)/,
  "生成流程必须先准备暗场再切换覆盖层",
);
assert.match(
  source,
  /setEntryGenerationCopy\(0\);\s*entryGenerationStartedAt = performance\.now\(\);/,
  "暗场同步绘制后必须立即启动生成计时",
);
assert.match(
  nebulaHostSource,
  /data\?\.type === "nebula-entry-back"[\s\S]*if \(fromPersonaHome\) navigate\(-1\);[\s\S]*navigate\("\/",\s*\{\s*replace:\s*true\s*\}\)/,
  "React 外壳必须返回来源首页，并为直接链接提供首页兜底",
);
assert.match(
  nebulaHostSource,
  /if \(selfOpenPendingRef\.current\) return;\s*selfOpenPendingRef\.current = true;/,
  "自我人格卡打开操作必须防止重复导航",
);
assert.match(
  source,
  /type:\s*"nebula-entry-explore"[\s\S]*preset:\s*PRESET\.id/,
  "生成完成后必须通知 React 外壳同步探索态 URL",
);
assert.match(
  nebulaHostSource,
  /data\?\.type === "nebula-entry-explore"[\s\S]*searchParams\.set\("explore",\s*"1"\)[\s\S]*history\.replaceState/,
  "React 外壳必须将生成后的父 URL 替换为探索态",
);
assert.match(
  nebulaHostSource,
  /searchParams\.get\("explore"\) === "1"\s*\?\s*"explore"/,
  "刷新探索态 URL 时 React 外壳必须恢复 iframe 的探索状态",
);
assert.match(
  nebulaStageSource,
  /entryState\?:\s*"discover"\s*\|\s*"confirm"\s*\|\s*"explore"\s*\|\s*null/,
  "星云 iframe 契约必须支持显式探索状态",
);
assert.match(
  nebulaHostSource,
  /data\.entry === "confirm"[\s\S]*entryState === "explore"[\s\S]*explore=1/,
  "探索态切换快照时必须保留 explore=1",
);
assert.doesNotMatch(
  nebulaHostSource,
  /state:\s*persistedProfile\s*\?\s*\{\s*selfProfile:/,
  "自我人格数据不得留在可由浏览器返回恢复的 history state 中",
);
assert.match(
  nebulaHostSource,
  /function createNavigationContextKey\(\)[\s\S]*typeof crypto\.randomUUID === "function"[\s\S]*crypto\.getRandomValues/,
  "导航上下文 key 必须兼容不支持 randomUUID 的浏览器",
);
assert.match(
  source,
  /function stageStandaloneContext\(kind, value\)[\s\S]*typeof crypto\.randomUUID === "function"[\s\S]*crypto\.getRandomValues/,
  "独立星云场景必须兼容不支持 randomUUID 的浏览器",
);
assert.match(
  nebulaHostSource,
  /const profileKey = createNavigationContextKey\(\);\s*if \(profileKey\) \{[\s\S]*stageTransientSelfProfile\(profileKey, profile\);[\s\S]*storeNavigationContext\("self", persistedProfile, profileKey\)/,
  "临时画像上下文不得依赖 Session Storage 写入成功",
);
assert.match(
  shelfSource,
  /fetchZhihuAccountStatus\([\s\S]*addEventListener\("focus",\s*refreshWhenVisible\)[\s\S]*addEventListener\("visibilitychange",\s*refreshWhenVisible\)/,
  "人格卡页必须在挂载和重新可见时复查账号版本",
);
assert.match(
  shelfSource,
  /fetchZhihuPortrait[\s\S]*portrait\.accountVersion !== accountVersion[\s\S]*storedSelfProfile\.accountVersion === verifiedAccountVersion/,
  "人格卡页只能展示已绑定当前账号版本的临时画像",
);
assert.doesNotMatch(
  source,
  /new AbortController\(|discoveryController/,
  "发现面板不得取消可能仍由服务端共享的上游请求",
);
assert.match(
  nebulaHostSource,
  /type:\s*"nebula-user-profile"/,
  "React 外壳必须把已校验的登录头像发送给星云",
);
assert.match(
  source,
  /e\.data\.type === "nebula-user-profile"/,
  "星云必须接收登录头像消息",
);
assert.match(
  source,
  /identityRevision[\s\S]*hideChip\(\)[\s\S]*closeClash\(\)[\s\S]*exitFocus\(\)/,
  "账号身份变化时必须关闭画像相关的圈子、碰撞和聚焦结果",
);
assert.match(
  source,
  /function setMeAvatar\(value\)[\s\S]*DEFAULT_ME_AVATAR[\s\S]*replaceUserAvatarWithPlaceholder/,
  "登录头像清空时必须立即恢复本地默认头像",
);
assert.match(
  source,
  /safeUserAvatarUrl/,
  "星云必须在使用登录头像前校验 URL",
);
assert.match(
  portraitSource,
  /fetch\("\/api\/me\/portrait"/,
  "正式前端必须通过同源画像接口读取个性化信号",
);
assert.match(
  portraitSource,
  /fetch\("\/api\/oauth\/profile"/,
  "公开资料恢复必须独立于 OAuth 状态查询",
);
assert.match(
  nebulaHostSource,
  /toNebulaPortraitSignal\(portrait\)/,
  "React 外壳必须只向星云发送裁剪后的画像信号",
);
assert.match(
  nebulaHostSource,
  /portrait\.accountVersion !== accountVersion/,
  "星云必须拒绝其他账号版本的画像",
);
assert.match(
  nebulaHostSource,
  /identityRevision:/,
  "React 外壳必须用不透明修订号通知 iframe 账号身份变化",
);
assert.match(
  nebulaHostSource,
  /addEventListener\("visibilitychange",\s*refreshWhenVisible\)/,
  "标签重新可见时必须复查账号版本",
);
assert.match(
  source,
  /interest:\s*portraitInterest\(\)/,
  "自我人格必须携带经过校验的兴趣底色",
);
assert.match(
  source,
  /stanceScore \* 0\.82 \+ interest\.score \* 0\.18/,
  "匹配必须以本题立场为主、画像兴趣为辅",
);
assert.match(source, /id="matchSame"/, "匹配流程必须提供同频模式");
assert.match(source, /id="matchOpposite"/, "匹配流程必须提供互补模式");
assert.match(
  cardSource,
  /知乎兴趣底色/,
  "人格卡必须解释画像提供的兴趣底色",
);
assert.match(
  oauthAccountSource,
  /statusRequestSequenceRef[\s\S]*statusRequestSequenceRef\.current \+= 1[\s\S]*statusRequestControllerRef\.current\?\.abort\(\)/,
  "退出登录前必须使全部在途状态请求失效",
);
assert.match(
  oauthAccountSource,
  /accountChanged[\s\S]*setPortrait\(null\)/,
  "切换账号时必须立即清空旧画像",
);
assert.doesNotMatch(
  source,
  /trailMat|ME_LANE_[YZ]/,
  "“我”节点不得保留穿过头像的立场尾迹",
);

const path = "goat?self=1&preset=ai-math&version=20260912";

assert.equal(
  buildNebulaShelfUrl(
    { protocol: "file:" },
    "file:///project/public/nebula-scene/index.html",
    path,
  ),
  "https://soular.top/shelf/goat?self=1&preset=ai-math&version=20260912",
);
assert.equal(
  buildNebulaShelfUrl(
    { protocol: "https:" },
    "https://example.test/soular/nebula-scene/index.html",
    path,
  ),
  "https://example.test/soular/shelf/goat?self=1&preset=ai-math&version=20260912",
);

const likeStorageKeys = new Set();
const staticPresets = listNebulaPresets();
const homePresets = homeCatalogInitializer.elements.map((element) => {
  const value = unwrapExpression(element);
  assert.ok(ts.isObjectLiteralExpression(value), "首页问题目录只能包含静态对象");
  const detail = staticStringProperty(value, "detail");
  const answerCount = detail.match(/^(\d+) 个观点$/);
  assert.ok(answerCount, "首页问题数量必须使用“数字 个观点”格式");
  return {
    id: staticStringProperty(value, "id"),
    serial: staticStringProperty(value, "serial"),
    kind: staticStringProperty(value, "kind"),
    question: staticStringProperty(value, "title"),
    answerCount: Number(answerCount[1]),
  };
});
for (const preset of staticPresets) {
  assert.match(preset.id, /^[a-z0-9-]{1,48}$/);
  assert.match(preset.version, /^[a-z0-9-]{1,15}$/);
  const likeStorageKey = getNebulaLikeStorageKey(preset);
  assert.ok(`${preset.id}:${preset.version}`.length <= 64);
  assert.ok(!likeStorageKeys.has(likeStorageKey), "快照点赞存储键必须唯一");
  likeStorageKeys.add(likeStorageKey);
}
assert.deepEqual(
  homePresets.slice().sort((left, right) => left.id.localeCompare(right.id)),
  staticPresets.map(({ id, serial, kind, question, answerCount }) => ({
    id,
    serial,
    kind: kind === "real" ? "真实讨论" : "示例星云",
    question,
    answerCount,
  })).sort((left, right) => left.id.localeCompare(right.id)),
  "首页问题入口必须与静态快照目录双向一致",
);
assert.deepEqual(
  [...reactCatalog.entries()].sort(([left], [right]) => left.localeCompare(right)),
  staticPresets
    .map(({ id, version }) => [id, version])
    .sort(([left], [right]) => left.localeCompare(right)),
  "React 与静态场景的快照版本目录必须双向一致",
);

console.log("nebula navigation checks passed");
