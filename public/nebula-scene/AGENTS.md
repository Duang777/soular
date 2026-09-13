# 观点星云场景

## 运行模型

- `index.html` 是通过 iframe 加载的原生 HTML、CSS、JavaScript 与 Three.js 自包含场景。
- `presets.js` 负责快照注册与降级选择；`preset-ai-math.js` 等文件保存离线整理的数据。
- `vendor/` 是已提交的第三方代码。产品功能改动不得编辑它；依赖升级时才可修改，并同步检查声明与许可。
- 通过 Vite 或部署站点运行场景；`file://` 不保证 ES Module 和资源路径正常。

## 快照契约

- 快照 id 缺失或未知时，默认 `career-35` 必须仍可加载。
- 不同快照可包含不同数量的讨论者，不得重新引入“固定 48 人”的假设。
- 保持契约字段完整：身份信息、不可变内容 `version`、`kind`、光谱文案、人物元组、可选 `avatarBase`、followed/comments/circles 和 `me`。
- 人物增删、重排或换源时必须更新 `version`。点赞按 `id + version` 隔离，复用旧版本会让旧索引指向错误人物。
- 新增快照或更新版本时，同时更新 `src/people.ts` 中的 `NEBULA_PRESET_VERSIONS`，并运行导航契约检查。
- 人物元组为 `[name, stance, cast, claim, sourceUrl?, sourceTitle?, votes?]`；`stance` 必须位于 `-1..1`，`cast` 必须存在于 React 的 `CASTS` 中。
- 真实快照必须人工检查文案、本地头像和来源链接。星云数据保持静态，场景页不得生成观点光谱。
- 快照字段或行为变化时同步更新 `docs/api-contract.md`。

## 交互边界

- 保留 `?preset=` 选题和传入 `v` 参数的模块缓存更新机制。
- 搜索只查询本地快照目录。用户主动打开热榜时可调用已记录的只读接口；推荐接口正式确立前保持本地开发状态。页面初始化不得发起发现请求，发现结果不得修改当前快照。
- 保留父子页消息协议：`nebula-scene-ready`、`nebula-host-ready`、`nebula-user-profile`、`nebula-view-change`、`nebula-preset-change`、`nebula-open` 和 `nebula-open-ack`。
- `nebula-user-profile` 只接收经过 React 外壳筛选的公开昵称、HTTPS 知乎图片域名头像、裁剪后的兴趣信号和不透明的身份修订号；不得传递账号指纹、OAuth Token、Session 或其他账号字段。身份修订号变化时必须清理旧头像及画像相关的碰撞、圈子和聚焦状态。
- 快照或接口字符串必须通过 `textContent` 和显式属性渲染，不得拼接进 `innerHTML`；来源链接只接受 HTTPS 知乎域名。
- 点赞保存在本地并按快照版本隔离；切换视图或点赞不得意外重置搜索、筛选和滚动位置。
- 保持加载/错误降级、减少动态效果、键盘导航、Escape 操作和移动端无溢出。

## 验证

在仓库根目录运行 `npm run build`，然后分别以桌面和 390 px 宽度检查受影响快照的星云与卡片视图。检查控制台错误、头像与来源加载、筛选/搜索、点赞、卡片导航及返回星云流程。
