# React 应用外壳

## 职责

- `App.tsx` 管理 `/`、`/nebula` 和 `/shelf/:cast` 路由。
- `Home.tsx` 组合人格卡波浪 iframe 与问题搜索入口；带 `confirm=1` 时交给 `Nebula.tsx` 承载 Three.js 确认流程；`Shelf.tsx` 解析人格或人物并打开 `CardDraw.tsx`。
- 复杂场景实现保留在各自 iframe 中。React 负责路由、外壳、可恢复的导航状态和人格卡 UI，不重复场景逻辑。

## 本地约定

- 沿用严格 TypeScript、函数组件、Hooks 和命名导出。
- 复用 `cast.ts` 中的 `CASTS`、`castByKey`、`asset` 和 `withVersion`；不要手工拼接公开资源路径或重复人格校验。
- 使用路由、查询参数和 Session Storage 前先校验。未知人格返回首页，未知或非法快照 id 回退到文档规定的默认值。
- 保持现有 Session Storage 键及其降级行为；存储不可用时导航仍须正常。
- iframe 消息保持小而明确。消息变化时同时更新发送端和接收端，并按 iframe 模型校验 `event.origin` 或 `event.source`。
- 账号画像和临时人格上下文必须绑定已校验的账号版本；标签重新可见、切号或退出时使旧异步请求和旧画像失效。传给 iframe 的身份变化只使用不透明修订号，不传账号指纹。
- 单一路由内即可管理的状态不引入状态库或额外组件抽象。
- 保持 `prefers-reduced-motion`、语义化控件、焦点行为、iframe 标题和有效图片替代文本。

## 验证

运行 `npm run build`。路由或 iframe 变化时，手动检查直接受影响的跳转、浏览器返回/退出，以及根域名和配置基础路径下的资源解析。
