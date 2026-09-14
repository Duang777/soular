const presetModuleVersion = new URL(import.meta.url).searchParams.get("v") || "dev";
const { AI_MATH } = await import(
  `./preset-ai-math.js?v=${encodeURIComponent(presetModuleVersion)}`
);
const { SCHOLARS_AI_MATH } = await import(
  `./preset-scholars-ai-math.js?v=${encodeURIComponent(presetModuleVersion)}`
);
const { SOCIAL_CONNECTIONS } = await import(
  `./preset-social-connections.js?v=${encodeURIComponent(presetModuleVersion)}`
);
const { AI_PROGRAMMER_JOBS } = await import(
  `./preset-ai-programmer-jobs.js?v=${encodeURIComponent(presetModuleVersion)}`
);
const { CITY_OR_HOMETOWN } = await import(
  `./preset-city-or-hometown.js?v=${encodeURIComponent(presetModuleVersion)}`
);
// Keep the source serial compatible with cached six-snapshot registries.
const ACTIVE_SCHOLARS_AI_MATH = { ...SCHOLARS_AI_MATH, serial: "03" };

const CAREER_35 = {
  id: "career-35",
  version: "1",
  serial: "01",
  kind: "mock",
  personaTheme: "life-choices",
  question: "35 岁程序员该不该转行？",
  peopleLabel: "回答者观点",
  searchUrl: "https://www.zhihu.com/search?type=content&q=35%20%E5%B2%81%E7%A8%8B%E5%BA%8F%E5%91%98%E8%AF%A5%E4%B8%8D%E8%AF%A5%E8%BD%AC%E8%A1%8C",
  axis: {
    left: "必须转行",
    center: "中立观察",
    right: "深耕不转",
    leftChoice: "转行",
    rightChoice: "深耕",
    leftTendency: "倾向转行",
    rightTendency: "倾向深耕",
  },
  people: [
    ["等喝茶的老码农", -0.98, "goat", "35 岁还不走，等着公司请你喝茶吗？管理岗就那么几个。"],
    ["拼不过00后的P7", -0.93, "bear", "体力加班都拼不过年轻人，早转管理或业务才是正解。"],
    ["送外卖的Tim", -0.9, "frog", "我已经转了，送外卖都比在工位等优化强。"],
    ["不信青春饭但焦虑", -0.86, "owl", "理智上不承认是青春饭，身体却很诚实地焦虑。"],
    ["前大厂边缘人", -0.82, "redpanda", "别眷恋大厂光环，35 岁前不找出路，之后更被动。"],
    ["十年接口工程师", -0.74, "fox", "干了十年还是写接口，天花板肉眼可见，认真考虑转。"],
    ["降薪去国企的磊", -0.7, "penguin", "降薪去国企我接受，至少不用凌晨两点 oncall。"],
    ["考公上岸的强子", -0.66, "penguin", "已上岸考公，钱少点但命是自己的。"],
    ["离钱更近的阿May", -0.62, "redpanda", "趁还能拼，转去做离钱近的岗位更稳。"],
    ["沪漂老兵", -0.58, "owl", "身边 35+ 还在一线写代码的，真没几个安稳的。"],
    ["转产品的小周", -0.55, "rabbit", "我转产品了，懂技术反而是一种优势。"],
    ["CRUD退役选手", -0.52, "bear", "纯执行的开发最先被替代，得往上走或往外走。"],
    ["背房贷的彬", -0.48, "fox", "房贷压力大，更不敢赌公司留不留我，先动。"],
    ["创业失败回炉的坤", -0.44, "frog", "创业失败回炉，但我不后悔出来看过一眼。"],
    ["卖咖啡的Leo", -0.4, "owl", "转行卖咖啡半年，睡得着觉了，这就够了。"],
    ["看岗位说话的陈", -0.36, "bear", "要不要转看岗位，纯搬砖的岗位确实危险。"],
    ["硬核派观察员", -0.33, "fox", "有硬技术的不用慌，CRUD 选手该早做打算。"],
    ["骑驴找马的辉", -0.3, "redpanda", "我在骑驴找马，先攒管理经验再说。"],
    ["业余独立开发者", -0.27, "frog", "转一半留一半，业余做独立产品先探探路。"],
    ["35岁分水岭", -0.24, "cat", "35 岁是分水岭，但也不是非黑即白。"],
    ["看性价比的楠", -0.2, "goat", "公司裁员不看能力看性价比，得给自己留后手。"],
    ["想转没方向的林", -0.16, "rabbit", "倾向转，但没想好去哪，先观察一阵。"],
    ["没矿求稳的娟", -0.13, "penguin", "家里没矿，求稳的话体制内确实香。"],
    ["学业务的老徐", -0.1, "fox", "与其被动转，不如主动学点业务和商业。"],
    ["不可替代性信徒", -0.06, "cat", "转不转都行，关键看你有没有不可替代性。"],
    ["中立吃瓜架构师", -0.03, "bear", "我中立，见过转好的，也见过转砸的。"],
    ["技术深耕派", 0, "goat", "先把技术做深，年龄歧视是行业问题，不是我的问题。"],
    ["换赛道怀疑论者", 0.03, "owl", "哪里都有 35 岁焦虑，换个赛道未必就没有。"],
    ["算账型选手", 0.06, "penguin", "看存款和家庭，抗风险能力强的可以慢慢选。"],
    ["随时能走的芸", 0.09, "redpanda", "与其纠结年龄，不如保持随时能走的能力。"],
    ["反焦虑的晴", 0.12, "goat", "转行成本很高，别被贩卖焦虑的文章带了节奏。"],
    ["主副业两手抓", 0.15, "cat", "我把鸡蛋放几个篮子，主业副业都做着。"],
    ["判断力值钱", 0.22, "fox", "资深工程师值钱的是判断不是手速，越老越香。"],
    ["十年经验不清零", 0.26, "owl", "我选择深耕，攒了十年的经验凭什么清零。"],
    ["先让自己厉害", 0.3, "bear", "真正厉害的人不会被年龄卡住，先让自己变厉害。"],
    ["优势不归零派", 0.34, "frog", "转行等于把优势归零，除非真的讨厌这行。"],
    ["能扛事的老兵", 0.4, "redpanda", "公司更愿意为能扛事的老兵付溢价。"],
    ["只看活人的峰", 0.45, "cat", "别只看裁员新闻，35+ 技术专家活得好的一大把。"],
    ["转管理不转技术", 0.5, "rabbit", "我在转技术管理，但这不算是离开技术。"],
    ["黄金期刚开始", 0.58, "fox", "黄金期才刚开始，年轻人才有体力没沉淀。"],
    ["踩坑护城河", 0.64, "bear", "复杂系统就得靠踩过坑的人，时间是护城河。"],
    ["换姿势不转行", 0.7, "goat", "绝不转行，换个方式继续写代码而已。"],
    ["学到老的勇", 0.76, "owl", "年龄大的问题不是老，是停止学习，我没停。"],
    ["架构正当年", 0.82, "fox", "带团队做架构正当年，转行才是真浪费。"],
    ["40岁还在一线", 0.88, "cat", "我 40 了还在一线，offer 没断过，焦虑是自己吓自己。"],
    ["核心圈层反驳者", 0.93, "goat", "说程序员 35 就废的，多半自己没做到核心。"],
    ["黄金期论者", 0.96, "fox", "技术人的黄金期在 35 岁后，人脉经验判断力全开。"],
    ["深耕不认输", 1, "bear", "坚决不转，深耕的人从不靠青春吃饭。"],
  ],
  followed: [6, 26, 40],
  comments: [
    ["一楼沙发王", -0.95, "frog", "35 岁还不转行？等着公司请你喝茶吗哈哈哈。", true],
    ["评论区课代表", -0.78, "bear", "总结楼上：早转早超生，晚转被优化。", false],
    ["匿名打工人", -0.7, "owl", "别问，问就是简历已经投出去了。", false],
    ["路过的HR", -0.54, "redpanda", "说句实话，简历上 35 岁真的会先被筛一道。", false],
    ["体制内隔壁老王", -0.4, "penguin", "我同事去年走的，今年天天劝我一起考公。", false],
    ["中立复读机", -0.12, "cat", "看情况，看岗位，也看个人，别一棍子打死。", false],
    ["拱火小号", -0.04, "goat", "吵什么吵，反正都要还房贷。", true],
    ["深夜键盘侠", 0.1, "owl", "我司架构师 40 了，比谁都稳。", false],
    ["只看热评的猫", 0.28, "cat", "高赞说得对，不可替代性才是关键。", false],
    ["十年老粉不请自来", 0.52, "fox", "我师父 42 还在写核心系统，转什么行。", false],
    ["反内卷先锋", 0.7, "goat", "深耕自己的赛道，年龄就是谣言。", false],
    ["楼下保安张叔", 0.88, "bear", "我要是懂技术，35 岁那正是好时候。", true],
  ],
  circles: [
    { members: [0, 1, 4], label: "「趁早转行」互助会" },
    { members: [43, 45, 46], label: "「深耕到底」技术信仰组" },
  ],
  me: {
    name: "我",
    castKey: "fox",
    claim: "点赞几个回答，星云会标出你此刻的立场位置。",
  },
  guide: {
    headline: "35 岁要不要转行：一边是趁早换赛道，一边是继续深耕技术护城河。",
  },
};

