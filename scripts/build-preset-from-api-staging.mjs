import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const ROOT = resolve(import.meta.dirname, "..");
const CAST_KEYS = ["fox", "bear", "cat", "owl", "rabbit", "penguin", "redpanda", "goat", "frog"];

const NEGATIVE = [
  "质疑", "警惕", "幻觉", "伪证", "不行", "担忧", "不安", "垃圾", "误用", "翻车", "漏洞",
  "瞎编", "一问三不知", "不看好", "陷阱", "悖论", "不安", "错误", "失败", "不可信", "滥用",
  "应付", "审阅", "把关", "风险", "黑暗", "劣币", "可读性", "非友好",
];
const POSITIVE = [
  "支持", "拥抱", "赞成", "井喷", "降低门槛", "解放", "工具", "必然趋势", "MVP", "形式化",
  "应该用", "正确", "厉害", "加速", "突破", "期刊", "Lean", "形式化证明", "大有裨益", "没问题",
  "赞成了", "正在用", "做科研", "机械化", "解放出来",
];

function clip(text, max = 72) {
  const normalized = String(text).replace(/\s+/g, " ").trim();
  const chars = Array.from(normalized);
  return chars.length > max ? `${chars.slice(0, max - 1).join("")}…` : normalized;
}

function claimFromSummary(summary) {
  const text = String(summary).replace(/\s+/g, " ").trim();
  const sentence = text.split(/[。！？!?]/).find((part) => part.trim().length >= 12) ?? text;
  return clip(sentence, 72);
}

function scoreStance(summary) {
  const text = String(summary).toLowerCase();
  let score = 0;
  for (const word of NEGATIVE) if (text.includes(word.toLowerCase())) score -= 1;
  for (const word of POSITIVE) if (text.includes(word.toLowerCase())) score += 1;
  if (score === 0) return 0;
  return Math.max(-0.92, Math.min(0.92, score * 0.22));
}

function castForSummary(summary, index) {
  const length = String(summary).length;
  if (length > 900) return "goat";
  if (length < 120) return "frog";
  if (/测试|试了|问了/.test(summary)) return "rabbit";
  if (/期刊|论文|形式化|Lean|证明/.test(summary)) return "owl";
  if (/群|微信|分享/.test(summary)) return "cat";
  return CAST_KEYS[index % CAST_KEYS.length];
}

