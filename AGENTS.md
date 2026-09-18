# 思想银河

## 产品定位

- 对外名称：**思想银河**
- 黑客松赛道：**灵魂匹配局：社区连接与兴趣社交**
- 产品方案：<https://my.feishu.cn/wiki/WsfvwI271i19wSkOjz2cwQPlnOd>
- 赛事手册：<https://my.feishu.cn/docx/Mc80dR5XvoPaYDxcTasc04POnjd>
- 核心价值：利用 AI 将信息密集的知乎讨论转化为可探索的观点银河，帮助用户理解讨论全貌、定位自己及关注对象、接触对立观点并发现相关社群。

## 产品结构

本仓库是“思想银河”的正式实现。

- `src/`：React 19 应用外壳，负责大厅、星云、书架和人格卡流程的路由。
- `public/nebula-scene/`：使用原生 HTML、CSS、JavaScript 和 Three.js 实现的星云体验及人工验收的观点快照。
- `public/books/` 和 `public/personas/`：静态书架与人格形象素材。
- `public/kanshan/`：体验中使用的刘看山展示素材。
- `server/`：部署为 Cloudflare Worker 的 Node 22 TypeScript 服务，负责 OAuth、知乎开放平台访问、Durable Object 会话、KV 缓存，并托管 `dist/`。
- `docs/api-contract.md`：前后端边界和公开响应结构的唯一事实来源。

正式环境地址为 `https://soular.top/`；开源仓库为 `Duang777/soular`，GitHub Pages 在 `/soular/` 下提供静态镜像。

## 赛事约束

- 必交材料是可公开运行的体验链接和产品计划书。计划书需说明核心创意、技术实现、与知乎生态的契合度及用户价值；公开代码仓库和演示视频是可选加分材料。
- 产品决策应对齐初审权重：AI 场景价值 40%、创新度 25%、完成度 25%、产品体验与设计感 10%。
- 保留原创过程证据。禁止批量爬取知乎、滥用用户数据，或使用未经授权的第三方商标、人像及版权素材。
- 知乎 API 存在调用配额，必须保留缓存机制；上游 API 或 AI 能力不可用时，正式体验仍应可用。
- 主办方提供的刘看山素材仅限赛事期间使用，赛后不得将其视为可自由商用资产。

## 常用命令

```bash
npm run dev                  # 在 4325 端口启动 Vite
npm run build                # TypeScript 检查并构建生产包
npm run preview              # 预览生产构建
npm run server:dev           # 启动本地 Node 服务
npm run server:check         # 服务端类型与安全回归
npm run server:typecheck     # 检查服务端 TypeScript
```

使用 Node.js 22 或更高版本。缺少依赖时使用 `npm ci` 完成干净安装；未修改依赖时不要重新生成锁文件。

## 不可破坏的约束

- 正式星云数据只读取已提交的静态快照，页面加载不得调用知乎或 AI API；站内搜索只查本地快照，用户主动打开热榜时才能调用接口契约中的只读热榜接口。
- 回答采集和任何 AI 星图生成只能由本地运营脚本触发，不得暴露为匿名公网接口。
- 浏览器代码绝不能接收 `ZHIHU_ACCESS_SECRET`、`ZHIHU_OAUTH_APP_KEY`、OAuth Token 或原始会话数据。
- 通过现有基础路径辅助函数构建资源 URL，确保根域名和 GitHub Pages 子路径均可使用。
- iframe 与 React 之间继续使用现有 `postMessage` 协议，并在边界处校验来源、窗口对象、标识符和载荷类型。
- 保留基本无障碍能力、减少动态效果设置、键盘退出与焦点行为，以及至少 44 px 的移动端触控区域。
- 不要编辑生成的 `dist/` 输出或仓库内的第三方 Three.js 文件。
- 除非用户明确要求，否则不要部署。
- 正式部署只能从与 `origin/main` 完全一致的干净 `main` 执行，并记录对应 Git SHA。

## 改动验证

- 修改前端或共享代码后运行 `npm run build`。
- 修改服务端后运行 `npm run server:check`；路由、字段、缓存、认证或部署边界发生变化时同步更新 `docs/api-contract.md`。
- 交付前运行 `git diff --check` 并检查 `git status`，避免混入无关改动。
- 修改可见交互后，手动检查桌面视口和 390 px 移动端宽度。验证受影响的路由、快照切换、iframe 导航和键盘操作，不要只检查首页能否加载。
- 项目没有通用测试运行器。仅为新增且不简单的纯逻辑增加聚焦、可运行的检查；不要只为小改动引入测试框架。

## 功能规格

- `spec.md` 是产品行为、功能状态和验收标准的唯一规格入口。
- 每项新增或变更的用户功能，都必须同步更新 `spec.md` 中对应的功能规格、状态、验收标准和验证记录。
- 接口路径、请求响应字段、错误码、缓存、认证或跨域行为变化时，同步更新 `docs/api-contract.md`。
- 对外能力、运行方式、架构图、目录或授权边界变化时，同步更新 `README.md`。
- 长期协作约束变化时更新本文件，不把产品规格或接口明细复制到这里。
- 代码通过验证但上述受影响文档尚未同步时，该功能不视为完成。
