import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadDotEnv } from "../src/adapters/node-server.js";
import {
  buildQuestionSpectrum,
  normalizeZhihuQuestionUrl,
} from "../src/core/question-spectrum.js";
import { ZhihuClient } from "../src/zhihu/client.js";

if (process.argv.includes("--help")) {
  console.log("prepare-hot-spectrums [--count=1..5] [--answers=5..50] [--out=.staging/hot-spectrums.json]");
  process.exit(0);
}

loadDotEnv();

function argument(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function integerArgument(name: string, fallback: number, min: number, max: number): number {
  const value = Number(argument(name, String(fallback)));
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`--${name} 必须是 ${min}-${max} 的整数`);
  }
  return value;
}

const secret = process.env.ZHIHU_ACCESS_SECRET?.trim();
if (!secret) throw new Error("缺少 ZHIHU_ACCESS_SECRET，未发起任何知乎或 AI 请求");

const count = integerArgument("count", 3, 1, 5);
const answerLimit = integerArgument("answers", 30, 5, 50);
const outputPath = resolve(process.cwd(), argument("out", ".staging/hot-spectrums.json"));
const client = new ZhihuClient(secret);
const hot = await client.hotList(30);
const hotItems = hot && typeof hot === "object" && Array.isArray(hot.Items)
  ? hot.Items.slice(0, 30)
  : [];
const questions: Array<{ Title: string; Url: string }> = [];
for (const value of hotItems) {
  if (!value || typeof value !== "object" || Array.isArray(value)) continue;
  const item = value as unknown as Record<string, unknown>;
  const title = typeof item.Title === "string" ? item.Title.trim() : "";
  const url = typeof item.Url === "string" ? item.Url : "";
  if (!title || !url) continue;
  try {
    questions.push({ Title: title, Url: normalizeZhihuQuestionUrl(url) });
    if (questions.length >= count) break;
  } catch {
    // 跳过热榜中不是知乎问题页的条目。
  }
}

if (!questions.length) throw new Error("当前热榜没有可生成星云的问题");

const candidates = [];
const failures = [];

for (let index = 0; index < questions.length; index += 1) {
  const question = questions[index];
  try {
    const spectrum = await buildQuestionSpectrum(client, question.Url, answerLimit);
    const questionId = spectrum.questionUrl.slice(spectrum.questionUrl.lastIndexOf("/") + 1);
    candidates.push({
      reviewStatus: "needs-author-enrichment",
      preset: {
        id: `hot-${questionId}`,
        version: String(spectrum.generatedAt),
        serial: String(index + 3).padStart(2, "0"),
        kind: "real",
        question: question.Title,
        peopleLabel: "真实回答观点（作者信息待补充）",
        sourceQuestion: spectrum.questionUrl,
        searchUrl: spectrum.questionUrl,
        axis: {
          ...spectrum.axis,
          leftChoice: spectrum.axis.left,
          rightChoice: spectrum.axis.right,
          leftTendency: spectrum.axis.left,
          rightTendency: spectrum.axis.right,
        },
        people: spectrum.answers.map((answer, answerIndex) => [
          `回答 ${String(answerIndex + 1).padStart(2, "0")}`,
          answer.stance,
          answer.cast,
          answer.claim,
          answer.url,
          question.Title,
        ]),
        followed: [],
        comments: [],
        circles: [],
        me: {
          name: "我",
          castKey: "fox",
          claim: "点赞真实回答，看看你的观点落在光谱何处。",
        },
      },
      source: {
        generatedAt: spectrum.generatedAt,
        model: spectrum.model,
        mode: spectrum.source,
        warnings: spectrum.warnings,
      },
    });
  } catch (error) {
    failures.push({
      question: question.Title,
      url: question.Url,
      error: error instanceof Error ? error.message : "生成失败",
    });
    break;
  }
}

if (failures.length) {
  console.error(JSON.stringify({ failures }, null, 2));
  throw new Error(`有 ${failures.length} 个候选生成失败，原输出文件保持不变`);
}

mkdirSync(dirname(outputPath), { recursive: true });
const temporaryPath = `${outputPath}.${process.pid}.tmp`;
try {
  writeFileSync(
    temporaryPath,
    `${JSON.stringify({ generatedAt: Date.now(), candidates, failures: [] }, null, 2)}\n`,
  );
  renameSync(temporaryPath, outputPath);
} finally {
  rmSync(temporaryPath, { force: true });
}
console.log(`prepared ${candidates.length} candidate(s): ${outputPath}`);
