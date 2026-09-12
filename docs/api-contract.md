# 思想银河前后端接口契约

## 1. 部署边界

- 正式前端：`https://soular.top/`
- API Base URL：`https://soular.top`
- GitHub Pages 镜像：`https://duang777.github.io/soular/`
- 前端生产请求使用同源相对路径；GitHub Pages 镜像使用 `https://soular.top`
- 后端代码：仓库内 `server/`
- Worker 托管正式前端 `dist`，并优先处理 `/api/*`、`/login` 和 `/auth/callback`。
- 正式观点星云默认读取随前端发布的静态快照，不在页面访问时调用知乎或 AI。

除 OAuth 跳转接口外，所有 JSON 响应均使用：

```json
{ "ok": true, "data": {} }
```

错误响应统一为：

```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "可读错误信息"
  }
}
```

## 2. CORS 与认证

`soular.top` 正式前端使用同源请求，不需要 CORS。GitHub Pages 镜像跨域调用时，
后端按请求 Origin 精确返回：

- `Access-Control-Allow-Origin: https://duang777.github.io`
- `Access-Control-Allow-Credentials: true`
- 允许方法：`GET, POST, OPTIONS`
- 允许请求头：`Content-Type, Authorization`
- 预检缓存：86400 秒

公开数据接口不需要登录，也不要携带知乎密钥或 Token。

OAuth 当前采用后端 `HttpOnly` Session Cookie。前端启动登录时应使用页面跳转：

```ts
window.location.assign(`${API_BASE_URL}/api/oauth/start`);
```

OAuth 成功或失败后，后端跳回正式前端，并追加 `oauth=success` 或
`oauth=error` 查询参数。

正式前端、API 和 OAuth 回调均位于 `soular.top`，Session Cookie 是第一方 Cookie。
GitHub Pages 仅作公开页面镜像，不作为 OAuth 个性化能力的正式入口。

## 3. 公开接口

### GET `/api/health`

检查后端配置状态。

响应：

```json
{
  "ok": true,
  "configured": false,
  "dataApiConfigured": true,
  "appId": null,
  "redirectUri": "https://soular.top/auth/callback"
}
```

### GET `/api/zhihu/hot`

返回知乎热榜原始结构。

参数：

| 参数 | 类型 | 默认值 | 服务端范围 |
| --- | --- | --- | --- |
| `limit` | number | 30 | 1–30 |

`data` 结构：

```json
{
  "Total": 30,
  "Items": [
    {
      "Title": "标题",
      "Url": "https://www.zhihu.com/question/...",
      "ThumbnailUrl": "https://...",
      "Summary": "摘要"
    }
  ]
}
```

缓存：按参数缓存 10 分钟；上游失败时可返回 KV 中的旧数据。服务端在写入缓存前校验
`Items` 并裁剪到请求上限，所有知乎上游响应的读取上限为 5 MiB。

服务端不提供 `/api/zhihu/search` 搜索代理。站内搜索只查询已发布快照；任意关键词搜索
通过前端生成的知乎搜索链接完成，避免匿名请求消耗共享配额。

## 4. OAuth 与个性化接口

### GET `/api/oauth/start`

别名：`GET /login`。

创建 Session 和 OAuth `state`，然后 `302` 跳转知乎授权页。必须作为顶层页面导航，
不要用 `fetch`。

### GET `/auth/callback`

知乎回调接口。兼容参数：

- `authorization_code`（优先）
- `code`
- `state`（知乎可能不回传；回传时必须匹配）

成功后 `302` 到：

```text
https://soular.top/?oauth=success
```

失败后跳回同一前端并携带 `oauth=error`。

### GET `/api/oauth/status`

需要 Session Cookie。前端请求必须设置 `credentials: "include"`。

```json
{
  "ok": true,
  "configured": false,
  "dataApiConfigured": true,
  "appId": null,
  "redirectUri": "https://soular.top/auth/callback",
  "authorized": false,
  "profile": null,
  "stateVerified": null,
  "expiresAt": null,
  "error": null
}
```

### POST `/api/oauth/logout`

