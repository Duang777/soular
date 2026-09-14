import type { Cast } from "./cast";
import type { NebulaPortraitSignal } from "./zhihuPortrait";

export type Person = {
  name: string;
  stance: number;
  cast: Cast["key"];
  claim: string;
  avatar?: string;
  sourceUrl?: string;
  votes?: number;
};

export type SelfProfile = {
  preset: string;
  version: string;
  cast: Cast["key"];
  stance: number;
  likedCount: number;
  likedIndexes?: number[];
  claim: string;
  accountVersion?: string;
  interest?: NebulaPortraitSignal;
};

export const DEFAULT_NEBULA_PRESET = "career-35";
export const NEBULA_PRESET_VERSIONS: Readonly<Record<string, string>> = {
  "career-35": "1",
  "ai-math": "20260912",
  "scholars-ai-math": "20260914",
};
export const NEBULA_PRESET_ANSWER_COUNTS: Readonly<Record<string, number>> = {
  "career-35": 48,
  "ai-math": 31,
  "scholars-ai-math": 47,
};
const MAX_TRANSIENT_SELF_PROFILES = 24;
const transientSelfProfiles = new Map<string, unknown>();

export function stageTransientSelfProfile(key: string, value: unknown): void {
  if (!/^[a-z0-9-]{1,64}$/.test(key)) return;
  transientSelfProfiles.delete(key);
  transientSelfProfiles.set(key, value);
  while (transientSelfProfiles.size > MAX_TRANSIENT_SELF_PROFILES) {
    const oldestKey = transientSelfProfiles.keys().next().value;
    if (typeof oldestKey !== "string") break;
    transientSelfProfiles.delete(oldestKey);
  }
}

export function clearSelfProfileContexts(): void {
  transientSelfProfiles.clear();
  if (typeof window === "undefined") return;
  try {
    const storedKeys: string[] = [];
    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith("jiupai:nebula:self:")) storedKeys.push(key);
    }
    storedKeys.forEach((key) => window.sessionStorage.removeItem(key));
  } catch {
    // Storage may be disabled; the in-memory contexts are already cleared.
  }
}

export function nebulaPresetVersion(preset: string): string | null {
  return Object.hasOwn(NEBULA_PRESET_VERSIONS, preset)
    ? NEBULA_PRESET_VERSIONS[preset]
    : null;
}

export function resolveNebulaPreset(preset: string): string {
  return nebulaPresetVersion(preset) ? preset : DEFAULT_NEBULA_PRESET;
}

export function clipProfileClaim(claim: string): string {
  const graphemes = typeof Intl.Segmenter === "function"
    ? Array.from(
        new Intl.Segmenter("zh-CN", { granularity: "grapheme" }).segment(claim),
        ({ segment }) => segment,
      )
    : Array.from(claim);
  return graphemes.slice(0, 120).join("");
}

export function countMatchingNebulaLikes(
  value: unknown,
  expectedIndexes: readonly number[] | undefined,
  preset: string,
): number {
  if (!Array.isArray(value) || !expectedIndexes) return 0;
  const answerCount = NEBULA_PRESET_ANSWER_COUNTS[preset] ?? 0;
  const expected = new Set(expectedIndexes);
  return new Set(
    value.filter((index) =>
      Number.isSafeInteger(index) &&
      index >= 0 &&
      index < answerCount &&
      expected.has(index)
    ),
  ).size;
}

