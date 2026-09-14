import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadDotEnv } from "../src/adapters/node-server.js";
import {
  buildQuestionSpectrum,
  normalizeZhihuQuestionUrl,
} from "../src/core/question-spectrum.js";
import { ZhihuClient } from "../src/zhihu/client.js";

if (process.argv.includes("--help")) {
  console.log(
    "prepare-question-preset --question-url=<url> --preset-id=<id> --serial=05 [--question=<title>] [--answers=30] [--export-name=AI_MATH_REVOLUTION]",
  );
  process.exit(0);
}

const SERVER_ROOT = resolve(import.meta.dirname, "..");
process.chdir(SERVER_ROOT);
loadDotEnv();

function argument(name: string): string {
  const prefix = `--${name}=`;
  const value = process.argv.find((entry) => entry.startsWith(prefix))?.slice(prefix.length)?.trim();
  if (!value) throw new Error(`缺少 --${name}`);
  return value;
}

function optionalArgument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((entry) => entry.startsWith(prefix))?.slice(prefix.length)?.trim() ||
    undefined;
}

function integerArgument(name: string, fallback: number, min: number, max: number): number {
  const prefix = `--${name}=`;
  const raw = process.argv.find((entry) => entry.startsWith(prefix))?.slice(prefix.length) ?? String(fallback);
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`--${name} 必须是 ${min}-${max} 的整数`);
  }
  return value;
}

const secret = process.env.ZHIHU_ACCESS_SECRET?.trim();
if (!secret) throw new Error("缺少 ZHIHU_ACCESS_SECRET，无法分页采集回答");

const questionUrl = normalizeZhihuQuestionUrl(argument("question-url"));
const presetId = argument("preset-id");
const serial = argument("serial");
const question = optionalArgument("question");
const exportName = optionalArgument("export-name") ??
  presetId.replaceAll("-", "_").toUpperCase();
if (!/^[a-z0-9-]{1,48}$/.test(presetId)) {
  throw new Error("--preset-id 只允许 1-48 位小写字母、数字和连字符");
}
if (!/^\d{2}$/.test(serial)) {
  throw new Error("--serial 必须是两位数字");
}
if (!/^[A-Z][A-Z0-9_]*$/.test(exportName)) {
  throw new Error("--export-name 必须是合法的大写 JavaScript 标识符");
}
const answerLimit = integerArgument("answers", 30, 5, 60);
const version = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const client = new ZhihuClient(secret);
// 主张和理由都会被 clip 截断，截断后无从判断模型原本想说什么；原文只留在 staging 供人工复核。
let rawResponse: string | null = null;
const spectrum = await buildQuestionSpectrum(client, questionUrl, answerLimit, (raw) => {
  rawResponse = raw;
});
const stagingPath = resolve(SERVER_ROOT, `.staging/${presetId}-${version}.json`);
const temporaryPath = `${stagingPath}.${process.pid}.tmp`;
const warnings = [
  ...(spectrum.warnings ?? []),
  "候选数据仅写入 staging；作者、头像、赞同数、标题和立场须人工复核后再发布。",
];
mkdirSync(dirname(stagingPath), { recursive: true });
try {
  writeFileSync(
    temporaryPath,
    `${JSON.stringify({
      spectrum,
      presetId,
      serial,
      version,
      exportName,
      question: question ?? null,
      warnings,
      rawResponse,
    }, null, 2)}\n`,
  );
  renameSync(temporaryPath, stagingPath);
} finally {
  rmSync(temporaryPath, { force: true });
}

console.log(`prepared ${spectrum.answers.length} candidate answers -> ${stagingPath}`);
console.log("请先补齐并人工复核作者、头像、赞同数、标题和立场，再生成正式快照。");