需要 Session Cookie。清空后端 Session 中的 OAuth Token 与用户资料。

### GET `/api/me/portrait`

需要 Session Cookie 和有效知乎 OAuth Token。

可选参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `refresh` | `0 | 1` | `1` 跳过当前用户的画像缓存 |

缓存：每个 Session 10 分钟。

`data` 主要结构：

```json
{
  "generatedAt": "2026-09-12T00:00:00.000Z",
  "stats": {
    "contents": 0,
    "followees": 0,
    "favlists": 0,
    "collections": 0,
    "likesReceived": 0,
    "contentKinds": {}
  },
  "keywords": [{ "word": "数据分析", "score": 12.3 }],
  "topContents": [],
  "favlists": [],
  "followees": [],
  "recentCollections": [],
  "warnings": []
}
```

## 5. 状态码与错误码

| HTTP | `error.code` | 含义 |
| --- | --- | --- |
| 400 | `10001` | 参数错误，例如搜索词为空 |
| 401 | `NOT_AUTHORIZED` | 未登录 |
| 401 | `TOKEN_EXPIRED` | OAuth Token 已过期 |
| 404 | `NOT_FOUND` | API 或资源不存在 |
| 500 | `INTERNAL` | 后端未分类异常 |
| 500 | `KV_BINDING_MISSING` | Worker 缺少 KV 绑定 |
| 500 | `BOOTSTRAP_ERROR` | Worker 配置初始化失败 |
| 502 | `20001` | 知乎上游鉴权失败 |
| 429 | `30001` | 知乎上游频率限制 |
| 429 | `30002` | 知乎上游日配额耗尽 |
| 502 | `90001` | 知乎上游或直答模型内部错误 |
| 503 | `NOT_CONFIGURED` | Access Secret 或 OAuth 凭证未配置 |

前端应同时读取 HTTP 状态与 `error.code`。收到 429 时不要立即自动重试，避免延长
上游限流窗口或继续消耗日配额。

## 6. 尚未开放的接口

- 动态 AI 星图：不提供匿名 `/api/galaxy` 路由，候选内容只通过本地运营脚本生成。
- 全网搜索：后端客户端已有适配，但尚未发布为公开路由。
- 个性化推荐：尚未定义稳定的输入、排序依据和响应契约。

正式前端不要预判这些路径。新增接口需先更新本契约，再接入 UI。

## 7. 静态星云快照

正式场景的数据 seam 位于：

```text
public/nebula-scene/presets.js
```

页面通过 `/nebula?preset=career-35` 选择快照；未知 id 自动回退到
`career-35`。首个快照就是已经确认过视觉和交互的“35 岁程序员该不该转行”星云。

当前快照：

| id | 问题 | 数据性质 |
| --- | --- | --- |
| `career-35` | 35 岁程序员该不该转行？ | 原正式前端演示数据 |
| `ai-math` | AI 是否正在毁掉数学？ | 2026-09-12 热榜真实问题，31 位真实作者、头像与来源链接 |

每个快照包含：

- `id`、不可变内容版本 `version`、盲盒序号 `serial`、问题 `question`、知乎搜索链接 `searchUrl`
- 数据性质 `kind`：`mock | real`
- 左中右光谱文案 `axis`
- 可变数量讨论者 `people`：`[昵称, 立场(-1..1), 人格派别, 观点, 来源 URL, 来源标题, 赞同数]`
- 可选真实头像目录 `avatarBase`
- 关注状态 `followed`
- 评论节点 `comments`
- 小圈子 `circles`
- 用户默认星位 `me`

新快照必须离线生成、人工验收后随前端发布。页面运行时只读取本地静态模块，不提供或调用
匿名 AI 星图生成接口，也不直接调用知乎或直答。点赞记录按快照 id 与 version 隔离。用户可在
银河盲盒的“讨论热点”选择器中切换快照。

同一个 `id` 下只要回答增删、重排或来源发生变化，就必须更新 `version`。点赞存储键使用
`id + version`，避免旧索引在新版快照中错误指向其他回答。
发布或更新快照时，还必须同步 `src/people.ts` 中的 `NEBULA_PRESET_VERSIONS`；导航检查会
校验两侧目录一致。
快照文案在运行时通过 DOM 文本节点渲染，来源链接只接受 HTTPS 知乎域名，不得把快照
字段直接拼接进 `innerHTML`。

