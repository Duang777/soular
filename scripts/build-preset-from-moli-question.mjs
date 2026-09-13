import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const CAST_KEYS = ["fox", "bear", "cat", "owl", "rabbit", "penguin", "redpanda", "goat", "frog"];

function clip(text, max = 72) {
  const chars = Array.from(String(text).replace(/\s+/g, " ").trim());
  return chars.length > max ? `${chars.slice(0, max - 1).join("")}…` : chars.join("");
}

function fetchInitialAnswers(questionId, extraAnswerIds = []) {
  const sourceQuestion = `https://www.zhihu.com/question/${questionId}`;
  const answers = new Map();

  function ingest(url) {
    const output = execFileSync(
      "moli",
      ["fetch", "--dump", "json", "--wait-until", "domstable", url],
      { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    );
    const html = JSON.parse(output).html;
    const match = html.match(/<script id="js-initialData" type="text\/json">([^<]+)/);
    if (!match) return;
    const data = JSON.parse(match[1]);
    const entities = data.initialState?.entities?.answers ?? {};
    for (const [answerId, answer] of Object.entries(entities)) {
      answers.set(answerId, {
        answerId,
        name: answer.author?.name ?? "知乎用户",
        votes: typeof answer.voteupCount === "number" ? answer.voteupCount : null,
        avatarUrl: answer.author?.avatarUrl?.split("?")[0] ?? "",
        excerpt: clip(
          String(answer.content ?? "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim(),
        ),
      });
    }
  }

  ingest(sourceQuestion);
  for (const answerId of extraAnswerIds) {
    ingest(`${sourceQuestion}/answer/${answerId}`);
  }

  return { sourceQuestion, answers: [...answers.values()] };
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
  people,
  meClaim,
}) {
  const sortedPeople = people.slice().sort((left, right) => left.stance - right.stance);
  const avatarDir = resolve(import.meta.dirname, `../public/nebula-scene/avatars/${presetId}`);
  mkdirSync(avatarDir, { recursive: true });

  const tuples = sortedPeople.map((person) => [
    person.name,
    person.stance,
    person.cast,
    person.claim,
    `${sourceQuestion}/answer/${person.answerId}`,
    question,
    person.votes,
  ]);

  sortedPeople.forEach((person, index) => {
    const dest = resolve(avatarDir, `u${String(index + 1).padStart(2, "0")}.jpg`);
    downloadAvatar(person.avatarUrl, dest);
  });

  const body = `export const ${exportName} = {
  id: "${presetId}",
  version: "${version}",
  serial: "${serial}",
  kind: "real",
  question: ${JSON.stringify(question)},
  peopleLabel: "真实回答观点",
  sourceQuestion: ${JSON.stringify(sourceQuestion)},
  searchUrl: ${JSON.stringify(sourceQuestion)},
  avatarBase: "avatars/${presetId}",
  axis: ${JSON.stringify(axis, null, 2).replaceAll("\n", "\n  ")},
  people: ${JSON.stringify(tuples, null, 4).replace(/^/gm, "    ").trimStart()},
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

  const outPath = resolve(import.meta.dirname, `../public/nebula-scene/preset-${presetId}.js`);
  writeFileSync(outPath, body);
  console.log(`wrote ${outPath} (${tuples.length} people)`);
}

const VERSION = "20260915";

const scholars = fetchInitialAnswers("2049420510811967937");
buildPreset({
  exportName: "SCHOLARS_AI_MATH",
  presetId: "scholars-ai-math",
  serial: "05",
  version: VERSION,
  question: "如何看待现在有学者用 AI 做数学科研？",
  sourceQuestion: scholars.sourceQuestion,
  axis: {
    left: "质疑 AI 科研",
    center: "审慎试用",
    right: "积极拥抱",
    leftChoice: "警惕滥用",
    rightChoice: "拥抱工具",
    leftTendency: "倾向人工把关",
    rightTendency: "倾向工具先行",
  },
  people: scholars.answers.map((person) => {
    const curated = {
      知乎用户: {
        stance: -0.68,
        cast: "owl",
        claim: "学生用 AI 应付科研时，必须能在办公室讲清证明细节。",
      },
      猫娘神: {
        stance: 0.38,
        cast: "rabbit",
        claim: "AI 极大降低了数学科研 MVP 的门槛，我正在用它做研究。",
      },
      网管: {
        stance: 0.84,
        cast: "penguin",
        claim: "AI 做出的数学已进入井喷期，人类可负责改写并完成形式化验证。",
      },
    }[person.name];
    return {
      ...person,
      stance: curated?.stance ?? 0,
      cast: curated?.cast ?? CAST_KEYS[person.name.length % CAST_KEYS.length],
      claim: curated?.claim ?? person.excerpt,
    };
  }),
  meClaim: "点赞真实回答，看看你更警惕 AI 科研，还是更愿意拥抱工具。",
});

const taoProof = fetchInitialAnswers("4991950322");
buildPreset({
  exportName: "TAO_AI_MATH_PROOF",
  presetId: "tao-ai-math-proof",
  serial: "06",
  version: VERSION,
  question: "如何看待陶哲轩等数学家大力推动的 AI 数学证明?",
  sourceQuestion: taoProof.sourceQuestion,
  axis: {
    left: "质疑 AI 证明",
    center: "分工协作",
    right: "支持推动",
    leftChoice: "警惕伪证",
    rightChoice: "支持推进",
    leftTendency: "倾向人工审查",
    rightTendency: "倾向机器分担",
  },
  people: taoProof.answers.map((person) => {
    const curated = {
      酱紫君: {
        stance: -0.9,
        cast: "goat",
        claim: "常见误用是直接问 AI 然后甩出一堆伪证，专业问题一问三不知。",
      },
      "Yuhang Liu": {
        stance: -0.12,
        cast: "bear",
        claim: "测试表明模型知识量仍有限，复杂群论问题容易答非所问。",
      },
      杂然赋流形丶: {
        stance: 0.58,
        cast: "fox",
        claim: "AI 擅长机械化计算与推导，能把人力从繁琐步骤里解放出来。",
      },
    }[person.name];
    return {
      ...person,
      stance: curated?.stance ?? 0,
      cast: curated?.cast ?? CAST_KEYS[person.name.length % CAST_KEYS.length],
      claim: curated?.claim ?? person.excerpt,
    };
  }),
  meClaim: "点赞真实回答，看看你更担心伪证风险，还是更看好证明自动化。",
});