function fetchAnswerMeta(answerUrl) {
  const output = execFileSync(
    "moli",
    ["fetch", "--dump", "json", "--wait-until", "domstable", answerUrl],
    { encoding: "utf8", maxBuffer: 12 * 1024 * 1024 },
  );
  const html = JSON.parse(output).html;
  const match = html.match(/<script id="js-initialData" type="text\/json">([^<]+)/);
  if (!match) throw new Error(`missing initialData for ${answerUrl}`);
  const data = JSON.parse(match[1]);
  const answerId = answerUrl.split("/answer/")[1]?.split("?")[0];
  const answer = data.initialState?.entities?.answers?.[answerId];
  if (!answer) throw new Error(`missing answer entity ${answerId}`);
  return {
    name: answer.author?.name?.trim() || "知乎用户",
    votes: typeof answer.voteupCount === "number" ? answer.voteupCount : null,
    avatarUrl: answer.author?.avatarUrl?.split("?")[0] ?? "",
    excerpt: String(answer.content ?? "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  };
}

function downloadAvatar(url, dest) {
  const normalized = url.includes("?") ? url : `${url}?source=1def8aca`;
  execFileSync(
    "curl",
    [
      "-fsSL",
      "-H",
      "Referer: https://www.zhihu.com/",
      "-H",
      "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "-o",
      dest,
      normalized,
    ],
    { stdio: "pipe" },
  );
}

function buildPreset({
  exportName,
  presetId,
  serial,
  version,
  question,
  sourceQuestion,
  axis,
  peopleLabel,
  meClaim,
  answers,
}) {
  const sortedPeople = answers.slice().sort((left, right) => left.stance - right.stance);
  const avatarDir = resolve(ROOT, `public/nebula-scene/avatars/${presetId}`);
  mkdirSync(avatarDir, { recursive: true });

  sortedPeople.forEach((person, index) => {
    if (!person.avatarUrl) return;
    const dest = resolve(avatarDir, `u${String(index + 1).padStart(2, "0")}.jpg`);
    downloadAvatar(person.avatarUrl, dest);
  });

  const people = sortedPeople.map((person) => [
    person.name,
    person.stance,
    person.cast,
    person.claim,
    person.url,
    question,
    person.votes,
  ]);

  const body = `export const ${exportName} = {
  id: "${presetId}",
  version: "${version}",
  serial: "${serial}",
  kind: "real",
  question: ${JSON.stringify(question)},
  peopleLabel: ${JSON.stringify(peopleLabel)},
  sourceQuestion: ${JSON.stringify(sourceQuestion)},
  searchUrl: ${JSON.stringify(sourceQuestion)},
  avatarBase: "avatars/${presetId}",
  axis: ${JSON.stringify(axis, null, 2).replaceAll("\n", "\n  ")},
  people: ${JSON.stringify(people, null, 4).replace(/^/gm, "    ").trimStart()},
  followed: [],
  comments: [],
  circles: [],
  me: {
    name: "我",
    castKey: "fox",
    claim: ${JSON.stringify(meClaim)},
  },
};
`;

  const outPath = resolve(ROOT, `public/nebula-scene/preset-${presetId}.js`);
  writeFileSync(outPath, body);
  return { outPath, count: people.length };
}

async function enrichFromStaging(stagingPath, overrides = new Map()) {
  const staging = JSON.parse(readFileSync(stagingPath, "utf8"));
  const rows = staging.spectrum?.answers ?? staging.answers ?? [];
  const enriched = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const url = row.url;
    const summary = row.summary ?? row.excerpt ?? "";
    const override = overrides.get(row.contentToken) ?? overrides.get(url);
    process.stderr.write(`enrich ${index + 1}/${rows.length} ${url}\n`);
    let meta = { name: "知乎用户", votes: null, avatarUrl: "", excerpt: summary };
    try {
      meta = fetchAnswerMeta(url);
      await sleep(250);
    } catch (error) {
      process.stderr.write(`  warn: ${error instanceof Error ? error.message : String(error)}\n`);
    }
    enriched.push({
      name: override?.name ?? meta.name,
      stance: override?.stance ?? scoreStance(summary || meta.excerpt),
      cast: override?.cast ?? castForSummary(summary || meta.excerpt, index),
      claim: override?.claim ?? claimFromSummary(summary || meta.excerpt),
      url,
      votes: override?.votes ?? meta.votes,
      avatarUrl: override?.avatarUrl ?? meta.avatarUrl,
    });
  }
  return enriched;
}

const VERSION = "20260914";

const gOverrides = new Map([
  ["2053887986522240063", { name: "知乎用户", stance: -0.68, cast: "owl", claim: "学生用 AI 应付科研时，必须能在办公室讲清证明细节。" }],
  ["2049479783059304591", { name: "猫娘神", stance: 0.38, cast: "rabbit", claim: "AI 极大降低了数学科研 MVP 的门槛，我正在用它做研究。" }],
  ["2053828184047723529", { name: "网管", stance: 0.84, cast: "penguin", claim: "AI 做出的数学已进入井喷期，人类可负责改写并完成形式化验证。" }],
]);

const gPeople = await enrichFromStaging(
  resolve(ROOT, "server/.staging/scholars-ai-math-20260913.json"),
  gOverrides,
);
const gResult = buildPreset({
  exportName: "SCHOLARS_AI_MATH",
  presetId: "scholars-ai-math",
  serial: "05",
  version: VERSION,
  question: "如何看待现在有学者用 AI 做数学科研？",
  sourceQuestion: "https://www.zhihu.com/question/2049420510811967937",
  peopleLabel: "真实回答观点",
  meClaim: "点赞真实回答，看看你更警惕 AI 科研，还是更愿意拥抱工具。",
  axis: {
    left: "质疑 AI 科研",
    center: "审慎试用",
    right: "积极拥抱",
    leftChoice: "警惕滥用",
    rightChoice: "拥抱工具",
    leftTendency: "倾向人工把关",
    rightTendency: "倾向工具先行",
  },
  answers: gPeople,
});
console.log(`G: ${gResult.count} people -> ${gResult.outPath}`);

const hOverrides = new Map([
  ["1894506210528572231", { name: "酱紫君", stance: -0.9, cast: "goat", claim: "常见误用是直接问 AI 然后甩出一堆伪证，专业问题一问三不知。" }],
  ["1892225934372872275", { name: "Yuhang Liu", stance: -0.12, cast: "bear", claim: "测试表明模型知识量仍有限，复杂群论问题容易答非所问。" }],
  ["39614187807", { name: "杂然赋流形丶", stance: 0.58, cast: "fox", claim: "AI 擅长机械化计算与推导，能把人力从繁琐步骤里解放出来。" }],
]);

const hStagingPath = resolve(ROOT, "server/.staging/tao-ai-math-proof-20260914.json");
let hPeople = null;
if (existsSync(hStagingPath)) {
  try {
    hPeople = await enrichFromStaging(hStagingPath, hOverrides);
  } catch {
    hPeople = null;
  }
}

if (!hPeople?.length) {
  hPeople = [
    {
      name: "酱紫君",
      stance: -0.9,
      cast: "goat",
      claim: "常见误用是直接问 AI 然后甩出一堆伪证，专业问题一问三不知。",
      url: "https://www.zhihu.com/question/4991950322/answer/1894506210528572231",
      votes: 1930,
      avatarUrl: "",
    },
    {
      name: "Yuhang Liu",
      stance: -0.12,
      cast: "bear",
      claim: "测试表明模型知识量仍有限，复杂群论问题容易答非所问。",
      url: "https://www.zhihu.com/question/4991950322/answer/1892225934372872275",
      votes: 664,
      avatarUrl: "",
    },
    {
      name: "杂然赋流形丶",
      stance: 0.58,
      cast: "fox",
      claim: "AI 擅长机械化计算与推导，能把人力从繁琐步骤里解放出来。",
      url: "https://www.zhihu.com/question/4991950322/answer/39614187807",
      votes: 542,
      avatarUrl: "",
    },
  ];
  for (const person of hPeople) {
    try {
      const meta = await fetchAnswerMeta(person.url);
      person.avatarUrl = meta.avatarUrl;
      person.votes = person.votes ?? meta.votes;
      await sleep(250);
    } catch {
      // keep curated fallback
    }
  }
}

const hResult = buildPreset({
  exportName: "TAO_AI_MATH_PROOF",
  presetId: "tao-ai-math-proof",
  serial: "06",
  version: VERSION,
  question: "如何看待陶哲轩等数学家大力推动的 AI 数学证明?",
  sourceQuestion: "https://www.zhihu.com/question/4991950322",
  peopleLabel: "真实回答观点",
  meClaim: "点赞真实回答，看看你更担心伪证风险，还是更看好证明自动化。",
  axis: {
    left: "质疑 AI 证明",
    center: "分工协作",
    right: "支持推动",
    leftChoice: "警惕伪证",
    rightChoice: "支持推进",
    leftTendency: "倾向人工审查",
    rightTendency: "倾向机器分担",
  },
  answers: hPeople,
});
console.log(`H: ${hResult.count} people -> ${hResult.outPath}`);
