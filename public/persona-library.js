export const PERSONA_LIBRARY_SCHEMA_VERSION = 1;

export const PERSONA_SLOT_KEYS = Object.freeze([
  "fox",
  "bear",
  "cat",
  "owl",
  "rabbit",
  "penguin",
  "redpanda",
  "goat",
  "frog",
]);

export const LEGACY_PERSONAS = Object.freeze({
  fox: Object.freeze({
    key: "fox",
    name: "长答派",
    role: "万字长答",
    color: "#aeb6d6",
    portrait: "personas/fox.jpg",
  }),
  bear: Object.freeze({
    key: "bear",
    name: "拆题派",
    role: "先重述问题",
    color: "#9fd2d6",
    portrait: "personas/bear.jpg",
  }),
  cat: Object.freeze({
    key: "cat",
    name: "盐选派",
    role: "精选长文",
    color: "#e3b27e",
    portrait: "personas/cat.jpg",
  }),
  owl: Object.freeze({
    key: "owl",
    name: "深夜派",
    role: "三点的诚实",
    color: "#dde08a",
    portrait: "personas/owl.jpg",
  }),
  rabbit: Object.freeze({
    key: "rabbit",
    name: "提问派",
    role: "把问题问清楚",
    color: "#dba3e6",
    portrait: "personas/rabbit.jpg",
  }),
  penguin: Object.freeze({
    key: "penguin",
    name: "收藏派",
    role: "先存再看",
    color: "#9cc2ee",
    portrait: "personas/penguin.jpg",
  }),
  redpanda: Object.freeze({
    key: "redpanda",
    name: "圆桌派",
    role: "把人拉齐",
    color: "#ee9d72",
    portrait: "personas/redpanda.jpg",
  }),
  goat: Object.freeze({
    key: "goat",
    name: "杠精派",
    role: "先找反例",
    color: "#bccf96",
    portrait: "personas/goat.jpg",
  }),
  frog: Object.freeze({
    key: "frog",
    name: "想法派",
    role: "三百字闪过",
    color: "#93d6a4",
    portrait: "personas/frog.jpg",
  }),
});

const PRODUCT_PRD =
  "https://my.feishu.cn/wiki/HGXVwfSmBiCZBWkvkr3cq1WwnDd";

const PROJECT_ART_RIGHTS = Object.freeze({
  kind: "project-original-symbolic-illustration",
  provenance: "思想银河现有九派原创抽象插画",
  usage: "思想银河项目与本次赛事展示",
  license: "project-specific",
  historicalLikeness: false,
  reviewed: true,
});

