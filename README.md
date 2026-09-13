<h1 align="center">
  <img src="./public/brand/soular-logo.svg?v=3" width="480" alt="思想银河 Soular" />
</h1>

<p align="center"><strong>把一场讨论，变成一张可以漫游的观点地图。</strong></p>

<p align="center">
  每颗星对应一条真实回答，位置代表立场，距离呈现分歧。<br />
  沿着光谱阅读、点赞和比较，最后找到自己在讨论中的坐标。
</p>

<p align="center">
  <a href="https://soular.top/"><strong>soular.top</strong></a> ·
  <a href="https://soular.top/nebula?preset=ai-math">探索真实热点</a> ·
  <a href="https://duang777.github.io/soular/">GitHub Pages</a> ·
  <a href="https://my.feishu.cn/wiki/WsfvwI271i19wSkOjz2cwQPlnOd">产品方案</a>
</p>

<p align="center"><code>React 19</code> · <code>TypeScript</code> · <code>Three.js</code></p>

![思想银河封面：人格猫的尾巴卷成承载不同观点的星云轨道](./docs/images/soular-cover-childlike.png)

> 思想银河不替用户给结论。它把讨论的结构摊开，让观点、分歧和人与人的距离变得可见。

## 现在就能体验

| 入口 | 地址 | 适合体验 |
| --- | --- | --- |
| 正式站 | [https://soular.top](https://soular.top/) | 完整产品流程 |
| 真实热点星云 | [AI 是否正在毁掉数学？](https://soular.top/nebula?preset=ai-math) | 31 位真实回答者与观点光谱 |
| 静态镜像 | [GitHub Pages](https://duang777.github.io/soular/) | 纯静态体验 |
| 开源仓库 | [Duang777/soular](https://github.com/Duang777/soular) | 源码、文档与本地运行 |

## 一次完整体验

1. **进入讨论**：选择一场已经发布的热点星云，从全局看到立场如何分布。
2. **阅读观点**：悬停查看核心主张，筛选立场，按需回到知乎原文核验上下文。
3. **留下坐标**：点赞认可的回答，星位会随着选择实时移动。
4. **抽取人格**：把这次探索沉淀为观点人格卡和可交互的 3D 人格书。
5. **校准画像**：在正式站连接知乎账号，用公开兴趣关键词辅助同频与互补观点匹配。

<table>
  <tr>
    <td width="34%" align="center">
      <img src="./docs/images/mobile-observatory.jpg" alt="移动端星云观测站与模式切换" />
      <br />
      <sub>移动端观测站</sub>
    </td>
    <td width="66%" align="center">
      <img src="./docs/images/personality-shelf.jpg" alt="九种观点人格组成的银河书架" />
      <br />
      <sub>九种观点人格组成的银河书架</sub>
    </td>
  </tr>
  <tr>
    <td width="34%" align="center">
      <img src="./docs/images/mobile-personality-card.jpg" alt="盐选派移动端观点人格卡" />
      <br />
      <sub>可分享的观点人格卡</sub>
    </td>
    <td width="66%" align="center">
      <img src="./docs/images/personality-book.jpg" alt="盐选派 3D 人格书详情" />
      <br />
      <sub>可交互的 3D 人格书</sub>
    </td>
  </tr>
</table>

## 为什么是银河

一个热门问题下可能有数百条回答。纵向信息流适合逐篇阅读，却很难看清整场讨论的形状：主要立场分布在哪里，彼此距离有多远，自己认同的人和相反观点的人分别是谁。

思想银河把回答放到 `-1..1` 的连续光谱上。每个主题都有自己的左右两极和中间语义，中间立场、复杂观点和不确定性都可以保留下来。星云既是一张讨论地图，也是用户理解他人、定位自己和发现关系的入口。

## AI 负责提炼，人负责发布

公开星云都在发布前离线整理：

1. 从热门讨论和用户提名中选择主题。
2. AI 批量提炼立场、论点和光谱语义。
3. 人工检查原文链接、摘要、作者信息与立场。
4. 将通过验收的内容发布为静态快照。

网页只读取已审核快照，同一主题每次打开都保持稳定。

## 技术实现

| 模块 | 技术 | 职责 |
| --- | --- | --- |
| 产品外壳 | React 19、React Router、TypeScript | 路由、导航状态、书架和人格卡 |
| 观点星云 | Three.js、原生 HTML/CSS/JavaScript | 3D 光谱、筛选、阅读与互动 |
| 数据快照 | 静态 ES Modules | 承载人工验收后的问题、回答者和立场 |
| 发布 | 静态构建 | 正式站与 GitHub Pages 镜像 |

产品行为和验收状态见 [`spec.md`](./spec.md)。

## 本地运行

需要 Node.js 22+ 和 npm 10+。安装依赖后即可体验完整静态内容：

```bash
git clone https://github.com/Duang777/soular.git
cd soular
npm ci
npm run dev
```

打开 <http://localhost:4325/>。真实热点快照可直接访问：

```text
http://localhost:4325/nebula?preset=ai-math
```

<details>
<summary><strong>常用开发命令</strong></summary>

<br />

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run build` | 执行 TypeScript 检查并构建前端 |
| `npm run preview` | 本地预览生产构建 |
| `npm run check:navigation` | 检查星云与人格卡导航契约 |

</details>

## 代码结构

```text
.
├── src/                          # React 路由、应用外壳与人格卡
├── public/
│   ├── brand/                    # Logo、站点图标与品牌资产
│   ├── nebula-scene/             # Three.js 星云、交互与静态快照
│   ├── personas/                 # 九派人格插画
│   ├── books/                    # 3D 人格书场景
│   └── kanshan/                  # 刘看山展示素材
├── docs/
│   └── images/                   # README 产品截图
├── spec.md                       # 产品行为与验收状态
└── THIRD_PARTY_NOTICES.md        # 第三方代码与许可说明
```

## 发布新的观点主题

正式场景使用离线、可审查的快照，不在浏览器中直接调用知乎或 AI：

1. 从热门讨论或用户提名中选择主题，离线整理候选观点。
2. 人工检查立场、摘要、来源与图片授权，并补充作者展示信息。
3. 在 `public/nebula-scene/` 新增 `preset-<id>.js`，回答变化时同步更新内容版本。
4. 在 `public/nebula-scene/presets.js` 注册快照，并同步 `src/people.ts` 的版本目录。
5. 运行 `npm run build`，并在桌面端与 390 px 移动端验证交互。

## 参与项目

欢迎通过 Issue 提交问题、产品建议和新主题提案，也欢迎提交聚焦、可验证的 Pull Request。

- 保持改动范围清晰，不提交生成产物或本地状态。
- 涉及真实知乎内容时，必须保留可核验的来源链接并进行人工复核。
- 修改前端后运行 `npm run build`。

## 数据与授权

- 网页运行时只读取已审核的观点快照。
- 点赞按快照版本保存在当前浏览器，不承诺跨设备同步。
- 知乎画像只作为兴趣底色，不改变用户在单个问题中的表态；原始创作、关注和收藏明细不会进入星云或分享链接。
- 真实观点快照来自公开可访问的知乎内容，仓库仅保留体验所需的摘要、来源和展示信息。
- 第三方代码许可见 [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md)。
- 刘看山等赛事素材遵循主办方授权范围，仅限赛事期间使用，未经授权不得商用。

项目原创代码采用 [MIT License](./LICENSE) 开源。第三方代码、知乎内容、用户头像、刘看山及其他赛事素材不因此获得 MIT 授权，使用时须分别遵循其来源方条款。

## 关于项目

思想银河是 **知乎黑客松 2026 · 校园新锐季**“灵魂匹配局：社区连接与兴趣社交”赛道作品。

- [产品方案与原始创意](https://my.feishu.cn/wiki/WsfvwI271i19wSkOjz2cwQPlnOd)
- [赛事开发者手册](https://my.feishu.cn/docx/Mc80dR5XvoPaYDxcTasc04POnjd)
- [知乎开放平台](https://developer.zhihu.com/)

由 [Duang777](https://github.com/Duang777) 发起并维护。
