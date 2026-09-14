import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";
import {
  buildNebulaShelfUrl,
  getNebulaPreset,
  getNebulaLikeStorageKey,
  listNebulaPresets,
} from "../public/nebula-scene/presets.js";
import { AI_PROGRAMMER_JOBS } from "../public/nebula-scene/preset-ai-programmer-jobs.js";
import { CITY_OR_HOMETOWN } from "../public/nebula-scene/preset-city-or-hometown.js";
import { SCHOLARS_AI_MATH } from "../public/nebula-scene/preset-scholars-ai-math.js";
import { SOCIAL_CONNECTIONS } from "../public/nebula-scene/preset-social-connections.js";
import {
  buildPersonaCatalog,
  cyclePersonaIndex,
} from "../public/nebula-scene/persona-browser.js";

const source = readFileSync(new URL("../public/nebula-scene/index.html", import.meta.url), "utf8");
const presetRegistrySource = readFileSync(
  new URL("../public/nebula-scene/presets.js", import.meta.url),
  "utf8",
);
const nebulaHostSource = readFileSync(new URL("../src/Nebula.tsx", import.meta.url), "utf8");
const identityRevisionSource = readFileSync(new URL("../src/identityRevision.ts", import.meta.url), "utf8");
const cardSource = readFileSync(new URL("../src/CardDraw.tsx", import.meta.url), "utf8");
const shelfSource = readFileSync(new URL("../src/Shelf.tsx", import.meta.url), "utf8");
const portraitSource = readFileSync(new URL("../src/zhihuPortrait.ts", import.meta.url), "utf8");
const oauthAccountSource = readFileSync(new URL("../src/OAuthAccount.tsx", import.meta.url), "utf8");
const nebulaStageSource = readFileSync(new URL("../src/NebulaStage.tsx", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const homeSource = readFileSync(new URL("../src/Home.tsx", import.meta.url), "utf8");
const reactCatalogSource = readFileSync(new URL("../src/people.ts", import.meta.url), "utf8");
const presetMetaSource = readFileSync(new URL("../src/presetMeta.ts", import.meta.url), "utf8");
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
const presetMetaSourceFile = ts.createSourceFile(
  "src/presetMeta.ts",
  presetMetaSource,
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

function assertConcurrentImports(sourceText, expectedPaths, label) {
  const promiseAllGroups = [
    ...sourceText.matchAll(/Promise\.all\(\s*\[([\s\S]*?)\]\s*\)/g),
  ].map((match) => match[1]);
  assert.ok(
    promiseAllGroups.some((group) =>
      expectedPaths.every((path) => group.includes(path))
    ),
    `${label} 必须并发加载，避免每次返回星云时形成串行网络瀑布`,
  );
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
let reactAnswerCountInitializer = null;
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
    if (
      ts.isIdentifier(declaration.name) &&
      declaration.name.text === "NEBULA_PRESET_ANSWER_COUNTS" &&
      declaration.initializer &&
      ts.isObjectLiteralExpression(declaration.initializer)
    ) {
      reactAnswerCountInitializer = declaration.initializer;
    }
  }
}
assert.ok(reactCatalogInitializer, "React 快照版本目录不存在");
assert.ok(reactAnswerCountInitializer, "React 快照人数目录不存在");
let presetMetaInitializer = null;
for (const statement of presetMetaSourceFile.statements) {
  if (!ts.isVariableStatement(statement)) continue;
  for (const declaration of statement.declarationList.declarations) {
    if (
      ts.isIdentifier(declaration.name) &&
      declaration.name.text === "PRESET_META" &&
      declaration.initializer
    ) {
      const initializer = unwrapExpression(declaration.initializer);
      if (ts.isObjectLiteralExpression(initializer)) presetMetaInitializer = initializer;
    }
  }
}
assert.ok(presetMetaInitializer, "朋友对照快照元数据目录不存在");
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
const presetMetaIds = presetMetaInitializer.properties.map((property) => {
  assert.ok(ts.isPropertyAssignment(property), "朋友对照快照元数据只能包含静态属性");
  assert.ok(
    ts.isStringLiteral(property.name) || ts.isIdentifier(property.name),
    "朋友对照快照 id 必须是静态字符串",
  );
  return property.name.text;
});
const reactAnswerCounts = new Map(
  reactAnswerCountInitializer.properties.map((property) => {
    assert.ok(ts.isPropertyAssignment(property), "React 快照人数目录只能包含静态属性");
    assert.ok(
      ts.isStringLiteral(property.name) || ts.isIdentifier(property.name),
      "React 快照人数 id 必须是静态字符串",
    );
    assert.ok(ts.isNumericLiteral(property.initializer), "React 快照人数必须是静态数字");
    return [property.name.text, Number(property.initializer.text)];
  }),
);
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
assertConcurrentImports(
  source,
  [
    "./presets.js",
    "./peer-discovery.js",
    "./lod.js",
    "./persona-browser.js",
  ],
  "星云功能模块",
);
assertConcurrentImports(
  presetRegistrySource,
  [
    "./preset-ai-math.js",
    "./preset-scholars-ai-math.js",
    "./preset-social-connections.js",
    "./preset-ai-programmer-jobs.js",
    "./preset-city-or-hometown.js",
  ],
  "星云快照模块",
);
assert.match(
  appSource,
  /<Routes location=\{backgroundLocation \?\? location\}>[\s\S]*backgroundLocation && \([\s\S]*<Route path="\/shelf\/:cast"/,
  "星云进入人格卡时必须保留背景路由，返回时不得重建 iframe",
);
assert.equal(
  nebulaHostSource.match(/backgroundLocation:\s*location/g)?.length,
  2,
  "自我和回答者人格卡导航都必须保留当前星云位置",
);
assert.match(
  nebulaHostSource,
  /type:\s*"nebula-host-visibility",\s*visible:\s*active/,
  "星云背景路由必须通知 iframe 暂停或恢复渲染",
);
assert.match(
  nebulaHostSource,
  /if \(active\) selfOpenPendingRef\.current = false;/,
  "返回保留的星云后必须允许再次打开自我人格卡",
);
assert.match(
  source,
  /type === "nebula-host-visibility"[\s\S]*running = nextRunning/,
  "星云 iframe 必须响应宿主可见性变化",
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
  /id="observatoryControls"[\s\S]*id="randomDiscover"[\s\S]*id="followedOnly"[\s\S]*id="locateMe"[\s\S]*id="resetView"/,
  "星云必须提供随机发现、只看关注、我的位置和重置视角控制",
);
const journeyActionsStart = source.indexOf('<nav class="journey-actions"');
const journeyActionsEnd = source.indexOf("</nav>", journeyActionsStart);
const exploreMenuStart = source.indexOf('<div class="explore-menu"');
const exploreMenuEnd = source.indexOf(
  '<button type="button" class="explore-toggle"',
  exploreMenuStart,
);
assert.ok(journeyActionsStart >= 0 && journeyActionsEnd > journeyActionsStart, "星云主界面必须提供探索快捷入口");
assert.ok(exploreMenuStart >= 0 && exploreMenuEnd > exploreMenuStart, "知乎发现面板结构不存在");
const journeyActionsSource = source.slice(journeyActionsStart, journeyActionsEnd);
const exploreMenuSource = source.slice(exploreMenuStart, exploreMenuEnd);
for (const id of ["guideBtn", "peerDiscoveryBtn", "clashBtn", "circleBtn"]) {
  assert.match(journeyActionsSource, new RegExp(`id="${id}"`), `${id} 必须常驻在星云主界面`);
  assert.doesNotMatch(exploreMenuSource, new RegExp(`id="${id}"`), `${id} 不得继续藏在知面板内`);
}
assert.doesNotMatch(source, /盒内隐藏功能/, "星云不得再把核心探索能力标记为盒内隐藏功能");
assert.match(
  source,
  /@media \(max-width: 900px\)[\s\S]*\.journey-actions \{[\s\S]*flex-direction: row/,
  "移动端探索快捷入口必须横向排列",
);
assert.match(
  journeyActionsSource,
  /id="peerDiscoveryHint">点 ♡ 赞同 · 差 3 个/,
  "锁定的发现入口必须直接说明如何完成表态",
);
assert.doesNotMatch(
  journeyActionsSource,
  /aria-disabled="true"/,
  "可打开表态指引的锁定入口不得向辅助技术声明为不可操作",
);
assert.match(
  source,
  /function renderStanceGuide\(\)[\s\S]*"如何表态"[\s\S]*"选择你认同的观点，点击右侧「♡ 赞同」/,
  "观点阅读流必须展示可执行的表态指引",
);
assert.match(
  source,
  /function guideToStance\(featureLabel\)[\s\S]*openCards\("\.pcard-like:not\(\.is-liked\)"\)[\s\S]*showToast\(`点观点卡右侧「♡ 赞同」完成表态/,
  "点击锁定能力必须打开观点阅读流并聚焦未赞同按钮",
);
assert.match(
  source,
  /function openPeerDiscovery\(\)[\s\S]*guideToStance\("同频发现"\)[\s\S]*function openClash\(\)[\s\S]*guideToStance\("观点碰撞"\)[\s\S]*guideToStance\("聚焦小圈子"\)/,
  "同频、碰撞和圈子入口必须复用同一表态引导",
);
assert.match(
  source,
  /on \? "♥ 已赞同" : "♡ 赞同"[\s\S]*"赞同这个观点，完成一次表态"/,
  "观点卡按钮必须使用可见文案说明表态动作",
);
assert.match(
  source,
  /const personOpen = uiNode\(\s*"button",\s*"pcard-person-open",\s*"看卡片 →",\s*\)[\s\S]*personOpen\.dataset\.personOpen = String\(i\)/,
  "回答者观点必须提供明确的人格卡入口",
);
assert.doesNotMatch(
  source,
  /article\.tabIndex = 0;[\s\S]{0,160}article\.setAttribute\("role", "link"\)/,
  "回答者观点整行不得伪装成人格卡链接",
);
assert.match(
  source,
  /const personOpen = e\.target\.closest\("\[data-person-open\]"\);[\s\S]*openPerson\(Number\(personOpen\.getAttribute\("data-person-open"\)\)\)/,
  "人格卡只能由明确的查看按钮打开",
);
assert.doesNotMatch(
  source,
  /const card = e\.target\.closest\("\.pcard\[data-u\]"\);[\s\S]{0,120}openPerson/,
  "点击观点正文不得打开回答者人格卡",
);
assert.match(
  source,
  /\.cards-layout\s*\{[\s\S]*grid-template-rows:\s*minmax\(0,\s*1fr\)[\s\S]*overflow:\s*hidden/,
  "桌面观点阅读区必须约束网格行高，避免列表伸出可视区域",
);
assert.match(
  source,
  /function routeCardsWheel\(event\)[\s\S]*window\.innerWidth < 1100[\s\S]*event\.target\.closest\("\.cards-list"\)[\s\S]*cardsListEl\.scrollBy\(\{ top: event\.deltaY \}\)/,
  "桌面观点阅读区必须把非列表区域的纵向滚轮转发给观点列表",
);
assert.match(
  source,
  /cardsEl\.addEventListener\("wheel", routeCardsWheel, \{ passive: false \}\)/,
  "桌面观点阅读区必须注册可阻止页面丢失滚轮的监听器",
);
assert.match(
  source,
  /<canvas id="scene" tabindex="0" aria-label="观点星云交互画布"><\/canvas>/,
  "星云画布必须提供可聚焦的键盘操作入口",
);
assert.match(
  source,
  /<div id="tip" role="region" aria-live="polite" aria-label="当前观点" tabindex="-1"><\/div>/,
  "键盘定位后的观点必须提供可聚焦的辅助技术反馈",
);
assert.match(
  source,
  /<div class="toast" id="toast" role="status" aria-live="polite" aria-atomic="true"><\/div>/,
  "观测控制反馈必须向辅助技术播报",
);
assert.match(
  source,
  /tip\.classList\.remove\("show"\);\s*if \(tip\.contains\(document\.activeElement\)\) \{\s*canvas\.focus\(\{ preventScroll: true \}\)/,
  "关闭键盘定位观点后必须把焦点恢复到星云画布",
);
assert.match(
  source,
  /function scheduleHideTip\(ms\)[\s\S]*setTimeout\(\(\) => \{\s*setHovered\(null\);[\s\S]*projected\.z < -1 \|\| projected\.z > 1\) \{\s*setHovered\(null\);/,
  "观点浮层的所有自动关闭路径必须恢复键盘焦点",
);
assert.match(
  source,
  /const restoreLikeFocus = tip\.contains\(document\.activeElement\)[\s\S]*renderTip\(hovered\)[\s\S]*tip\.querySelector\("\[data-like\]"\)\?\.focus\(\{ preventScroll: true \}\)/,
  "键盘点赞重绘观点浮层后必须恢复按钮焦点",
);
assert.match(
  source,
  /function randomDiscover\(animate, focusTip = false\)[\s\S]*user\.index !== lastRandomIndex[\s\S]*focusUser\(user, animate, focusTip\)/,
  "随机发现必须避开连续命中同一回答者并定位到目标",
);
assert.match(
  source,
  /const dimmedByFollow = followedOnly && !u\.isMe && !u\.followed/,
  "只看关注必须淡出未关注回答者并保留我的星位",
);
assert.match(
  source,
  /followedOnly[\s\S]*matchedUser[\s\S]*!matchedUser\.followed[\s\S]*cancelCameraTransition\(\)[\s\S]*matchIndex = -1[\s\S]*cameraFocusUser[\s\S]*moveCamera\(defaultCameraTarget, defaultCameraPosition, true/,
  "只看关注必须取消已被过滤回答者的定位、高亮并恢复全景",
);
const autoRotateScheduler = source.match(
  /function scheduleAutoRotate\(delay = 5000\) \{[\s\S]*?\n\s*\}\n\s*function moveCamera/,
)?.[0];
assert.ok(autoRotateScheduler, "自动旋转恢复逻辑不存在");
assert.doesNotMatch(
  autoRotateScheduler,
  /cameraFocusUser\s*=/,
  "自动旋转仍围绕目标用户时不得遗失相机焦点状态",
);
assert.match(
  source,
  /function resetObservation\(animate\)[\s\S]*setFollowedOnly\(false, false\)[\s\S]*moveCamera\(defaultCameraTarget, defaultCameraPosition[\s\S]*controls\.autoRotate = !reduceMotion/,
  "重置视角必须恢复默认相机、筛选和自动旋转",
);
assert.match(
  source,
  /function openClash\(\)[\s\S]*setFollowedOnly\(false, false\)[\s\S]*clashEl\.classList\.add\("show"\)/,
  "观点碰撞必须退出只看关注，避免选中已淡出的回答者",
);
assert.match(
  source,
  /function focusCluster\(c\)[\s\S]*setHovered\(null\)[\s\S]*matchIndex = -1[\s\S]*moveCamera\(defaultCameraTarget, defaultCameraPosition, true/,
  "小圈子聚焦必须清理旧人物定位并恢复全景",
);
assert.match(
  source,
  /event\.key === "ArrowLeft"[\s\S]*event\.key === "ArrowRight"[\s\S]*event\.key === "ArrowUp"[\s\S]*event\.key === "ArrowDown"[\s\S]*event\.key === "\+"[\s\S]*event\.key === "-"/,
  "星云必须支持方向键旋转和加减号缩放",
);
assert.match(
  source,
  /const pressedNavigationKeys = new Set\(\)[\s\S]*function updateKeyboardCamera\(delta\)[\s\S]*THREE\.MathUtils\.damp/,
  "键盘相机运动必须在渲染帧内按时间阻尼更新",
);
assert.match(
  source,
  /updateKeyboardCamera\(delta\);\s*if \(sceneControlsAvailable\(\)\) \{\s*updateCameraTransition\(performance\.now\(\)\);\s*controls\.update\(\);/,
  "键盘相机运动必须接入渲染帧，且不可观测时不得推进相机过渡或 OrbitControls 阻尼",
);
assert.match(
  source,
  /function navigationKeyForEvent\(event\)[\s\S]*return "ZoomIn"[\s\S]*return "ZoomOut"[\s\S]*pressedNavigationKeys\.add\(navigationKey\)[\s\S]*addEventListener\("keyup"[\s\S]*pressedNavigationKeys\.delete\(navigationKey\)/,
  "方向和缩放键必须维护按住状态并在松开时停止加速",
);
assert.match(
  source,
  /let frameScheduled = false[\s\S]*if \(frameScheduled\) return[\s\S]*frameScheduled = false;\s*loop\(\)[\s\S]*visibilitychange[\s\S]*scheduleFrame\(\)/,
  "页面恢复可见时不得创建重复的渲染循环",
);
assert.match(
  source,
  /if \(!controlsAvailable\)[\s\S]*cancelCameraTransition\(\)[\s\S]*controls\.autoRotate = false[\s\S]*if \(!sceneControlsWereAvailable\)[\s\S]*scheduleAutoRotate\(\)/,
  "弹层打开时必须暂停相机运动，关闭后恢复自动旋转",
);
assert.match(
  source,
  /function sceneControlsAvailable\(\)[\s\S]*!guideEl\.classList\.contains\("show"\)/,
  "星图向导打开时必须暂停星云观测控制",
);
assert.match(
  source,
  /Math\.min\(\s*anchor\.getBoundingClientRect\(\)\.top,\s*observatoryControlsEl\.getBoundingClientRect\(\)\.top[\s\S]*--mobile-panel-clearance/,
  "移动端浮层必须避开观测控制条",
);
assert.match(
  source,
  /if \(user\.isMe && user\.group\.parent\)[\s\S]*target\.x = user\.baseX[\s\S]*localToWorld\(target\)/,
  "定位我的位置必须使用星位漂移的最终横坐标",
);
assert.match(
  source,
  /const matchOpacity = reduceMotion \? 0\.9[\s\S]*reduceMotion \? 1\.08/,
  "减少动态效果下匹配高亮不得持续脉动",
);
assert.match(
  source,
  /randomDiscover\(true, event\.detail === 0\)[\s\S]*focusUser\(meUser, true, event\.detail === 0\)[\s\S]*randomDiscover\(true, true\)/,
  "按钮和空格键定位必须把观点反馈交给键盘用户",
);
assert.match(
  source,
  /duration: 640[\s\S]*const eased = progress \* progress \* \(3 - 2 \* progress\)/,
  "相机定位必须使用平滑起止的过渡曲线",
);
const keyboardResponse = source.match(
  /const response = hasInput \? ([\d.]+) : ([\d.]+);/,
);
const keyboardHorizontalSpeed = source.match(
  /horizontal \* ([\d.]+),\s*response,\s*delta/,
);
assert.ok(keyboardResponse && keyboardHorizontalSpeed, "必须能够读取键盘相机阻尼参数");
const activeResponse = Number(keyboardResponse[1]);
const idleResponse = Number(keyboardResponse[2]);
const horizontalSpeed = Number(keyboardHorizontalSpeed[1]);
let keyboardVelocity = 0;
const keyboardFrameSteps = [];
for (let frame = 0; frame < 120; frame += 1) {
  const pressed = frame < 60;
  const response = pressed ? activeResponse : idleResponse;
  const target = pressed ? horizontalSpeed : 0;
  keyboardVelocity =
    target + (keyboardVelocity - target) * Math.exp(-response / 60);
  keyboardFrameSteps.push(Math.abs(keyboardVelocity / 60));
}
const maxKeyboardFrameStep = Math.max(...keyboardFrameSteps);
assert.ok(
  keyboardFrameSteps[0] < maxKeyboardFrameStep * 0.25,
  "键盘相机首帧必须平缓加速",
);
assert.ok(
  maxKeyboardFrameStep < 0.014,
  "键盘相机在 60 fps 下单帧旋转不得产生明显跳步",
);
assert.ok(
  keyboardFrameSteps.at(-1) < 0.00001,
  "松开方向键后相机速度必须平滑衰减至静止",
);
assert.match(
  source,
  /e\.key === "r" \|\| e\.key === "R"[\s\S]*resetObservation\(true\)/,
  "星云必须支持 R 重置视角",
);
assert.match(
  source,
  /e\.key === " " \|\| e\.key === "Space" \|\| e\.code === "Space"[\s\S]*randomDiscover\(true, true\)/,
  "星云必须支持空格随机发现",
);
assert.match(
  source,
  /id="cardsQuickEntry"[\s\S]*id="cardsQuickCount"/,
  "观点卡片必须作为星云常驻入口展示",
);
assert.match(
  source,
  /cardsQuickEntryBtn\.addEventListener\("click",\s*\(\) => openCards\(\)\)/,
  "常驻观点卡片入口必须直接打开光谱阅读",
);
assert.doesNotMatch(
  source,
  /id="modeCards"/,
  "观点卡片入口不得继续隐藏在银河工具箱中",
);
assert.match(
  source,
  /id="personaFilters"/,
  "观点阅读必须提供人格筛选入口",
);
assert.match(
  source,
  /id="personaDeckOpen"/,
  "观点阅读必须提供人格卡群入口",
);
assert.match(
  source,
  /id="personaQuickEntry"[\s\S]*id="personaQuickCount"/,
  "主星云必须常驻展示本题人格卡群入口",
);
assert.match(
  source,
  /personaQuickEntryBtn\.addEventListener\("click",\s*openPersonaDeck\)/,
  "主星云人格入口必须直接打开人格卡群",
);
assert.match(
  source,
  /body\.is-circle-open \.persona-quick-entry,[\s\S]*body\.is-circle-open \.cards-quick-entry/,
  "小圈子结果显示时必须隐藏右侧常驻入口",
);
assert.match(
  source,
  /function showChip\(c\)[\s\S]*classList\.add\("is-circle-open"\)[\s\S]*function hideChip\(\)[\s\S]*classList\.remove\("is-circle-open"\)/,
  "小圈子结果的打开和关闭必须同步页面占用状态",
);
assert.match(
  source,
  /personaDimmed\s*=\s*Boolean\(personaFilter\)[\s\S]*u\.castKey\s*!==\s*personaFilter/,
  "人格筛选必须淡出其他人格星体而不是移除节点",
);
assert.match(
  source,
  /看看这一派怎么说[\s\S]*read\.dataset\.personaRead[\s\S]*回到整体[\s\S]*clear\.dataset\.personaClear/,
  "人格卡群必须提供阅读当前人格与回到整体的操作",
);
assert.match(
  source,
  /if \(e\.target\.closest\("\[data-persona-read\]"\)\) \{[\s\S]*setCardFilter\("all"\);[\s\S]*cardsSearchEl\.value = "";/,
  "阅读当前人格必须清除会掩盖该人格的次级筛选与搜索",
);
assert.match(
  source,
  /function openCards\(focusSelector = "#cardsClose"\)[\s\S]*document\.querySelector\(focusSelector\)\?\.focus\(\)/,
  "打开观点层后必须把焦点移入可见内容",
);
assert.match(
  source,
  /function closeCards\(\)[\s\S]*cardsReturnFocus\?\.focus\(\)/,
  "关闭观点层后必须恢复原入口焦点",
);
assert.match(
  source,
  /function renderRecommendations\(\)[\s\S]*recommendationIndexes\(\)/,
  "推荐入口必须渲染当前星云中的观点",
);
assert.match(
  source,
  /function recommendationIndexes\(\)[\s\S]*rankMatchCandidates\("same"\)[\s\S]*slice\(0,\s*5\)/,
  "相关推荐必须复用画像驱动的同频排序",
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
  /getElementById\("(?:peerDiscoveryBtn|clashBtn|circleBtn)"\)\.disabled/,
  "未解锁的同频、碰撞与圈子入口必须保持可点击并说明门槛",
);
assert.match(
  source,
  /if \(wasUnlocked && !personaUnlocked\(\)\) \{[\s\S]*?closePeerDiscovery\(\);[\s\S]*?hideChip\(\);\s*if \(focusSet\) exitFocus\(\);\s*\}/,
  "点赞降到三次以下时必须退出同频发现与小圈子聚焦态",
);
assert.match(
  source,
  /function resetLikes\(\)[\s\S]*closePeerDiscovery\(\);[\s\S]*hideChip\(\);\s*if \(focusSet\) exitFocus\(\);[\s\S]*applyStance\(true\)/,
  "清空全部点赞时必须退出同频发现与小圈子聚焦态",
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
  /data\?\.type === "nebula-entry-explore"[\s\S]*history\.replaceState[\s\S]*data\.entry === "confirm"[\s\S]*new URLSearchParams\(window\.location\.search\)\.get\("explore"\) === "1"[\s\S]*explore=1/,
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
assert.doesNotMatch(
  shelfSource,
  /now - lastRefreshAt < 500/,
  "人格卡页不得丢弃唯一一次快速回焦校验",
);
assert.match(
  shelfSource,
  /fetchZhihuPortrait[\s\S]*portrait\.accountVersion !== accountVersion[\s\S]*storedSelfProfile\.accountVersion === verifiedAccountVersion/,
  "人格卡页只能展示已绑定当前账号版本的临时画像",
);
assert.match(
  shelfSource,
  /const resolvedUnknownPreset = presetId !== requestedPresetId;[\s\S]*const validRequestedVersion = !resolvedUnknownPreset &&/,
  "已下线快照回退时不得沿用旧版本号生成错误人格卡",
);
assert.match(
  shelfSource,
  /!resolvedUnknownPreset &&\s*presetId === DEFAULT_NEBULA_PRESET &&\s*presetVersion === currentPresetVersion/,
  "已下线快照的人物链接不得复用默认快照中的同索引人物",
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
assert.match(
  source,
  /id="peerDiscoveryBtn"[\s\S]*id="peerDiscovery"/,
  "星云工具箱必须提供同频发现入口和结果面板",
);
assert.match(
  source,
  /takePeerBatch\(ranked,\s*peerSeenIndexes,\s*5\)/,
  "同频发现必须按五人一批且记录已展示候选",
);
assert.match(
  source,
  /PEER_SEEN_KEY_PREFIX\s*=\s*`jiupai:nebula:peer-seen:v1:\$\{PRESET\.id\}:\$\{PRESET\.version \|\| "1"\}`[\s\S]*userIdentityRevision \?\? "anonymous"[\s\S]*sessionStorage\.getItem\(storageKey\)[\s\S]*sessionStorage\.setItem\(/,
  "同频发现必须按快照版本和账号作用域保留当前标签页的已展示候选",
);
assert.match(
  nebulaHostSource,
  /function identityRevisionFor\(accountVersion:[\s\S]*resolveIdentityRevision\([\s\S]*IDENTITY_REVISIONS_KEY[\s\S]*identityRevisionRef\.current = identityRevisionFor\([\s\S]*identityRevision:\s*identityRevisionRef\.current/,
  "父页必须用不透明身份修订号隔离账号并同步给星云",
);
assert.match(
  identityRevisionSource,
  /const revisions = new Set<number>\(\)[\s\S]*storedRevisionState[\s\S]*nextAvailableRevision[\s\S]*persisted\.entries\.forEach[\s\S]*memory\.set\(scope,\s*nextRevision\)[\s\S]*storage\.setItem[\s\S]*nextRevision:\s*nextRevision < MAX_IDENTITY_REVISION/,
  "身份修订号必须合并持久化记录、保持唯一并用高水位避免淘汰后复用",
);
assert.match(
  nebulaHostSource,
  /NAVIGATION_CONTEXT_KINDS[\s\S]*key\.startsWith\(`\$\{NAVIGATION_CONTEXT_PREFIX\}\$\{kind\}:`\)/,
  "导航上下文清理不得误删身份修订或同频轮次状态",
);
assert.match(
  source,
  /const contextPrefixes = \[`\$\{prefix\}self:`, `\$\{prefix\}subject:`\][\s\S]*contextPrefixes\.some/,
  "独立星云的导航上下文清理不得误删身份修订或同频轮次状态",
);
assert.doesNotMatch(
  nebulaHostSource,
  /identityScope:/,
  "父页不得把账号版本或账号指纹传给星云 iframe",
);
assert.match(
  source,
  /const peerScopeChanged = userIdentityRevision !== identityRevision[\s\S]*peerSeenIndexes = loadPeerSeenIndexes\(\)[\s\S]*peerBatch = \[\]/,
  "账号切换或 iframe 恢复时必须切换到该身份自己的同频浏览轮次",
);
assert.match(
  source,
  /const peerSeenMemory = new Map\(\)[\s\S]*peerSeenMemory\.set\(storageKey,[\s\S]*peerSeenMemory\.get\(storageKey\)/,
  "Session Storage 不可用时必须按身份保留当前页面内的浏览轮次",
);
assert.match(
  source,
  /const peerSeenMemoryPreferred = new Set\(\)[\s\S]*peerSeenMemoryPreferred\.has\(storageKey\)[\s\S]*peerSeenMemoryPreferred\.add\(storageKey\)/,
  "Session Storage 后续写失败时必须继续以内存中的最新轮次为准",
);
assert.match(
  source,
  /const peerBatchMemoryPreferred = new Set\(\)[\s\S]*peerBatchMemoryPreferred\.has\(storageKey\)[\s\S]*peerBatchMemoryPreferred\.add\(storageKey\)/,
  "Session Storage 后续写失败时必须继续以内存中的最新批次为准",
);
assert.match(
  source,
  /PEER_BATCH_KEY_PREFIX[\s\S]*const peerBatchMemory = new Map\(\)[\s\S]*function restorePeerBatch\(\)[\s\S]*loadPeerBatchIndexes\(\)[\s\S]*renderPeerBatchContent\(\);[\s\S]*renderPeerBatchStatus\(\)/,
  "浏览器返回或 iframe 重载时必须按身份恢复离开前的同频批次",
);
assert.match(
  source,
  /\$\("peerDiscoveryBtn"\)\.addEventListener\("click",\s*openPeerDiscovery\)/,
  "星云主界面的同频发现入口必须绑定打开弹层的处理器",
);
assert.match(
  source,
  /function openPeerDiscovery\(\)[\s\S]*if \(peerDiscoveryEl\.classList\.contains\("show"\)\) return;[\s\S]*peerReturnFocus =/,
  "重复的自动打开请求不得覆盖弹层原有回焦目标",
);
assert.match(
  source,
  /nameButton\.addEventListener\("click",\s*\(\) => \{\s*openPerson\(index\);[\s\S]*cardButton\.addEventListener\("click",\s*\(\) => \{\s*openPerson\(index\);/,
  "候选人格卡入口必须保留弹层状态，以便浏览器返回时恢复原批次",
);
assert.match(
  source,
  /peerReturnFocus = canRestoreActiveFocus \? activeElement : \$\("peerDiscoveryBtn"\)[\s\S]*function trapPeerFocus\(event\)[\s\S]*!peerDiscoveryEl\.contains\(document\.activeElement\)/,
  "同频弹层必须回焦到可见入口并限制键盘焦点留在弹层内",
);
assert.match(
  source,
  /peerListEl\.replaceChildren[\s\S]*peerListEl\.scrollTop = 0/,
  "同频发现换批后必须回到名单顶部",
);
assert.match(
  source,
  /function refreshPeerDiscoveryBatch\(\)[\s\S]*rankPosition[\s\S]*peerBatch = peerBatch[\s\S]*\.sort\(/,
  "画像晚到时必须重排当前批次且保留已看候选",
);
assert.match(
  source,
  /function sceneControlsAvailable\(\)[\s\S]*peerDiscoveryEl\.classList\.contains\("show"\)/,
  "同频弹层打开时必须暂停星云观测控制",
);
assert.match(
  source,
  /function discardOrbitMomentum\(\)[\s\S]*controls\.enableDamping = false;[\s\S]*controls\.update\(\);[\s\S]*camera\.position\.copy\(position\);[\s\S]*camera\.quaternion\.copy\(quaternion\);[\s\S]*if \(!controlsAvailable\)[\s\S]*discardOrbitMomentum\(\)/,
  "暂停观测时必须清除 OrbitControls 惯性且保持当前相机姿态",
);
assert.match(
  source,
  /document\.addEventListener\("keydown",\s*\(e\) => \{[\s\S]*trapPeerFocus\(e\)[\s\S]*peerDiscoveryEl\.classList\.contains\("show"\)[\s\S]*navigationKeyForEvent\(e\)/,
  "键盘处理必须同时保留同频弹层焦点约束和星云观测快捷键",
);
assert.match(
  source,
  /else if \(wasUnlocked\) \{[\s\S]*closePeerDiscovery\(\);[\s\S]*clearPeerBatchState\(\);[\s\S]*\}/,
  "保持解锁的点赞变化必须重新排名但保留已看轮次",
);
assert.match(
  source,
  /function queueNextChip\(delay\)[\s\S]*peerDiscoveryEl\.classList\.contains\("show"\)/,
  "同频弹层打开时不得在背后弹出小圈子提示",
);
assert.match(
  source,
  /function renderPeerItem\(candidate\)[\s\S]*相似点[\s\S]*不同点[\s\S]*暂无原回答/,
  "同频名单必须展示异同解释并处理无来源链接",
);
assert.match(
  cardSource,
  /selfProfile\.likedCount >= 3 && onDiscoverPeers[\s\S]*发现 5 位同频的人/,
  "真实自我人格卡必须在三次表态后提供同频发现入口",
);
assert.match(
  shelfSource,
  /navigate\(`\/nebula\?preset=\$\{encodeURIComponent\(presetId\)\}&peers=1`\)/,
  "人格卡入口必须回到同一快照并请求打开同频发现",
);
assert.match(
  shelfSource,
  /currentNebulaLikeCount\([\s\S]*subject\.profile\?\.likedIndexes[\s\S]*activeLikeCount !== null[\s\S]*activeLikeCount >= 3/,
  "人格卡同频入口必须由当前版本的可恢复点赞数确认",
);
assert.match(
  nebulaStageSource,
  /openPeerDiscovery \? "&peers=1" : ""/,
  "React 外壳必须把同频发现入口状态传给星云场景",
);
assert.match(
  nebulaHostSource,
  /requestOpenPeerDiscovery[\s\S]*type:\s*"nebula-open-peer-discovery"[\s\S]*addEventListener\("pageshow",\s*requestOpenPeerDiscovery\)[\s\S]*data\?\.type === "nebula-scene-ready"[\s\S]*type:\s*"nebula-open-peer-discovery"[\s\S]*onLoad=\{requestOpenPeerDiscovery\}/,
  "React 外壳必须在挂载、页面恢复、场景就绪和 iframe 加载时请求打开同频名单",
);
assert.match(
  nebulaStageSource,
  /onLoad\?: \(\) => void[\s\S]*onLoad=\{onLoad\}/,
  "星云 iframe 必须向 React 外壳暴露真实加载完成事件",
);
assert.match(
  source,
  /e\.data\.type === "nebula-open-peer-discovery"[\s\S]*openPeerDiscovery\(\)/,
  "星云场景必须处理父页的同频打开请求",
);
assert.match(
  source,
  /function rankMatchCandidates\(mode,[\s\S]*b\.score - a\.score[\s\S]*a\.i - b\.i/,
  "同频与互补候选必须使用稳定排序",
);
const viewpointMatchSource = source.slice(
  source.indexOf("function rankMatchCandidates"),
  source.indexOf("// ---- 小圈子 ----"),
);
assert.ok(
  viewpointMatchSource.includes("function rankMatchCandidates"),
  "必须找到观点碰撞候选实现",
);
assert.doesNotMatch(
  viewpointMatchSource,
  /Math\.floor\(Math\.random\(\) \* pool\.length\)/,
  "画像候选不得从高分池随机抽取",
);
assert.match(
  source,
  /matchCandidates = rankMatchCandidates\(matchMode\)\.slice\(0,\s*3\)/,
  "观点碰撞必须保留前三位稳定候选",
);
assert.match(
  source,
  /id="clashStanceScore"[\s\S]*id="clashInterestScore"[\s\S]*id="clashCandidates"/,
  "观点碰撞必须展示立场、兴趣双依据与候选队列",
);
assert.match(
  source,
  /排序权重 · 本题立场 82 \/ 知乎兴趣 18/,
  "观点碰撞必须解释画像推荐权重",
);
assert.match(
  source,
  /cjkRuns[\s\S]*run\.slice\(offset,\s*offset \+ 2\)/,
  "兴趣相关性必须使用中文短语片段，不能退化为单字重叠",
);
assert.doesNotMatch(
  source,
  /Array\.from\(normalized\)\.filter/,
  "兴趣相关性不得按单字重叠制造弱相关误命中",
);
assert.match(
  source,
  /id="clashDialog"[\s\S]*aria-labelledby="clashTitle"[\s\S]*aria-describedby="clashReason"/,
  "观点碰撞弹层必须关联动态标题和推荐解释",
);
assert.match(
  source,
  /container\.dataset\.signature[\s\S]*button\.classList\.toggle\("is-active", active\)/,
  "切换候选时必须复用按钮 DOM 并保留键盘焦点",
);
assert.match(
  source,
  /clashEl\.addEventListener\("keydown"[\s\S]*ArrowLeft[\s\S]*ArrowRight[\s\S]*event\.key !== "Tab"/,
  "观点碰撞必须支持方向键切换和 Tab 焦点锁定",
);
assert.match(
  source,
  /if \(wasOpen\) \$\("clashBtn"\)\.focus[\s\S]*clashEl\.classList\.remove\("show"\)/,
  "关闭观点碰撞前必须把焦点恢复到可见入口",
);
assert.match(source, /id="matchSame"/, "匹配流程必须提供同频模式");
assert.match(source, /id="matchOpposite"/, "匹配流程必须提供互补模式");
assert.match(
  source,
  /\$\("clashTitle"\)\.textContent[\s\S]*\$\("clashSubtitle"\)\.textContent/,
  "匹配模式文案只能更新观点碰撞弹层",
);
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
assert.match(
  oauthAccountSource,
  /<dialog[\s\S]*className="portrait-calibration"/,
  "首页必须提供可聚焦的兴趣星谱校准台",
);
assert.match(
  oauthAccountSource,
  /查看我的兴趣星谱[\s\S]*oauth-account__identity-arrow/,
  "已连接账号入口必须用动作文案和方向箭头提示可点击",
);
assert.match(
  oauthAccountSource,
  /jiupai:oauth-profile-hint:v1:[\s\S]*sessionStorage\.getItem[\s\S]*sessionStorage\.setItem/,
  "兴趣星谱入口的首次提示必须在当前账号会话内只展示一次",
);
const profileHintEffect = oauthAccountSource.match(
  /const storageKey = `jiupai:oauth-profile-hint:v1:[\s\S]*?\n  }, \[\n    calibrationOpen/,
)?.[0];
assert.ok(profileHintEffect, "必须能够读取兴趣星谱首次提示 Effect");
assert.match(
  profileHintEffect,
  /profileHintShownRef\.current/,
  "sessionStorage 不可用时必须用当前挂载状态阻止提示重复播放",
);
assert.match(
  oauthAccountSource,
  /const profileHintShownAccounts = new Set<string>\(\)/,
  "sessionStorage 不可用时必须跨组件重新挂载保留首次提示状态",
);
assert.match(
  profileHintEffect,
  /profileHintShownAccounts\.has[\s\S]*profileHintShownAccounts\.add/,
  "首次提示 Effect 必须读取并更新模块生命周期兜底状态",
);
assert.ok(
  profileHintEffect.indexOf("sessionStorage.setItem") <
    profileHintEffect.indexOf("window.setTimeout"),
  "首次提示必须在动画开始前标记为已展示",
);
assert.doesNotMatch(
  oauthAccountSource,
  /removeEventListener\("close", close\);\s*if \(dialog\.open\) dialog\.close\(\)/,
  "dialog Effect 清理不得在 Strict Mode 下触发延迟 close 事件",
);
assert.match(
  oauthAccountSource,
  /if \(event\.target !== event\.currentTarget\) return;/,
  "dialog 内部按钮的键盘点击不得被误判为背景点击",
);
assert.match(
  oauthAccountSource,
  /useState\(oauthResult === "success"\)/,
  "OAuth 成功回跳后必须自动打开兴趣星谱",
);
assert.match(
  oauthAccountSource,
  /接口返回前不显示推测结果/,
  "画像等待态不得展示模拟进度或推测结果",
);
assert.match(
  oauthAccountSource,
  /portrait\.stats\.contents[\s\S]*portrait\.stats\.followees[\s\S]*portrait\.stats\.favlists[\s\S]*portrait\.stats\.collections/,
  "校准台必须只展示画像接口返回的汇总数量",
);
assert.match(
  oauthAccountSource,
  /原始收藏与关注明细不会进入星云/,
  "校准台必须向用户说明画像隐私边界",
);
assert.doesNotMatch(
  source,
  /trailMat|ME_LANE_[YZ]/,
  "“我”节点不得保留穿过头像的立场尾迹",
);
assert.match(
  source,
  /id="guideBtn"/,
  "星云必须提供星图向导入口",
);
assert.match(
  source,
  /current\.choices\.forEach[\s\S]*choices\.appendChild\(button\)/,
  "星图向导必须把每道选择题的按钮挂载到页面",
);
assert.match(
  source,
  /renderGuideQuizStep\(true\)[\s\S]*choices\.querySelector\("button"\)\?\.focus\(\)/,
  "星图向导换题后必须把焦点移到新题选项",
);
assert.match(
  source,
  /uiNode\("button", "guide-quiz-btn"[\s\S]*event\.repeat[\s\S]*event\.preventDefault\(\)/,
  "星图向导必须忽略长按按键产生的重复答题",
);
assert.match(
  source,
  /GUIDE_QUIZ_INPUT_GUARD_MS\s*=\s*800[\s\S]*now < guideQuizInputReadyAt[\s\S]*showToast\("请先读完本题再选择"\)[\s\S]*now \+ GUIDE_QUIZ_INPUT_GUARD_MS/,
  "星图向导必须防止快速双击跨题提交",
);
assert.match(
  source,
  /intent === "representatives"[\s\S]*renderGuidePicks\(\)/,
  "“代表性观点”必须展示完整代表集合而不是固定跳到左端",
);
assert.match(
  source,
  /event\.isComposing/,
  "星图向导不得在中文输入法组词时提前提交",
);
assert.match(
  source,
  /function trapGuideFocus[\s\S]*guideCloseButton\.focus\(\)/,
  "星图向导必须把键盘焦点限制在模态框内",
);
assert.match(
  source,
  /function closeGuide\(restoreFocus = true\)[\s\S]*if \(restoreFocus\) \$\("guideBtn"\)\.focus\(\)/,
  "关闭星图向导后必须把焦点恢复到外置入口",
);
assert.match(
  source,
  /\.guide-suggestion\s*\{[\s\S]{0,500}min-height:\s*44px/,
  "星图向导建议按钮必须满足移动端 44px 触控区域",
);
assert.match(
  source,
  /function resumeCirclePrompt[\s\S]*!circlePromptBlocked\(\)[\s\S]*queueNextChip/,
  "关闭星图向导后必须恢复被延后的圈子提示",
);
assert.match(
  source,
  /function deferCirclePrompt[\s\S]*chipQueue\.unshift\(chipCluster\)[\s\S]*hideChip\(\)/,
  "打开阻挡层时必须保留并隐藏当前圈子提示",
);
const circlePromptQueue = source.match(
  /function queueNextChip\(delay\) \{[\s\S]*?\n\s*\}\n\s*chipQueue = rankedCircles/,
)?.[0];
assert.ok(circlePromptQueue, "圈子提示队列逻辑不存在");
assert.match(
  circlePromptQueue,
  /if \(circlePromptBlocked\(\)\) return/,
  "圈子提示被弹层阻挡时必须暂停",
);
assert.match(
  source,
  /function circlePromptBlocked\(\)[\s\S]*document\.body\.classList\.contains\("entry-active"\)/,
  "星云入口流程必须暂停圈子提示",
);
assert.match(
  source,
  /function circlePromptBlocked\(\)[\s\S]*Boolean\(hovered\)[\s\S]*Boolean\(cameraTransition\)/,
  "人物定位和观点浮层必须暂停圈子提示",
);
assert.match(
  source,
  /function setHovered\(u\)[\s\S]*if \(u\) \{\s*deferCirclePrompt\(\)[\s\S]*else \{[\s\S]*resumeCirclePrompt\(\)/,
  "人物观点浮层打开时必须挂起圈子提示，关闭后恢复",
);
assert.match(
  source,
  /followedOnly[\s\S]*cameraFocusUser[\s\S]*moveCamera\(defaultCameraTarget, defaultCameraPosition, true, \(\) => \{[\s\S]*resumeCirclePrompt\(\)/,
  "关注筛选触发相机回位后必须恢复圈子提示",
);
assert.match(
  source,
  /function finishEntryGeneration\(\)[\s\S]*document\.body\.classList\.remove\("entry-active"\)[\s\S]*resumeCirclePrompt\(\)/,
  "星云入口完成后必须恢复圈子提示",
);
assert.match(
  source,
  /function showEntryConfirmFromScene\(\)[\s\S]*deferCirclePrompt\(\)[\s\S]*classList\.add\("entry-active"\)/,
  "从星云返回入口时必须挂起当前圈子提示",
);
assert.doesNotMatch(
  circlePromptQueue,
  /resumeCirclePrompt/,
  "圈子提示被弹层阻挡时不得周期性轮询",
);
assert.match(
  source,
  /if \(e\.key === "Escape"\) \{\s*if \(e\.isComposing \|\| e\.repeat\) return/,
  "输入法组词或长按 Escape 时不得连续关闭界面层级",
);
assert.match(
  source,
  /nebula-view-change/,
  "阅读流必须通知 React 外壳切换视图",
);
assert.match(
  source,
  /const spectrumGroup = new THREE\.Group\(\);[\s\S]*nebula\.add\(spectrumGroup\)/,
  "观点尘埃与人物节点必须共享可旋转的光谱容器",
);
assert.match(
  source,
  /spectrumGroup\.add\(userGroup\)[\s\S]*spectrumGroup\.add\(commentGroup\)[\s\S]*spectrumGroup\.add\(dustGroup\)/,
  "回答者、评论者和观点尘埃必须位于同一坐标系",
);
assert.match(
  source,
  /spectrumGroup\.localToWorld\(anchor\.clone\(\)\)\.project\(camera\)/,
  "光谱两端标签必须跟随旋转后的观点坐标",
);
assert.match(
  source,
  /spectrumGroup\.add\(focusLines\)/,
  "小圈子连线必须跟随人物节点旋转",
);
assert.match(
  source,
  /function focusCluster\(c\)\s*\{[\s\S]*setPersonaFilter\(null\);[\s\S]*focusSet = new Set\(c\.members\)/,
  "小圈子聚焦必须接管并清除已有的人格筛选",
);
assert.match(
  source,
  /const personaOpacity = reduceMotion\s*\?\s*0\.48[\s\S]*u\.ring\.material\.opacity \+= \(target - u\.ring\.material\.opacity\) \* ringRate/,
  "减少动态模式下人格高亮环必须固定并立即收敛",
);
assert.doesNotMatch(
  source,
  /dustGroup\.rotation\.[yz]/,
  "观点尘埃不得脱离人物节点独立旋转",
);

const personaCatalog = buildPersonaCatalog(
  {
    fox: ["长答派", "万字长答", "#aeb6d6"],
    owl: ["深夜派", "三点的诚实", "#dde08a"],
    goat: ["杠精派", "先找反例", "#bccf96"],
  },
  [
    ["无效人物", -0.9, "missing", "不应进入目录"],
    ["低赞作者", -0.5, "fox", "低赞观点", "", "", 3],
    ["高赞作者", 0.1, "fox", "代表观点", "", "", 18],
    ["夜间作者", 0.4, "owl", "夜间观点"],
  ],
);
assert.deepEqual(
  personaCatalog.map(({ key, count, representative }) => ({
    key,
    count,
    representativeIndex: representative.index,
  })),
  [
    { key: "fox", count: 2, representativeIndex: 2 },
    { key: "owl", count: 1, representativeIndex: 3 },
  ],
  "人格目录必须省略空人格，并保留代表观点的原始人物索引",
);
assert.equal(personaCatalog[0].share, 2 / 3, "人格占比必须只统计合法人物");
assert.equal(cyclePersonaIndex(0, -1, 2), 1, "人格卡群向前切换必须首尾循环");
assert.equal(cyclePersonaIndex(1, 1, 2), 0, "人格卡群向后切换必须首尾循环");

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
assert.equal(
  SCHOLARS_AI_MATH.serial,
  "05",
  "存量快照模块必须保留旧序号供缓存中的六快照注册表使用",
);
assert.equal(
  getNebulaPreset("scholars-ai-math").serial,
  "03",
  "当前注册表必须为保留的第三个快照提供连续序号",
);
for (
  const preset of [
    SOCIAL_CONNECTIONS,
    AI_PROGRAMMER_JOBS,
    CITY_OR_HOMETOWN,
  ]
) {
  assert.equal(preset.kind, "real", `${preset.id} 必须标记为真实讨论`);
  assert.equal(preset.people.length, 45, `${preset.id} 必须包含 45 条有效回答`);
  assert.match(
    preset.sourceQuestion,
    /^https:\/\/www\.zhihu\.com\/question\/\d+$/,
    `${preset.id} 必须保留知乎问题来源`,
  );
  assert.equal(
    new Set(preset.people.map((person) => person[4])).size,
    preset.people.length,
    `${preset.id} 不得包含重复回答链接`,
  );
  for (const [index, person] of preset.people.entries()) {
    assert.equal(
      person[0],
      `知乎回答 ${String(index + 1).padStart(2, "0")}`,
      `${preset.id} 不得伪造回答者身份`,
    );
    assert.ok(
      typeof person[1] === "number" && person[1] >= -1 && person[1] <= 1,
      `${preset.id} 立场必须位于 -1 到 1`,
    );
    assert.ok(person[3].length > 0 && person[3].length <= 90, `${preset.id} 摘要长度非法`);
    assert.match(
      person[4],
      new RegExp(`^${preset.sourceQuestion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\/answer\\/\\d+$`),
      `${preset.id} 回答链接必须属于来源问题`,
    );
    assert.equal(person[6], null, `${preset.id} 不得伪造回答赞同数`);
  }
  assert.ok(
    preset.people.filter((person) => person[1] < -0.2).length >= 3 &&
      preset.people.filter((person) => person[1] > 0.2).length >= 3,
    `${preset.id} 必须覆盖光谱两端`,
  );
}
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
  const detail = getNebulaPreset(preset.id);
  if (detail.avatarBase) {
    for (let index = 0; index < preset.answerCount; index += 1) {
      const avatar = new URL(
        `../public/nebula-scene/${detail.avatarBase}/u${String(index + 1).padStart(2, "0")}.jpg`,
        import.meta.url,
      );
      assert.ok(existsSync(avatar), `${preset.id} 缺少第 ${index + 1} 位回答者头像`);
    }
  }
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
assert.deepEqual(
  [...reactAnswerCounts.entries()].sort(([left], [right]) => left.localeCompare(right)),
  staticPresets
    .map(({ id, answerCount }) => [id, answerCount])
    .sort(([left], [right]) => left.localeCompare(right)),
  "React 与静态场景的快照人数目录必须双向一致",
);
assert.deepEqual(
  presetMetaIds.slice().sort((left, right) => left.localeCompare(right)),
  [...reactCatalog.keys()].sort((left, right) => left.localeCompare(right)),
  "朋友对照元数据必须覆盖全部已发布快照",
);

console.log("nebula navigation checks passed");