const LIFE_CHOICES_PERSONAS = Object.freeze([
  Object.freeze({
    id: "laozi",
    slot: "bear",
    name: "老子",
    role: "顺势而为、减少内耗",
    description: "人生不是性能压测，能少拧一颗心里的螺丝，就不把自己跑到满负载。",
    signals: Object.freeze(["顺势调整", "降低欲望", "保存余地"]),
    origin: "china",
    period: "pre-modern",
    selectionReason: "覆盖随环境调整、减少内耗和不与外部节奏硬碰的选择。",
    portrait: "personas/bear.jpg",
    art: PROJECT_ART_RIGHTS,
  }),
  Object.freeze({
    id: "zhuangzi",
    slot: "goat",
    name: "庄子",
    role: "精神自由、拒绝外部标准",
    description: "别人忙着给人生打分，他先把评分表叠成纸船，放进逍遥游里。",
    signals: Object.freeze(["拒绝标签", "精神自由", "反问标准"]),
    origin: "china",
    period: "pre-modern",
    selectionReason: "覆盖拒绝年龄、职位和社会模板定义个人价值的观点。",
    portrait: "personas/goat.jpg",
    art: PROJECT_ART_RIGHTS,
  }),
  Object.freeze({
    id: "tao-yuanming",
    slot: "frog",
    name: "陶渊明",
    role: "退守自足、远离功利",
    description: "KPI 冲到门口，他把通知静音，回去照料自己真正想种的那块地。",
    signals: Object.freeze(["主动退出", "自给自足", "远离竞逐"]),
    origin: "china",
    period: "pre-modern",
    selectionReason: "覆盖离职、退场、换取生活自主和降低功利目标的选择。",
    portrait: "personas/frog.jpg",
    art: PROJECT_ART_RIGHTS,
  }),
  Object.freeze({
    id: "su-shi",
    slot: "cat",
    name: "苏轼",
    role: "旷达调和、在限制中寻找乐趣",
    description: "路走窄了就先吃顿好的，再把限制条件改写成一套新玩法。",
    signals: Object.freeze(["弹性应对", "苦中作乐", "兼顾现实"]),
    origin: "china",
    period: "pre-modern",
    selectionReason: "覆盖不走极端、在现实限制内重建生活滋味的观点。",
    portrait: "personas/cat.jpg",
    art: PROJECT_ART_RIGHTS,
  }),
  Object.freeze({
    id: "epicurus",
    slot: "penguin",
    name: "伊壁鸠鲁",
    role: "低欲生活、朴素快乐",
    description: "快乐不必塞满购物车，把欲望调低一点，日子反而自动切到高清。",
    signals: Object.freeze(["低欲生活", "稳定安全", "朴素满足"]),
    origin: "western",
    period: "ancient",
    selectionReason: "覆盖降薪求稳、减少消费压力和重视日常安宁的观点。",
    portrait: "personas/penguin.jpg",
    art: PROJECT_ART_RIGHTS,
  }),
  Object.freeze({
    id: "camus",
    slot: "redpanda",
    name: "加缪",
    role: "承认荒诞、仍然选择行动",
    description: "荒诞每天准时打卡，他也准时把石头往上推，顺便给行动留个备选方案。",
    signals: Object.freeze(["直面荒诞", "持续行动", "承担选择"]),
    origin: "western",
    period: "modern-deceased",
    selectionReason: "覆盖看清不确定性后仍主动转向、试错和承担后果的观点。",
    portrait: "personas/redpanda.jpg",
    art: PROJECT_ART_RIGHTS,
  }),
  Object.freeze({
    id: "nietzsche",
    slot: "fox",
    name: "尼采",
    role: "自我超越、主动创造价值",
    description: "不接收默认人生模板，旧价值跑不动了，就亲手发布自己的新版本。",
    signals: Object.freeze(["自我超越", "创造价值", "主动进取"]),
    origin: "western",
    period: "modern-deceased",
    selectionReason: "覆盖通过积累、转型或进阶主动创造个人价值的观点。",
    portrait: "personas/fox.jpg",
    art: PROJECT_ART_RIGHTS,
  }),
  Object.freeze({
    id: "tolstoy",
    slot: "owl",
    name: "托尔斯泰",
    role: "道德自省、回到朴素生活",
    description: "先审一遍自己的良心，再把生活删到只剩真正重要、真正愿意承担的部分。",
    signals: Object.freeze(["道德自省", "重估生活", "朴素责任"]),
    origin: "western",
    period: "modern-deceased",
    selectionReason: "覆盖焦虑、自省、家庭责任与重新衡量成功标准的观点。",
    portrait: "personas/owl.jpg",
    art: PROJECT_ART_RIGHTS,
  }),
  Object.freeze({
    id: "virginia-woolf",
    slot: "rabbit",
    name: "弗吉尼亚·伍尔夫",
    role: "个体边界、精神独立",
    description: "先给思想留一间自己的房间，边界清楚了，选择才真正属于自己。",
    signals: Object.freeze(["个人边界", "精神独立", "自我表达"]),
    origin: "western",
    period: "modern-deceased",
    selectionReason: "覆盖独居、职业自主、身份边界和不被关系吞没的观点。",
    portrait: "personas/rabbit.jpg",
    art: PROJECT_ART_RIGHTS,
  }),
]);

export const PERSONA_THEMES = Object.freeze([
  Object.freeze({
    id: "life-choices",
    name: "人生选择、生活方式与精神世界",
    status: "ready",
    scopes: Object.freeze([
      "离职",
      "转行",
      "独居",
      "买房",
      "旅行",
      "躺平",
      "自律",
      "人生意义",
      "阅读",
      "审美选择",
    ]),
    source: PRODUCT_PRD,
    selectionBoundary:
      "仅用于当前问题中的表达倾向；不推断长期人格。中国近代人物自鲁迅起均不纳入候选。",
    personas: LIFE_CHOICES_PERSONAS,
  }),
  Object.freeze({
    id: "relationships-family",
    name: "亲密关系与家庭",
    status: "planned",
    scopes: Object.freeze([
      "恋爱",
      "婚姻",
      "分手",
      "友情",
      "亲子关系",
      "代际冲突",
      "情感边界",
      "家庭责任",
    ]),
    source: PRODUCT_PRD,
  }),
  Object.freeze({
    id: "education-growth",
    name: "教育成长与自我实现",
    status: "planned",
    scopes: Object.freeze([
      "鸡娃",
      "应试教育",
      "兴趣培养",
      "努力和天赋",
      "学习方法",
      "成长焦虑",
      "个人潜能",
      "教育公平",
    ]),
    source: PRODUCT_PRD,
  }),
  Object.freeze({
    id: "work-tech-future",
    name: "工作、科技与未来",
    status: "planned",
    scopes: Object.freeze([
      "职场",
      "转行",
      "AI",
      "互联网",
      "效率",
      "技术进步",
      "自动化",
      "管理",
      "职业风险",
      "未来生活",
    ]),
    source: PRODUCT_PRD,
  }),
  Object.freeze({
    id: "society-law-public-life",
    name: "社会伦理、法律与公共生活",
    status: "planned",
    scopes: Object.freeze([
      "道德义务",
      "公共规则",
      "弱者保护",
      "个人自由",
      "社会公平",
      "公共资源",
      "法律边界",
      "社会责任",
    ]),
    source: PRODUCT_PRD,
  }),
  Object.freeze({
    id: "wealth-business-consumption",
    name: "财富、商业与消费",
    status: "planned",
    scopes: Object.freeze([
      "创业",
      "赚钱",
      "买房",
      "投资",
      "消费",
      "阶层流动",
      "财富自由",
      "商业伦理",
      "公司经营",
    ]),
    source: PRODUCT_PRD,
  }),
  Object.freeze({
    id: "history-war-strategy",
    name: "历史、战争与策略",
    status: "planned",
    scopes: Object.freeze([
      "古代战争",
      "领导力",
      "组织决策",
      "竞争",
      "危机处理",
      "战略选择",
      "进攻",
      "防守",
    ]),
    source: PRODUCT_PRD,
  }),
  Object.freeze({
    id: "science-health-life",
    name: "科学、健康与生命",
    status: "planned",
    scopes: Object.freeze([
      "医学",
      "心理健康",
      "健身",
      "疾病",
      "基因",
      "科学争议",
      "衰老",
      "死亡",
    ]),
    source: PRODUCT_PRD,
  }),
]);

