import type { ZhihuClient } from "../zhihu/client.js";
import type { HotListItem } from "../types.js";

export const GALAXY_TTL_SECONDS = 24 * 60 * 60;
export const GALAXY_FALLBACK_TTL_SECONDS = 60 * 60;
export const GALAXY_POST_LIMIT = 30;
const TAKE_MAX_LENGTH = 42;
const CAMP_MAX_LENGTH = 28;

export interface GalaxyCluster {
  id: number;
  name: string;
}

export interface GalaxyPost {
  id: number;
  title: string;
  summary: string;
  url: string;
  thumbnail: string;
  heat: number;
  cluster: number;
  debate: number;
  take: string;
  campA: string;
  campB: string;
}

export interface Galaxy {
  generatedAt: number;
  source: "ai" | "fallback";
  model: string | null;
  clusters: GalaxyCluster[];
  posts: GalaxyPost[];
  warnings: string[];
}

interface AiPostAnnotation {
  i: number;
  c: number;
  d: number;
  t: string;
  a: string;
  b: string;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function extractJsonObject(raw: string): unknown {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("模型响应中未找到 JSON 对象");
  }
  return JSON.parse(text.slice(start, end + 1));
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : NaN;
}

function buildPrompt(items: HotListItem[]): { system: string; user: string } {
  const system = [
    "你是知乎热榜的观点分析引擎。",
    "只输出一个 JSON 对象，禁止输出 markdown、代码块标记或任何解释文字。",
    "分析必须基于标题与摘要事实，不得编造人物、数据或事件结果。",
  ].join("");

  const lines = items.map((item, index) => {
    const summary = clip(item.Summary ?? "", 60);
    return `${index}. ${clip(item.Title ?? "", 50)}｜${summary}`;
  });

  const user = [
    "下面是今日知乎热榜条目（编号即 i）：",
    lines.join("\n"),
    "",
    "请输出 JSON，结构如下：",
    '{"clusters":[{"id":0,"name":"2到4字主题名"}],"posts":[{"i":0,"c":0,"d":0.5,"t":"不超过42字的中立锐评","a":"不超过28字的一方主张","b":"不超过28字的另一方主张"}]}',
    "",
    "规则：",
    `1. clusters 为 5-7 个互斥主题星团，覆盖全部帖子；name 用 2-4 个汉字，id 从 0 连续编号。`,
    "2. c 为该帖所属星团 id。",
    "3. d 为争议度，0=高度共识/冷静讨论，1=激烈撕裂/阵营对立，保留两位小数。",
    "4. a、b 是该议题下两种最具代表性的对立主张或视角，尽量具体、对立鲜明；",
    "   共识型议题也要给出两种真实存在的不同侧重，不要留空。",
    "5. t 是一句第三人称、犀利但中立的观点锐评。",
    "6. posts 必须覆盖全部 30 条，顺序不限，每条只出现一次。",
  ].join("\n");

  return { system, user };
}

function normalizeClusters(raw: unknown): GalaxyCluster[] {
  const record = (raw ?? {}) as Record<string, unknown>;
  const rawClusters = Array.isArray(record.clusters) ? record.clusters : [];
  const clusters: GalaxyCluster[] = [];
  rawClusters.forEach((entry, index) => {
    const row = (entry ?? {}) as Record<string, unknown>;
    const name = clip(asString(row.name) || `星团${index + 1}`, 6);
    clusters.push({ id: index, name });
  });
  if (!clusters.length) clusters.push({ id: 0, name: "今日热议" });
  return clusters.slice(0, 8);
}

function normalizeAnnotations(raw: unknown, count: number): Map<number, AiPostAnnotation> {
  const record = (raw ?? {}) as Record<string, unknown>;
  const rawPosts = Array.isArray(record.posts) ? record.posts : [];
  const annotations = new Map<number, AiPostAnnotation>();
  for (const entry of rawPosts) {
    const row = (entry ?? {}) as Record<string, unknown>;
    const i = asNumber(row.i);
    if (!Number.isInteger(i) || i < 0 || i >= count || annotations.has(i)) continue;
    annotations.set(i, {
      i,
      c: Number.isInteger(asNumber(row.c)) ? asNumber(row.c) : 0,
      d: clamp01(asNumber(row.d)),
      t: clip(asString(row.t), TAKE_MAX_LENGTH),
      a: clip(asString(row.a), CAMP_MAX_LENGTH),
      b: clip(asString(row.b), CAMP_MAX_LENGTH),
    });
  }
  return annotations;
}

