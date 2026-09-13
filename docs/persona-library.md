# 主题人格库

## 目标与边界

主题人格库把稳定的九个 `cast` 槽位映射为与问题主题相关的人物原型。浏览器只读取随版本发布、
已经人工验收的静态数据，不在运行时调用 AI 选择人物。

产品依据为[思想银河 PRD](https://my.feishu.cn/wiki/HGXVwfSmBiCZBWkvkr3cq1WwnDd)
revision 1821 中的“人格卡”章节。当前采用更严格的人物边界：

- 人物原型只描述用户在当前问题中的表达倾向，不代表真实身份、长期人格或人物背书。
- 不选择中国近代及以后人物；“以鲁迅为边界”按包含鲁迅及其后人物均排除处理。
- 主题未完成、标识未知、数据不完整或模块加载失败时，继续使用原有九派。
- 现阶段不使用历史人物真实肖像。九张视觉素材均为项目已有的原创抽象插画，
  只承担人格符号作用，不声称还原人物外貌。

## 数据契约

唯一运行时数据源是 [`public/persona-library.js`](../public/persona-library.js)，
React 人格卡、静态 Three.js 星云和 3D 人格书共同读取该模块。

```ts
type PersonaTheme = {
  id: string
  name: string
  status: "planned" | "ready"
  scopes: readonly string[]
  source: `https://${string}`
  selectionBoundary?: string
  personas?: readonly PersonaPrototype[]
}

type PersonaPrototype = {
  id: string
  slot: "fox" | "bear" | "cat" | "owl" | "rabbit"
    | "penguin" | "redpanda" | "goat" | "frog"
  name: string
  role: string
  description: string
  signals: readonly string[]
  origin: "china" | "western"
  period: "ancient" | "pre-modern" | "modern-deceased"
  selectionReason: string
  portrait: `personas/${string}.jpg`
  art: {
    kind: "project-original-symbolic-illustration"
    provenance: string
    usage: string
    license: "project-specific"
    historicalLikeness: false
    reviewed: true
  }
}
```

一个 `ready` 主题必须恰好覆盖九个稳定槽位，且人物 id、名称和槽位均不可重复。
快照通过 `personaTheme` 绑定主题。`cast` key 继续用于分类、点赞计算、Session Storage、
分享 URL 和路由，因此旧链接无需迁移。

## 一级主题

| id | 主题 | 状态 |
| --- | --- | --- |
| `life-choices` | 人生选择、生活方式与精神世界 | 已验收 |
| `relationships-family` | 亲密关系与家庭 | 待建设 |
| `education-growth` | 教育成长与自我实现 | 待建设 |
| `work-tech-future` | 工作、科技与未来 | 待建设 |
| `society-law-public-life` | 社会伦理、法律与公共生活 | 待建设 |
| `wealth-business-consumption` | 财富、商业与消费 | 待建设 |
| `history-war-strategy` | 历史、战争与策略 | 待建设 |
| `science-health-life` | 科学、健康与生命 | 待建设 |

## 首个主题

`career-35` 绑定 `life-choices`。九位人物覆盖顺势、精神自由、主动退出、现实调和、
低欲求稳、荒诞中行动、自我超越、道德自省和个体边界九种互补方向。

| 稳定槽位 | 人物 | 角色描述 | 选择理由 | 视觉素材 |
| --- | --- | --- | --- | --- |
| `bear` | 老子 | 顺势而为、减少内耗 | 覆盖随环境调整、降低内耗和保存余地 | `personas/bear.jpg` |
| `goat` | 庄子 | 精神自由、拒绝外部标准 | 覆盖拒绝年龄、职位和社会模板定义价值 | `personas/goat.jpg` |
| `frog` | 陶渊明 | 退守自足、远离功利 | 覆盖主动退出和换取生活自主 | `personas/frog.jpg` |
| `cat` | 苏轼 | 旷达调和、在限制中寻找乐趣 | 覆盖现实限制内的弹性选择 | `personas/cat.jpg` |
| `penguin` | 伊壁鸠鲁 | 低欲生活、朴素快乐 | 覆盖降薪求稳和日常安宁 | `personas/penguin.jpg` |
| `redpanda` | 加缪 | 承认荒诞、仍然选择行动 | 覆盖看清不确定性后的行动与承担 | `personas/redpanda.jpg` |
| `fox` | 尼采 | 自我超越、主动创造价值 | 覆盖通过积累、转型或进阶创造价值 | `personas/fox.jpg` |
| `owl` | 托尔斯泰 | 道德自省、回到朴素生活 | 覆盖焦虑、责任和成功标准重估 | `personas/owl.jpg` |
| `rabbit` | 弗吉尼亚·伍尔夫 | 个体边界、精神独立 | 覆盖职业自主、身份边界和自我表达 | `personas/rabbit.jpg` |

## 素材验收

九张素材位于 `public/personas/`，均为 512 × 512 JPEG，文件各自独立且大于 10 KB。
素材来源、用途、是否模拟历史外貌和验收状态写入每个人格的 `art` 字段，并由
`npm run check:personas` 自动检查。

这些插画不依赖刘看山等赛事授权素材，也不从第三方站点加载。项目 MIT License
只覆盖代码；人格插画继续遵循项目素材的独立授权边界，未经权利人确认不自动获得
再分发或商业使用许可。

## 扩展流程

1. 从八个一级主题中选择一项，并完成九位互补人物的内容审查。
2. 为每位人物填写稳定 id、九派槽位、角色描述、选择理由、适用信号和素材记录。
3. 将主题状态改为 `ready`；未满九位时不得发布。
4. 在对应快照增加 `personaTheme`，并补充 `PERSONA_PRESET_THEME_IDS` 映射。
5. 运行 `npm run check:personas` 和 `npm run build`，再检查桌面端与 390 px 移动端。