### 离线批量生成

回答采集和 AI 观点光谱只允许通过本地运营脚本执行，不暴露公网 API：

```bash
npm --prefix server run prepare:hot-spectrums -- --count=3 --answers=30
```

脚本最多扫描热榜前 30 项、处理其中 5 个合法问题，每个问题最多读取 50 条回答，并严格
使用上游 `NextOffset` 分页。AI 输出覆盖不足或解析失败时保留原始摘要并标记降级，不伪造
作者、头像或赞同数；模型调用、鉴权或配额错误会直接停止整批处理。后续分页的普通瞬时
错误会保留已采集回答并记录警告，但鉴权或配额错误仍会终止；畸形条目会被有界跳过，
跨页重复回答按内容类型和内容标识去重。任一候选生成失败后不会替换原输出文件。候选
回答按 `stance` 升序输出，与前端从左到右的观点光谱一致。

结果默认写入 `server/.staging/hot-spectrums.json`，不会自动进入前端。候选项必须人工检查
立场、摘要和链接并补充作者信息后，才可复制为 `public/nebula-scene/preset-*.js` 并注册。
禁止把回答采集或观点光谱生成重新开放为匿名 Worker 路由，以免外部请求消耗共享配额。

### 人格卡生成

- 离线阶段：直答模型为每条回答生成 `stance`、`claim` 和九派 `cast` 标签；九派标签只允许
  `fox/bear/cat/owl/rabbit/penguin/redpanda/goat/frog`。
- 运行阶段：不调用 AI。先计算用户点赞回答的平均立场，再按每个九派标签的点赞数量选人格；
  同票时使用该派回答与用户平均立场的接近度破同票，最后按固定九派顺序保证结果稳定。
- 没有点赞时使用快照的 `me.castKey` 默认人格；生成依据通过 Session Storage 带到卡片页，
  自我人格卡分享链接只保留最终派别、快照及版本，不暴露点赞明细。
- 人物与自我画像按随机导航上下文键暂存，避免历史记录和同标签页内不同卡片互相覆盖；
  同页路由状态在 Session Storage 不可用时提供降级。公开分享 URL 不携带该上下文键，
  也不会读取接收者已有的临时画像。
- 临时导航上下文最多保留 24 份，键中携带创建时间并按时间清理最旧记录，不依赖浏览器的
  Session Storage 枚举顺序。
- 真实人物卡优先分享可核验的知乎原文；没有来源链接的示例人物回到对应观点星云，不生成
  依赖本机 Session Storage 才能打开的人物卡链接。
- 快照升版后旧自我卡分享链接仍展示最终人格；依赖人物索引的旧版本链接回到对应星云，
  避免索引映射到新版中的其他人物。

## 8. 前端调用约定

```ts
const API_BASE_URL =
  location.origin === "https://soular.top" ? "" : "https://soular.top";

const response = await fetch(
  `${API_BASE_URL}/api/zhihu/hot?limit=8`,
);
const payload = await response.json();
if (!response.ok || !payload.ok) {
  throw new Error(payload.error?.message ?? "API 请求失败");
}
```

产品前端仅在热榜、登录、画像等动态功能中调用后端。观点星云使用静态快照，不要在
浏览器中直接调用知乎开放平台，也不要持有 `ZHIHU_ACCESS_SECRET`、
`ZHIHU_OAUTH_APP_KEY` 或 OAuth Token。

观点星云内的搜索只查询本地快照目录；热榜使用上述只读接口并在当前探索面板中展示
结果；推荐暂不请求上游，只显示开发状态和知乎首页入口。用户选择热榜条目时才打开知乎
原文。服务端不公开回答采集或观点光谱生成接口，前端也不得绕过静态快照的人工验收
流程。动态接口不可用时，前端显示功能开发状态，不暴露上游技术错误，并提供对应的
知乎搜索、首页或热榜直达链接。