export const PERSONA_PRESET_THEME_IDS = Object.freeze({
  "career-35": "life-choices",
});

function isCompletePersonaSet(personas) {
  if (!Array.isArray(personas) || personas.length !== PERSONA_SLOT_KEYS.length) {
    return false;
  }
  const slots = new Set();
  const ids = new Set();
  const names = new Set();
  for (const persona of personas) {
    if (
      !persona ||
      !PERSONA_SLOT_KEYS.includes(persona.slot) ||
      typeof persona.id !== "string" ||
      !/^[a-z0-9-]+$/.test(persona.id) ||
      typeof persona.name !== "string" ||
      !persona.name.trim() ||
      typeof persona.role !== "string" ||
      !persona.role.trim() ||
      typeof persona.description !== "string" ||
      !persona.description.trim() ||
      !Array.isArray(persona.signals) ||
      persona.signals.length < 3 ||
      !persona.signals.every(
        (signal) => typeof signal === "string" && signal.trim(),
      ) ||
      typeof persona.selectionReason !== "string" ||
      !persona.selectionReason.trim() ||
      !["china", "western"].includes(persona.origin) ||
      !["ancient", "pre-modern", "modern-deceased"].includes(persona.period) ||
      (persona.origin === "china" && persona.period !== "pre-modern") ||
      typeof persona.portrait !== "string" ||
      !/^personas\/[a-z0-9-]+\.jpg$/.test(persona.portrait) ||
      persona.art?.kind !== "project-original-symbolic-illustration" ||
      typeof persona.art?.provenance !== "string" ||
      !persona.art.provenance.trim() ||
      typeof persona.art?.usage !== "string" ||
      !persona.art.usage.trim() ||
      persona.art?.license !== "project-specific" ||
      persona.art?.historicalLikeness !== false ||
      persona.art?.reviewed !== true
    ) {
      return false;
    }
    slots.add(persona.slot);
    ids.add(persona.id);
    names.add(persona.name);
  }
  return (
    slots.size === PERSONA_SLOT_KEYS.length &&
    ids.size === PERSONA_SLOT_KEYS.length &&
    names.size === PERSONA_SLOT_KEYS.length
  );
}

export function getPersonaTheme(themeId) {
  const theme = PERSONA_THEMES.find(
    (candidate) => candidate.id === themeId && candidate.status === "ready",
  );
  return theme && isCompletePersonaSet(theme.personas) ? theme : null;
}

export function getPersonaThemeForPreset(presetId) {
  return getPersonaTheme(PERSONA_PRESET_THEME_IDS[presetId]);
}

export function resolvePersonaCasts(themeId) {
  const theme = getPersonaTheme(themeId);
  const personasBySlot = new Map(
    theme?.personas?.map((persona) => [persona.slot, persona]) ?? [],
  );

  return PERSONA_SLOT_KEYS.map((key) => {
    const legacy = LEGACY_PERSONAS[key];
    const persona = personasBySlot.get(key);
    if (!persona) return { ...legacy };
    return {
      ...legacy,
      name: persona.name,
      role: persona.role,
      portrait: persona.portrait,
      description: persona.description,
      personaId: persona.id,
      themeId: theme.id,
      themeName: theme.name,
      signals: [...persona.signals],
      selectionReason: persona.selectionReason,
    };
  });
}

export function resolvePersonaCastsForPreset(presetId) {
  return resolvePersonaCasts(PERSONA_PRESET_THEME_IDS[presetId]);
}

export function resolvePersonaCastMap(themeId) {
  return Object.fromEntries(
    resolvePersonaCasts(themeId).map(
      ({ key, name, role, color, portrait, description }) => [
        key,
        [name, role, color, portrait, description],
      ],
    ),
  );
}
