# 思想银河前后端接口契约

## 1. 部署边界

- 正式前端：`https://soular.top/`
- API Base URL：`https://soular.top`
- GitHub Pages 镜像：`https://duang777.github.io/zhihu-character-wave/`
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

### GET `/api/galaxy`

热榜 AI 聚合结果，用于离线准备新快照和内部检查。正式星云页面不得在访问时调用
此接口。无需参数，不允许客户端强制刷新。

缓存：

- 热榜原始数据：10 分钟
- AI 星图：24 小时
- AI 失败后的规则降级：1 小时
- 上游失败后 10 分钟内不再发起重建
- Worker 内同一时刻的重建请求会合并
- 上游失败时优先返回仍可读取的旧快照

响应：

```json
{
  "ok": true,
  "cached": true,
  "data": {
    "generatedAt": 1789220000000,
    "source": "ai",
    "model": "zhida-fast-1p5",
    "clusters": [
      { "id": 0, "name": "科技" }
    ],
    "posts": [
      {
        "id": 1,
        "title": "热榜标题",
        "summary": "摘要",
        "url": "https://www.zhihu.com/question/...",
        "thumbnail": "https://...",
        "heat": 1,
        "cluster": 0,
        "debate": 0.72,
        "take": "AI 中立锐评",
        "campA": "阵营 A 主张",
        "campB": "阵营 B 主张"
      }
    ],
    "warnings": []
  }
}
```

字段约束：

- `source`: `ai | fallback`
- `heat`: `0..1`，越大表示热榜排名越靠前
- `cluster`: 对应 `clusters[].id`
- `debate`: `0..1`，0 为冷静共识，1 为激烈撕裂
- 降级结果中 `campA`、`campB` 可能为空；前端必须允许隐藏阵营模块
- `warnings` 非空表示发生部分降级，不代表请求失败

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

缓存：按参数缓存 10 分钟；上游失败时可返回 KV 中的旧数据。

### GET `/api/zhihu/search`

知乎站内搜索。

参数：

| 参数 | 类型 | 必填 | 默认值 | 服务端范围 |
| --- | --- | --- | --- | --- |
| `q` | string | 是 | - | 非空 |
| `count` | number | 否 | 10 | 1–10 |

响应 `data`：

```json
{
  "HasMore": true,
  "SearchHashId": "可选",
  "Items": [
    {
      "Title": "标题",
      "ContentType": "answer",
      "ContentID": "内容 ID",
      "ContentText": "正文摘要",
      "Url": "https://...",
      "CommentCount": 0,
      "VoteUpCount": 0,
      "AuthorName": "作者",
      "AuthorAvatar": "https://...",
      "AuthorBadge": "",
      "AuthorBadgeText": "",
      "EditTime": 0,
      "AuthorityLevel": ""
    }
  ]
}
```

缓存：按 `q + count` 缓存 5 分钟；上游失败时可返回 KV 中的旧数据。

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

- `id`、盲盒序号 `serial`、问题 `question`、知乎搜索链接 `searchUrl`
- 数据性质 `kind`：`mock | real`
- 左中右光谱文案 `axis`
- 可变数量讨论者 `people`：`[昵称, 立场(-1..1), 人格派别, 观点, 来源 URL, 来源标题, 赞同数]`
- 可选真实头像目录 `avatarBase`
- 关注状态 `followed`
- 评论节点 `comments`
- 小圈子 `circles`
- 用户默认星位 `me`

新快照必须离线生成、人工验收后随前端发布。页面运行时只读取本地静态模块，不调用
`/api/galaxy`，也不直接调用知乎或直答。点赞记录按快照 id 隔离。用户可在银河盲盒
的“讨论热点”选择器中切换快照。

## 8. 前端调用约定

```ts
const API_BASE_URL =
  location.origin === "https://soular.top" ? "" : "https://soular.top";

const response = await fetch(
  `${API_BASE_URL}/api/zhihu/search?q=${encodeURIComponent(query)}&count=10`,
);
const payload = await response.json();
if (!response.ok || !payload.ok) {
  throw new Error(payload.error?.message ?? "API 请求失败");
}
```

产品前端仅在搜索、登录、画像等动态功能中调用后端。观点星云使用静态快照，不要在
浏览器中直接调用知乎开放平台，也不要持有 `ZHIHU_ACCESS_SECRET`、
`ZHIHU_OAUTH_APP_KEY` 或 OAuth Token。