export const PEOPLE: Person[] = [
  { name: "等喝茶的老码农", stance: -0.98, cast: "goat", claim: "35 岁还不走，等着公司请你喝茶吗？管理岗就那么几个。" },
  { name: "拼不过00后的P7", stance: -0.93, cast: "bear", claim: "体力加班都拼不过年轻人，早转管理或业务才是正解。" },
  { name: "送外卖的Tim", stance: -0.9, cast: "frog", claim: "我已经转了，送外卖都比在工位等优化强。" },
  { name: "不信青春饭但焦虑", stance: -0.86, cast: "owl", claim: "理智上不承认是青春饭，身体却很诚实地焦虑。" },
  { name: "前大厂边缘人", stance: -0.82, cast: "redpanda", claim: "别眷恋大厂光环，35 岁前不找出路，之后更被动。" },
  { name: "十年接口工程师", stance: -0.74, cast: "fox", claim: "干了十年还是写接口，天花板肉眼可见，认真考虑转。" },
  { name: "降薪去国企的磊", stance: -0.7, cast: "penguin", claim: "降薪去国企我接受，至少不用凌晨两点 oncall。" },
  { name: "考公上岸的强子", stance: -0.66, cast: "penguin", claim: "已上岸考公，钱少点但命是自己的。" },
  { name: "离钱更近的阿May", stance: -0.62, cast: "redpanda", claim: "趁还能拼，转去做离钱近的岗位更稳。" },
  { name: "沪漂老兵", stance: -0.58, cast: "owl", claim: "身边 35+ 还在一线写代码的，真没几个安稳的。" },
  { name: "转产品的小周", stance: -0.55, cast: "rabbit", claim: "我转产品了，懂技术反而是一种优势。" },
  { name: "CRUD退役选手", stance: -0.52, cast: "bear", claim: "纯执行的开发最先被替代，得往上走或往外走。" },
  { name: "背房贷的彬", stance: -0.48, cast: "fox", claim: "房贷压力大，更不敢赌公司留不留我，先动。" },
  { name: "创业失败回炉的坤", stance: -0.44, cast: "frog", claim: "创业失败回炉，但我不后悔出来看过一眼。" },
  { name: "卖咖啡的Leo", stance: -0.4, cast: "owl", claim: "转行卖咖啡半年，睡得着觉了，这就够了。" },
  { name: "看岗位说话的陈", stance: -0.36, cast: "bear", claim: "要不要转看岗位，纯搬砖的岗位确实危险。" },
  { name: "硬核派观察员", stance: -0.33, cast: "fox", claim: "有硬技术的不用慌，CRUD 选手该早做打算。" },
  { name: "骑驴找马的辉", stance: -0.3, cast: "redpanda", claim: "我在骑驴找马，先攒管理经验再说。" },
  { name: "业余独立开发者", stance: -0.27, cast: "frog", claim: "转一半留一半，业余做独立产品先探探路。" },
  { name: "35岁分水岭", stance: -0.24, cast: "cat", claim: "35 岁是分水岭，但也不是非黑即白。" },
  { name: "看性价比的楠", stance: -0.2, cast: "goat", claim: "公司裁员不看能力看性价比，得给自己留后手。" },
  { name: "想转没方向的林", stance: -0.16, cast: "rabbit", claim: "倾向转，但没想好去哪，先观察一阵。" },
  { name: "没矿求稳的娟", stance: -0.13, cast: "penguin", claim: "家里没矿，求稳的话体制内确实香。" },
  { name: "学业务的老徐", stance: -0.1, cast: "fox", claim: "与其被动转，不如主动学点业务和商业。" },
  { name: "不可替代性信徒", stance: -0.06, cast: "cat", claim: "转不转都行，关键看你有没有不可替代性。" },
  { name: "中立吃瓜架构师", stance: -0.03, cast: "bear", claim: "我中立，见过转好的，也见过转砸的。" },
  { name: "技术深耕派", stance: 0.0, cast: "goat", claim: "先把技术做深，年龄歧视是行业问题，不是我的问题。" },
  { name: "换赛道怀疑论者", stance: 0.03, cast: "owl", claim: "哪里都有 35 岁焦虑，换个赛道未必就没有。" },
  { name: "算账型选手", stance: 0.06, cast: "penguin", claim: "看存款和家庭，抗风险能力强的可以慢慢选。" },
  { name: "随时能走的芸", stance: 0.09, cast: "redpanda", claim: "与其纠结年龄，不如保持随时能走的能力。" },
  { name: "反焦虑的晴", stance: 0.12, cast: "goat", claim: "转行成本很高，别被贩卖焦虑的文章带了节奏。" },
  { name: "主副业两手抓", stance: 0.15, cast: "cat", claim: "我把鸡蛋放几个篮子，主业副业都做着。" },
  { name: "判断力值钱", stance: 0.22, cast: "fox", claim: "资深工程师值钱的是判断不是手速，越老越香。" },
  { name: "十年经验不清零", stance: 0.26, cast: "owl", claim: "我选择深耕，攒了十年的经验凭什么清零。" },
  { name: "先让自己厉害", stance: 0.3, cast: "bear", claim: "真正厉害的人不会被年龄卡住，先让自己变厉害。" },
  { name: "优势不归零派", stance: 0.34, cast: "frog", claim: "转行等于把优势归零，除非真的讨厌这行。" },
  { name: "能扛事的老兵", stance: 0.4, cast: "redpanda", claim: "公司更愿意为能扛事的老兵付溢价。" },
  { name: "只看活人的峰", stance: 0.45, cast: "cat", claim: "别只看裁员新闻，35+ 技术专家活得好的一大把。" },
  { name: "转管理不转技术", stance: 0.5, cast: "rabbit", claim: "我在转技术管理，但这不算是离开技术。" },
  { name: "黄金期刚开始", stance: 0.58, cast: "fox", claim: "黄金期才刚开始，年轻人才有体力没沉淀。" },
  { name: "踩坑护城河", stance: 0.64, cast: "bear", claim: "复杂系统就得靠踩过坑的人，时间是护城河。" },
  { name: "换姿势不转行", stance: 0.7, cast: "goat", claim: "绝不转行，换个方式继续写代码而已。" },
  { name: "学到老的勇", stance: 0.76, cast: "owl", claim: "年龄大的问题不是老，是停止学习，我没停。" },
  { name: "架构正当年", stance: 0.82, cast: "fox", claim: "带团队做架构正当年，转行才是真浪费。" },
  { name: "40岁还在一线", stance: 0.88, cast: "cat", claim: "我 40 了还在一线，offer 没断过，焦虑是自己吓自己。" },
  { name: "核心圈层反驳者", stance: 0.93, cast: "goat", claim: "说程序员 35 就废的，多半自己没做到核心。" },
  { name: "黄金期论者", stance: 0.96, cast: "fox", claim: "技术人的黄金期在 35 岁后，人脉经验判断力全开。" },
  { name: "深耕不认输", stance: 1.0, cast: "bear", claim: "坚决不转，深耕的人从不靠青春吃饭。" },
];

