# 正式 API 服务

## 架构

- 使用 Node.js 22、严格 TypeScript 和 ESM/NodeNext。
- `src/core/` 保存与运行环境无关的应用、会话、缓存、画像和星云逻辑。
- `src/zhihu/` 是唯一访问知乎 OAuth/OpenAPI 的层。
- `src/adapters/node-server.ts` 提供本地内存适配器；`src/worker.ts` 在生产环境连接 Cloudflare Assets、Durable Object 会话与 KV 内容缓存。
- 核心处理器只使用 Web Platform 的 `Request`、`Response`、`URL`、`fetch` 和 `crypto`，确保两个适配器行为一致。

## API 与安全规则

- `../docs/api-contract.md` 是接口事实来源。公开路由、载荷、错误、认证、缓存或 CORS 变化时必须同步更新。
- JSON 响应保持 `{ ok, data }` / `{ ok: false, error }` 包装和有意义的 HTTP 状态码。
- 在请求边界校验并限制查询参数；通过现有错误类型规范化上游错误，不返回原始响应。
- OAuth Token 和两类知乎密钥始终留在服务端，不得记录、返回、写入前端变量或提交 `.env`/`.dev.vars`。
- 保持 OAuth state 校验、`HttpOnly` Session Cookie、`SameSite=Lax`、生产环境 `Secure`、有限 TTL 和精确来源的凭据 CORS。
- OAuth 流程在 Session 存储中原子创建和消费 10 分钟有效的 state，重复入口复用同一待处理流程；退出时删除服务端 Session 并过期 Cookie。
- OAuth 回调提交必须比较已认领的流程标识；旧回调不得覆盖新流程或在退出后重建 Session。
- 鉴权 Session 不得使用 Worker isolate 内的正向缓存，避免退出或换号后继续读取旧 Token。
- 未携带有效 Session 的 OAuth 状态查询必须保持只读；缺少 `state` 的回调仅可在同一 Session 已发起授权时降级接受，并向前端保留未验证状态。
- 用户画像缓存必须绑定 OAuth Token 指纹；公开接口不提供缓存绕过参数，避免换号、Session 轮换导致串数据或放大知乎用户接口调用。
- 知乎 `/user` 没有稳定响应 schema；公开资料解析需兼容已观测的顶层/嵌套对象与头像字段。已有 Session 补取资料时按 Token 指纹缓存，不用普通 Session 覆盖写。
- 除非任务明确修改契约，否则保持缓存 TTL、旧数据降级、请求合并和失败退避。
- 静态资源由 Worker binding 处理；后端路由限制为 `/api/*`、`/login` 和 `/auth/callback`。

## 命令与检查

```bash
npm run check
npm run typecheck
npm run build
npm run dev
npm run cf:dev
```

- 每次服务端改动都运行类型检查；集成或部署接线变化时同时运行根目录 `npm run build`。
- `check:*` 脚本使用固定本地数据，不消耗配额。`prepare:hot-spectrums` 需要 `ZHIHU_ACCESS_SECRET`，并消耗知乎与 AI 配额，只能在明确准备候选快照时运行。
- 回答采集和任何 AI 星图生成是本地运营能力，不得注册为匿名公网路由。
- 仅在用户明确要求时运行 `deploy`、`cf:secret`，或修改 KV Namespace、Durable Object 迁移。
