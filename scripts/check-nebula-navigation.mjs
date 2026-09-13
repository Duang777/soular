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
const reactCatalogSource = readFileSync(new URL("../src/people.ts", import.meta.url), "utf8");
const reactSourceFile = ts.createSourceFile(
  "src/people.ts",
  reactCatalogSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);
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
  /safeUserAvatarUrl/,
  "星云必须在使用登录头像前校验 URL",
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
for (const preset of staticPresets) {
  assert.match(preset.id, /^[a-z0-9-]{1,48}$/);
  assert.match(preset.version, /^[a-z0-9-]{1,15}$/);
  const likeStorageKey = getNebulaLikeStorageKey(preset);
  assert.ok(`${preset.id}:${preset.version}`.length <= 64);
  assert.ok(!likeStorageKeys.has(likeStorageKey), "快照点赞存储键必须唯一");
  likeStorageKeys.add(likeStorageKey);
}
assert.deepEqual(
  [...reactCatalog.entries()].sort(([left], [right]) => left.localeCompare(right)),
  staticPresets
    .map(({ id, version }) => [id, version])
    .sort(([left], [right]) => left.localeCompare(right)),
  "React 与静态场景的快照版本目录必须双向一致",
);

console.log("nebula navigation checks passed");