const FALLBACK_BUCKETS: { name: string; words: string[] }[] = [
  {
    name: "AI科技",
    words: ["AI", "ai", "人工智能", "大模型", "deepseek", "芯片", "算法", "机器人", "科技", "互联网", "手机", "苹果", "iphone", "华为", "新能源", "电池", "自动驾驶", "程序员"],
  },
  {
    name: "教育",
    words: ["学生", "学校", "老师", "教师", "高考", "考研", "大学", "专业", "英语", "论文", "研究生", "博士", "硕士", "家长", "陪读", "食堂", "同学", "毕业", "本科"],
  },
  { name: "职场", words: ["职场", "领导", "同事", "辞职", "离职", "面试", "工资", "加班", "财务", "打工人", "offer", "副业", "失业"] },
  {
    name: "财经",
    words: ["涨价", "降价", "税", "贸易", "关税", "经济", "股市", "房价", "贷款", "商业", "公司", "企业", "市场", "理财", "通胀", "车企", "赛事", "成本"],
  },
  {
    name: "健康",
    words: ["医生", "医院", "癌症", "癌", "药", "疫苗", "睡眠", "抑郁", "心理", "减肥", "运动", "疾病", "传染", "避孕", "血栓", "洗衣机", "卫生"],
  },
  {
    name: "文娱",
    words: ["电影", "电视剧", "综艺", "明星", "导演", "演员", "还珠", "奥运", "冠军", "比赛", "小说", "动漫", "游戏", "音乐", "恋爱", "亲密关系", "男友", "女友", "结婚", "离婚", "择偶", "杨康"],
  },
  { name: "社会", words: ["社会", "法律", "法院", "警方", "警察", "孩子", "父母", "亲戚", "网贷", "饭店", "酒店", "汽车", "面", "失明", "投票"] },
];

function ruleBasedClustering(items: HotListItem[]): {
  clusters: GalaxyCluster[];
  assignments: number[];
} {
  const assignments = items.map((item) => {
    const text = `${item.Title ?? ""} ${item.Summary ?? ""}`.toLowerCase();
    for (let i = 0; i < FALLBACK_BUCKETS.length; i += 1) {
      if (FALLBACK_BUCKETS[i].words.some((word) => text.includes(word.toLowerCase()))) return i;
    }
    return FALLBACK_BUCKETS.length - 1;
  });

  const used = new Set(assignments);
  const mapping = new Map<number, number>();
  const clusters: GalaxyCluster[] = [];
  FALLBACK_BUCKETS.forEach((bucket, index) => {
    if (used.has(index)) {
      mapping.set(index, clusters.length);
      clusters.push({ id: clusters.length, name: bucket.name });
    }
  });
  return { clusters, assignments: assignments.map((a) => mapping.get(a) ?? 0) };
}

export async function buildGalaxyFromItems(
  client: ZhihuClient,
  sourceItems: HotListItem[],
): Promise<Galaxy> {
  const generatedAt = Date.now();
  const warnings: string[] = [];

  const items = sourceItems.slice(0, GALAXY_POST_LIMIT);
  if (!items.length) throw new Error("热榜数据为空");

  const ruleBased = ruleBasedClustering(items);
  let clusters = ruleBased.clusters;
  let annotations = new Map<number, AiPostAnnotation>();
  let source: Galaxy["source"] = "fallback";
  let model: string | null = null;

  try {
    const prompt = buildPrompt(items);
    const content = await client.zhiDaText(
      [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      "zhida-fast-1p5",
    );
    const parsed = extractJsonObject(content);
    clusters = normalizeClusters(parsed);
    annotations = normalizeAnnotations(parsed, items.length);
    if (annotations.size < items.length * 0.6) {
      throw new Error(`AI 仅覆盖 ${annotations.size}/${items.length} 条，结果不可信`);
    }
    source = "ai";
    model = "zhida-fast-1p5";
    if (annotations.size < items.length) {
      warnings.push(`AI 分析覆盖 ${annotations.size}/${items.length} 条，缺失条目已降级补全`);
    }
  } catch (error) {
    warnings.push(`AI 星图分析失败，已使用本地降级：${(error as Error).message}`);
    clusters = ruleBased.clusters;
    annotations = new Map();
  }

  const posts: GalaxyPost[] = items.map((item, index) => {
    const ai = annotations.get(index);
    const cluster = source === "ai"
      ? Math.min(ai?.c ?? 0, clusters.length - 1)
      : ruleBased.assignments[index];
    const summary = clip(item.Summary ?? "", 120);
    return {
      id: index + 1,
      title: clip(item.Title ?? "", 80),
      summary,
      url: item.Url ?? "",
      thumbnail: item.ThumbnailUrl ?? "",
      heat: 1 - index / items.length,
      cluster: Math.max(0, cluster),
      debate: ai?.d ?? 0.15 + (index % 5) * 0.07,
      take: ai?.t || summary || item.Title || "",
      campA: ai?.a ?? "",
      campB: ai?.b ?? "",
    };
  });

  return { generatedAt, source, model, clusters, posts, warnings };
}

export async function buildGalaxy(client: ZhihuClient): Promise<Galaxy> {
  const hot = await client.hotList(GALAXY_POST_LIMIT);
  const items = (hot.Items ?? []).slice(0, GALAXY_POST_LIMIT);
  return buildGalaxyFromItems(client, items);
}
