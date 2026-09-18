/**
 * 把 prepare-question-preset 产出的 staging 候选组装成可发布的星云快照。
 *
 * 拆成独立一步是因为两步的配额成本差一个量级：采集要烧 1 次直答（限流窗口内只够 2 次），
 * 组装用站内搜索补一部分作者并写回 staging。正式生成前必须把剩余作者补全，
 * 重跑组装会复用 staging，不再消耗配额。
 *
 * 用法：
 *   npm run build:preset -- --staging=.staging/xxx-20260914.json --question="标题" --serial=04
 *   追加 --refresh-authors 强制重新搜索作者，默认复用 staging 里已补全的结果。
 */

import { readFileSync, writeFileSync, renameSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { loadDotEnv } from "../src/adapters/node-server.js";
import type { QuestionSpectrum } from "../src/core/question-spectrum.js";
import { ZhihuClient } from "../src/zhihu/client.js";

if (process.argv.includes("--help")) {
  console.log(
    "build-preset --staging=<path> --question=<title> --serial=NN [--export-name=X] [--refresh-authors]",
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

interface StagingFile {
  spectrum: QuestionSpectrum;
  presetId: string;
  serial: string;
  version: string;
  exportName: string;
  question: string | null;
  warnings: string[];
  rawResponse?: string | null;
  /** 站内搜索补全结果，按 answer id 索引；写回 staging 让重跑组装零配额。 */
  authors?: Record<string, EnrichedAuthor>;
}

interface EnrichedAuthor {
  name: string;
  avatar: string;
  votes: number;
}

const stagingPath = resolve(SERVER_ROOT, argument("staging"));
const questionTitle = argument("question");
const serial = argument("serial");
if (!/^\d{2}$/.test(serial)) throw new Error("--serial 必须是两位数字");

const staging = JSON.parse(readFileSync(stagingPath, "utf8")) as StagingFile;
const spectrum = staging.spectrum;
const presetId = staging.presetId;
const exportName = optionalArgument("export-name") ?? staging.exportName;

function answerId(url: string): string {
  return /\/answer\/(\d+)/.exec(url)?.[1] ?? "";
}

/**
 * 站内搜索是开发者接口中唯一能拿到作者名、头像和赞同数的入口，但上游每题恒定只返 10 条、
 * 实测仅 2-3 条能与分页结果对上，所以这里只做初始补全。其余作者必须在 staging 中补齐，
 * 缺少真实姓名或头像时拒绝生成正式快照。
 * 只接受 https 的 zhimg 头像，与页面内 safeUserAvatarUrl 的白名单保持一致。
 */
function safeAvatar(value: unknown): string {
  if (typeof value !== "string" || !value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" && /(^|\.)zhimg\.com$/i.test(url.hostname) ? url.href : "";
  } catch {
    return "";
  }
}

async function enrichAuthors(): Promise<Record<string, EnrichedAuthor>> {
  if (staging.authors && !process.argv.includes("--refresh-authors")) {
    console.log(`复用 staging 里已补全的 ${Object.keys(staging.authors).length} 位作者，未调用搜索`);
    return staging.authors;
  }
  const secret = process.env.ZHIHU_ACCESS_SECRET?.trim();
  if (!secret) throw new Error("缺少 ZHIHU_ACCESS_SECRET，无法补全作者");
  const client = new ZhihuClient(secret);
  const known = new Set(spectrum.answers.map((answer) => answerId(answer.url)).filter(Boolean));
  const found: Record<string, EnrichedAuthor> = {};
  const result = await client.zhihuSearch(questionTitle);
  for (const item of result.Items ?? []) {
    if (item.ContentType !== "Answer") continue;
    const id = answerId(item.Url);
    if (!id || !known.has(id)) continue;
    const name = (item.AuthorName ?? "").trim();
    if (!name) continue;
    found[id] = {
      name,
      avatar: safeAvatar(item.AuthorAvatar),
      votes: Number(item.VoteUpCount) || 0,
    };
  }
  staging.authors = found;
  const temporary = `${stagingPath}.${process.pid}.tmp`;
  try {
    writeFileSync(temporary, `${JSON.stringify(staging, null, 2)}\n`);
    renameSync(temporary, stagingPath);
  } finally {
    rmSync(temporary, { force: true });
  }
  console.log(`搜索补全 ${Object.keys(found).length}/${spectrum.answers.length} 位作者，已写回 staging`);
  return found;
}

const authors = await enrichAuthors();

function personRow(answer: QuestionSpectrum["answers"][number], index: number) {
  const id = answerId(answer.url);
  const author = authors[id];
  const name = author?.name.trim();
  const avatar = safeAvatar(author?.avatar);
  if (!id || !name || !avatar) {
    throw new Error(
      `回答 ${id || index + 1} 缺少真实作者姓名或头像，拒绝生成带占位身份的正式快照`,
    );
  }
  return [
    name,
    answer.stance,
    answer.cast,
    answer.claim,
    answer.url,
    questionTitle,
    Number(author.votes) || 0,
    avatar,
    answer.relevance,
  ];
}

const people = spectrum.answers.map(personRow);

const preset = {
  id: presetId,
  version: staging.version,
  serial,
  kind: "real",
  question: questionTitle,
  peopleLabel: "知乎真实回答",
  sourceQuestion: spectrum.questionUrl,
  searchUrl: spectrum.questionUrl,
  axis: spectrum.axis,
  people,
  me: {
    name: "我",
    castKey: "fox",
    claim: "点赞几个回答，星云会标出你此刻的立场位置。",
  },
};

/** 逐行手写 people，避免 JSON.stringify 把 48 条观点压成一行难以 review 的长文本。 */
const peopleLines = people
  .map((row) => `    ${JSON.stringify(row)},`)
  .join("\n");
const body = JSON.stringify({ ...preset, people: "__PEOPLE__" }, null, 2)
  .replace('"__PEOPLE__"', `[\n${peopleLines}\n  ]`);

const outputPath = resolve(SERVER_ROOT, `../public/nebula-scene/preset-${presetId}.js`);
writeFileSync(outputPath, `export const ${exportName} = ${body};\n`);

console.log(`已生成 ${outputPath}`);
console.log(`观点 ${people.length} 条，作者姓名和头像均已补全`);
console.log(`轴：${spectrum.axis.left} / ${spectrum.axis.center} / ${spectrum.axis.right}`);
console.log("请在 public/nebula-scene/presets.js 中注册后再发布。");