export function avatarFile(index: number) {
  return `nebula-scene/avatars/u${String(index + 1).padStart(2, "0")}.jpg`;
}

export function personAvatarFile(person: Person | null, index: number) {
  return person?.avatar ?? avatarFile(index);
}

export function personByIndex(index: number): Person | null {
  return Number.isInteger(index) && index >= 0 && index < PEOPLE.length ? PEOPLE[index] : null;
}

export function personFromValue(
  value: unknown,
  preset: string,
  version: string,
  index: number,
): Person | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    record.preset !== preset ||
    record.version !== version ||
    record.index !== index ||
    typeof record.name !== "string" ||
    typeof record.stance !== "number" ||
    !Number.isFinite(record.stance) ||
    typeof record.cast !== "string" ||
    typeof record.claim !== "string"
  ) {
    return null;
  }
  return {
    name: record.name,
    stance: Math.max(-1, Math.min(1, record.stance)),
    cast: record.cast as Person["cast"],
    claim: record.claim,
    avatar: typeof record.avatar === "string" ? record.avatar : undefined,
    sourceUrl: typeof record.sourceUrl === "string" ? record.sourceUrl : undefined,
    votes: typeof record.votes === "number" && Number.isFinite(record.votes)
      ? record.votes
      : undefined,
  };
}

export function stagedPersonByIndex(
  preset: string,
  version: string,
  index: number,
  personKey: string,
): Person | null {
  if (typeof window === "undefined" || !personKey) return null;
  try {
    const raw = window.sessionStorage.getItem(`jiupai:nebula:subject:${personKey}`);
    return personFromValue(raw ? JSON.parse(raw) : null, preset, version, index);
  } catch {
    return null;
  }
}

export function selfProfileFromValue(
  value: unknown,
  preset: string,
  version: string,
  cast: string,
): SelfProfile | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    record.preset !== preset ||
    record.version !== version ||
    record.cast !== cast ||
    typeof record.stance !== "number" ||
    !Number.isFinite(record.stance) ||
    typeof record.likedCount !== "number" ||
    !Number.isSafeInteger(record.likedCount) ||
    record.likedCount < 0 ||
    typeof record.claim !== "string"
  ) {
    return null;
  }
  let interest: NebulaPortraitSignal | undefined;
  if (record.interest && typeof record.interest === "object" && !Array.isArray(record.interest)) {
    const rawInterest = record.interest as Record<string, unknown>;
    const keywords = Array.isArray(rawInterest.keywords)
      ? rawInterest.keywords
          .filter((item): item is Record<string, unknown> =>
            Boolean(item) && typeof item === "object" && !Array.isArray(item)
          )
          .map((item) => ({
            word: typeof item.word === "string" ? item.word.trim() : "",
            score: typeof item.score === "number" && Number.isFinite(item.score)
              ? Math.max(0, item.score)
              : 0,
          }))
          .filter(({ word }) => word.length > 0 && word.length <= 24)
          .slice(0, 6)
      : [];
    if (
      keywords.length > 0 &&
      typeof rawInterest.evidenceCount === "number" &&
      Number.isSafeInteger(rawInterest.evidenceCount) &&
      rawInterest.evidenceCount >= 0
    ) {
      interest = {
        keywords,
        evidenceCount: rawInterest.evidenceCount,
        partial: rawInterest.partial === true,
      };
    }
  }
  const likedIndexes = Array.isArray(record.likedIndexes)
    ? [...new Set(record.likedIndexes.filter((index) =>
        Number.isSafeInteger(index) &&
        index >= 0 &&
        index < (NEBULA_PRESET_ANSWER_COUNTS[preset] ?? 0)
      ))]
    : undefined;
  if (likedIndexes && likedIndexes.length !== record.likedCount) return null;
  return {
    preset,
    version,
    cast,
    stance: Math.max(-1, Math.min(1, record.stance)),
    likedCount: record.likedCount,
    likedIndexes,
    claim: clipProfileClaim(record.claim),
    accountVersion:
      typeof record.accountVersion === "string" &&
      /^[a-f0-9]{16}$/.test(record.accountVersion)
        ? record.accountVersion
        : undefined,
    interest,
  };
}

export function stagedSelfProfile(
  preset: string,
  version: string,
  cast: string,
  profileKey: string,
): SelfProfile | null {
  if (typeof window === "undefined" || !profileKey) return null;
  try {
    const raw = window.sessionStorage.getItem(`jiupai:nebula:self:${profileKey}`);
    return selfProfileFromValue(raw ? JSON.parse(raw) : null, preset, version, cast);
  } catch {
    return null;
  }
}

export function transientSelfProfile(
  preset: string,
  version: string,
  cast: string,
  profileKey: string,
): SelfProfile | null {
  if (!profileKey) return null;
  return selfProfileFromValue(
    transientSelfProfiles.get(profileKey),
    preset,
    version,
    cast,
  );
}
