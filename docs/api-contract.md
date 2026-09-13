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

OAuth 当前采用后端 `HttpOnly` Session Cookie，服务端会话存入 Cloudflare Durable
Object。前端启动登录时应使用页面跳转：

```ts
window.location.assign(`${API_BASE_URL}/api/oauth/start`);
```

OAuth 成功或失败后，后端跳回正式前端，并追加 `oauth=success` 或
`oauth=error` 查询参数。

正式前端、API 和 OAuth 回调均位于 `soular.top`，Session Cookie 是第一方 Cookie。
GitHub Pages 仅作公开页面镜像，不作为 OAuth 个性化能力的正式入口。
镜像和本地预览中的登录入口直接前往正式站，避免跨站 Cookie 被浏览器拦截。

## 3. 公开接口

### GET `/api/health`

检查后端配置状态。

响应：

```json
{
  "ok": true,
  "configured": true,
  "dataApiConfigured": true,
  "appId": "422",
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

缓存：服务端固定请求并缓存一份 `Limit=30` 的热榜 6 小时，再按前端 `limit` 本地切片；
不同展示条数不会生成新的上游缓存键。上游失败时可返回 KV 中的旧数据。服务端在写入缓存前
校验 `Items` 并裁剪到 30 条，所有知乎上游响应的读取上限为 5 MiB。KV 读写按
best-effort 处理：缓存故障不会阻止上游请求，也不会覆盖已经成功取得的结果。

服务端不提供 `/api/zhihu/search` 搜索代理。站内搜索只查询已发布快照；任意关键词搜索
通过前端生成的知乎搜索链接完成，避免匿名请求消耗共享配额。

## 4. OAuth 与个性化接口

### GET `/api/oauth/start`

别名：`GET /login`。

首次登录时创建 Session 和 OAuth `state`，然后 `302` 跳转知乎授权页。
已有 Session 会原子创建或复用 10 分钟内的同一待处理流程；当前授权在新授权成功前保留，
失败时前端提示原账号仍连接。
回调提交时必须匹配已认领的流程标识；旧回调不得覆盖随后发起的新登录流程或退出操作。
该接口必须作为顶层页面导航，不要用 `fetch`。

### GET `/auth/callback`

知乎回调接口。兼容参数：

- `authorization_code`（优先）
- `code`
- `state`（知乎可能不回传；回传时必须匹配）

缺少 `state` 时，仅允许同一 Session 中 10 分钟内已经发起过授权的回调继续，并将
`stateVerified` 记录为 `false`；前端必须明确显示“仅适合临时联调”。
没有待处理授权状态的回调一律拒绝。

成功后 `302` 到：

```text
https://soular.top/?oauth=success
```

失败后跳回同一前端并携带 `oauth=error`。

### GET `/api/oauth/status`

前端请求设置 `credentials: "include"`。没有 Session Cookie 时只读返回未授权状态，
不创建 Session 或写入会话存储。

```json
{
  "ok": true,
  "configured": true,
  "dataApiConfigured": true,
  "appId": "422",
  "redirectUri": "https://soular.top/auth/callback",
  "authorized": false,
  "profile": null,
  "accountVersion": null,
  "stateVerified": null,
  "expiresAt": null,
  "error": null
}
```

首页根据该接口展示“知乎登录”、已连接账号或重试状态。`profile` 获取失败时仍保留
已授权状态，不伪造昵称或头像。知乎 `/user` 没有稳定响应 schema，服务端兼容嵌套或
顶层用户对象以及 `avatar_url`、`avatar_path` 等已观测字段。状态接口只读取 Session，
不等待资料补取。`accountVersion` 是 OAuth Token 指纹的短版本，只用于浏览器拒绝拼接
不同登录账号的资料与画像。

### GET `/api/oauth/profile`

需要有效 Session。已有 Session 的 `profile` 为空或缺少头像时，前端通过该接口补取
公开资料，不阻塞 `/api/oauth/status`。结果按 OAuth Token 指纹缓存 10 分钟；空结果
和失败在 KV 与当前 Worker 实例内退避 60 秒。补取结果只覆盖非空字段，不会丢失 Session
中已有的昵称、简介或主页地址。同一实例中的并发补取会复用包含缓存发布在内的完整
in-flight Promise，因此同一批请求只写一次缓存。

资料请求使用 6 秒统一总预算，先尝试开放平台双凭证头；只有明确的 401、403 或鉴权
错误码才对同一官方 `/user` 地址使用标准 OAuth Bearer 回退。限流、服务端错误、超时
和无效响应不会触发第二次请求。

### POST `/api/oauth/logout`

需要 Session Cookie。后端 Session 删除成功后返回 `Max-Age=0` 的 Cookie。
删除失败时保留 Cookie 并返回 `SESSION_DELETE_FAILED`，前端显示“重试退出”。

### GET `/api/me/portrait`

需要 Session Cookie 和有效知乎 OAuth Token。

缓存：按 OAuth Token 指纹隔离 10 分钟，避免同一浏览器切换账号后复用旧画像。
公开接口不提供缓存绕过参数；同一运行实例中的并发画像请求合并为一次上游调用和一次
缓存发布。KV 读取或写入失败时继续使用可用的上游结果。

画像缓存未命中时，服务端读取创作、关注、收藏夹和近期收藏，并从首个公开收藏夹
最多采样一条内容用于关键词计算。收藏夹为空时跳过；单项失败写入 `warnings`，
不阻断其他画像数据，部分成功结果只缓存 60 秒。四项主要数据源全部失败时返回
`PORTRAIT_UNAVAILABLE`，并对相同账号记录 60 秒失败退避，不缓存空画像。

响应顶层同时返回与状态接口相同的 `accountVersion`。正式前端在确认用户已授权后调用
该接口，只有账号版本一致时才接收结果；标签重新可见时会重新校验登录账号。首页只显示
画像校准状态和最多两个兴趣词；
进入观点星云时，React 只向 iframe 发送最多六个关键词及分数、证据总数和部分数据标记。
创作、关注、收藏明细不进入 iframe、URL 或持久化浏览器存储。画像接口失败不得阻断
静态星云、本地表态、人格卡或无画像匹配。

响应主要结构：

```json
{
  "ok": true,
  "cached": true,
  "accountVersion": "0123456789abcdef",
  "data": {
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
| 500 | `SESSION_BINDING_MISSING` | Worker 缺少 Session Durable Object 绑定 |
| 500 | `BOOTSTRAP_ERROR` | Worker 配置初始化失败 |
| 502 | `20001` | 知乎上游鉴权失败 |
| 429 | `30001` | 知乎上游频率限制 |
| 429 | `30002` | 知乎上游日配额耗尽 |
| 502 | `90001` | 知乎上游或直答模型内部错误 |
| 503 | `NOT_CONFIGURED` | Access Secret 或 OAuth 凭证未配置 |
| 503 | `PORTRAIT_UNAVAILABLE` | 画像主要数据源暂时全部不可用 |
| 503 | `SESSION_DELETE_FAILED` | 服务端会话删除失败，Cookie 保留以便重试退出 |

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
| `tao-ai-tradition` | 陶哲轩发文称「AI 正杀死数学百年开放传统」，你如何看待这一观点？ | 2026-09-14 真实问题，5 位真实作者、头像与来源链接 |
| `pangdonglai-labor` | 如何看待于东来发文称胖东来再招员工都是学员性质，合同四年，不续签？意味着什么？ | 2026-09-14 真实问题，3 位真实作者、头像与来源链接 |
| `ai-math-revolution` | 数学已经被 AI 彻底革命了么？ | 2026-09-14 真实问题，5 位真实作者、头像与来源链接 |
| `imu-ai-declaration` | 国际数学联盟发布《人工智能与数学莱顿宣言》，回应 AI 对数学研究影响的问题，如何理解这份宣言？ | 2026-09-14 真实问题，5 位真实作者、头像与来源链接 |

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

正式站的 React 外壳从 `/api/oauth/status` 读取授权状态和已有公开资料，必要时通过
`/api/oauth/profile` 补取昵称和头像，并从 `/api/me/portrait` 提取有限的画像信号，
通过 `nebula-user-profile` 消息传给观点星云
iframe。父子页都必须校验消息来源；头像仅接受 HTTPS `zhimg.com` 子域名。消息不得包含
账号指纹、OAuth Token、Session ID、原始创作、关注或收藏明细，只允许携带不透明的
身份修订号供 iframe 在切号时清理旧头像、碰撞、圈子和聚焦状态。未登录、资料读取失败、
GitHub Pages 镜像和本地预览继续使用本地“我”占位头像和无画像匹配。

画像关键词不决定用户在单个问题中的立场或人格派别。人格仍由该星云中的有效点赞计算；
关键词只显示为兴趣底色，并以 18% 的次级权重参与同频、互补候选排序，本题立场权重为
82%。画像信号只随当前标签页的临时人格上下文传到卡片页，不写入公开分享 URL；该上下文
绑定账号版本，卡片页在挂载、重新获得焦点或重新可见时复查授权状态，版本不一致便清理。

观点星云内的搜索只查询本地快照目录、回答者和观点摘要；推荐根据当前星云中的点赞立场
在本地选择同频观点，尚未点赞时返回光谱两端与中点的代表观点。热榜使用上述只读接口并
在当前探索面板中展示结果，上游不可用时回退到已发布星云。用户选择热榜条目时才打开
知乎原文。服务端不公开回答采集或观点光谱生成接口，前端也不得绕过静态快照的人工验收
流程。动态接口不可用时，前端显示非技术性降级文案，并提供对应的知乎搜索、首页或热榜
直达链接。