const PRESETS = new Map([
  [CAREER_35.id, CAREER_35],
  [AI_MATH.id, AI_MATH],
  [ACTIVE_SCHOLARS_AI_MATH.id, ACTIVE_SCHOLARS_AI_MATH],
  [SOCIAL_CONNECTIONS.id, SOCIAL_CONNECTIONS],
  [AI_PROGRAMMER_JOBS.id, AI_PROGRAMMER_JOBS],
  [CITY_OR_HOMETOWN.id, CITY_OR_HOMETOWN],
]);

export function getNebulaPreset(id) {
  return PRESETS.get(id) || CAREER_35;
}

export function getNebulaLikeStorageKey(preset) {
  return `jiupai:nebula:likes:v2:${preset.id}:${preset.version || "1"}`;
}

export function buildNebulaShelfUrl(locationLike, baseUrl, path) {
  return locationLike.protocol === "file:"
    ? new URL(`/shelf/${path}`, "https://soular.top").href
    : new URL(`../shelf/${path}`, baseUrl).href;
}

export function listNebulaPresets() {
  return [...PRESETS.values()].map(({ id, version, serial, kind, personaTheme, question, axis, people }) => ({
    id,
    version,
    serial,
    kind,
    personaTheme,
    question,
    axis,
    answerCount: Array.isArray(people) ? people.length : 0,
    teaser: Array.isArray(people) && typeof people[0]?.[3] === "string" ? people[0][3] : "",
  }));
}
