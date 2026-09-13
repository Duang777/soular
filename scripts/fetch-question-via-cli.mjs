import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const CLI = "/Users/pingzi/Library/Application Support/zhihu-cli/current/zhihu-cli";
const CAST_KEYS = ["fox", "bear", "cat", "owl", "rabbit", "penguin", "redpanda", "goat", "frog"];

function clip(text, max = 72) {
  const chars = Array.from(String(text).replace(/\s+/g, " ").trim());
  return chars.length > max ? `${chars.slice(0, max - 1).join("")}…` : chars.join("");
}

function parseArgs() {
  const values = {};
  for (const entry of process.argv.slice(2)) {
    const [key, ...rest] = entry.replace(/^--/, "").split("=");
    values[key] = rest.join("=");
  }
  return values;
}

const args = parseArgs();
const questionUrl = args["question-url"];
const presetId = args["preset-id"];
const exportName = args["export-name"];
const serial = args.serial ?? "00";
const questionTitle = args.question ?? "待人工补全问题标题";
const target = Number(args.answers ?? 54);
const maxPages = Number(args["max-pages"] ?? 3);
const pageDelayMs = Number(args["page-delay-ms"] ?? 130_000);
const maxRetries = Number(args["max-retries"] ?? 4);

if (!questionUrl || !presetId || !exportName) {
  throw new Error("需要 --question-url= --preset-id= --export-name=");
}

async function fetchPage(limit, offset = 0) {
  const cliArgs = ["question", "answers", "--question-url", questionUrl, "--limit", String(limit)];
  if (offset) cliArgs.push("--offset", String(offset));
  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const raw = execFileSync(CLI, cliArgs, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
      const payload = JSON.parse(raw);
      if (payload.Code === 0) return payload.Data;
      lastError = new Error(payload.Message || `question answers failed (${payload.Code})`);
      if (payload.Code !== 30001 || attempt === maxRetries) throw lastError;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const message = lastError.message;
      if (!message.includes("rate limit") && !message.includes("30001")) throw lastError;
      if (attempt === maxRetries) throw lastError;
    }
    await sleep(pageDelayMs * (attempt + 1));
  }
  throw lastError ?? new Error("question answers failed");
}

const answers = [];
let offset = 0;
let page = 0;
while (answers.length < target && page < maxPages) {
  const data = await fetchPage(Math.min(50, target - answers.length), offset);
  const items = data?.Items ?? [];
  answers.push(...items);
  const paging = data?.Paging ?? {};
  page += 1;
  if (paging.IsEnd || !items.length) break;
  if (typeof paging.NextOffset !== "number") break;
  offset = paging.NextOffset;
  if (answers.length < target && page < maxPages) await sleep(pageDelayMs);
}

const trimmed = answers.slice(0, target);
const version = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const spectrumAnswers = trimmed.map((item, index) => ({
  contentType: item.ContentType,
  contentToken: String(item.ContentToken),
  url: item.Url,
  summary: item.Summary,
  stance: 0,
  claim: clip(item.Summary),
  cast: CAST_KEYS[index % CAST_KEYS.length],
}));

const root = resolve(import.meta.dirname, "..");
const staging = {
  spectrum: {
    generatedAt: Date.now(),
    questionUrl,
    source: "fallback",
    model: null,
    axis: { left: "倾向质疑", center: "审慎观察", right: "倾向支持" },
    answers: spectrumAnswers,
    warnings: ["通过 zhihu-cli 分页采集，立场待人工补全"],
  },
  presetId,
  serial,
  version,
  warnings: ["通过 zhihu-cli 分页采集，立场待人工补全"],
};

const stagingPath = resolve(root, `server/.staging/${presetId}-${version}.json`);
mkdirSync(resolve(root, "server/.staging"), { recursive: true });
writeFileSync(stagingPath, `${JSON.stringify(staging, null, 2)}\n`);

const people = spectrumAnswers
  .slice()
  .sort((left, right) => left.stance - right.stance)
  .map((answer, index) => [
    `回答 ${String(index + 1).padStart(2, "0")}`,
    answer.stance,
    answer.cast,
    answer.claim,
    answer.url,
    questionTitle,
    null,
  ]);

const body = `export const ${exportName} = {
  id: "${presetId}",
  version: "${version}",
  serial: "${serial}",
  kind: "real",
  question: ${JSON.stringify(questionTitle)},
  peopleLabel: "真实回答观点（作者信息待补充）",
  sourceQuestion: ${JSON.stringify(questionUrl)},
  searchUrl: ${JSON.stringify(questionUrl)},
  avatarBase: "avatars/${presetId}",
  axis: ${JSON.stringify({
    left: "倾向质疑",
    center: "审慎观察",
    right: "倾向支持",
    leftChoice: "倾向质疑",
    rightChoice: "倾向支持",
    leftTendency: "倾向质疑",
    rightTendency: "倾向支持",
  }, null, 2).replaceAll("\n", "\n  ")},
  people: ${JSON.stringify(people, null, 4).replace(/^/gm, "    ").trimStart()},
  followed: [],
  comments: [],
  circles: [],
  me: {
    name: "我",
    castKey: "fox",
    claim: "点赞真实回答，看看你的观点落在光谱何处。",
  },
};
`;

const presetPath = resolve(root, `public/nebula-scene/preset-${presetId}.js`);
writeFileSync(presetPath, body);
console.log(JSON.stringify({ answers: trimmed.length, pages: page, stagingPath, presetPath }, null, 2));

await Promise.resolve();
