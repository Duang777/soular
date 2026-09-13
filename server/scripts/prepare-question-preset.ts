import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadDotEnv } from "../src/adapters/node-server.js";
import {
  buildQuestionSpectrum,
  normalizeZhihuQuestionUrl,
} from "../src/core/question-spectrum.js";
import { ZhihuClient } from "../src/zhihu/client.js";

if (process.argv.includes("--help")) {
  console.log(
    "prepare-question-preset --question-url=<url> --preset-id=<id> --serial=05 [--answers=30] [--export-name=AI_MATH_REVOLUTION]",
  );
  process.exit(0);
}

loadDotEnv();

function argument(name: string): string {
  const prefix = `--${name}=`;
  const value = process.argv.find((entry) => entry.startsWith(prefix))?.slice(prefix.length)?.trim();
  if (!value) throw new Error(`缺少 --${name}`);
  return value;
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
const exportName = process.argv.find((entry) => entry.startsWith("--export-name="))?.slice(14) ??
  presetId.replace(/(^.)|(-.)/g, (value) => value.toUpperCase().replace("-", "_"));
const answerLimit = integerArgument("answers", 30, 5, 60);
const version = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const client = new ZhihuClient(secret);
const spectrum = await buildQuestionSpectrum(client, questionUrl, answerLimit);
const question = spectrum.questionUrl.slice(spectrum.questionUrl.lastIndexOf("/") + 1);
const avatarDir = resolve(process.cwd(), `../public/nebula-scene/avatars/${presetId}`);
mkdirSync(avatarDir, { recursive: true });

const people = spectrum.answers.map((answer, index) => {
  const avatarUrl = answer.url;
  void avatarUrl;
  return [
    `回答 ${String(index + 1).padStart(2, "0")}`,
    answer.stance,
    answer.cast,
    answer.claim,
    answer.url,
    `问题 ${question}`,
    null,
  ];
});

const stagingPath = resolve(process.cwd(), `.staging/${presetId}-${version}.json`);
mkdirSync(dirname(stagingPath), { recursive: true });
writeFileSync(
  stagingPath,
  `${JSON.stringify({ spectrum, presetId, serial, version, warnings: spectrum.warnings }, null, 2)}\n`,
);

const presetPath = resolve(process.cwd(), `../public/nebula-scene/preset-${presetId}.js`);
const body = `export const ${exportName} = {
  id: "${presetId}",
  version: "${version}",
  serial: "${serial}",
  kind: "real",
  question: "待人工补全问题标题",
  peopleLabel: "真实回答观点（作者信息待补充）",
  sourceQuestion: "${spectrum.questionUrl}",
  searchUrl: "${spectrum.questionUrl}",
  avatarBase: "avatars/${presetId}",
  axis: ${JSON.stringify({
    ...spectrum.axis,
    leftChoice: spectrum.axis.left,
    rightChoice: spectrum.axis.right,
    leftTendency: spectrum.axis.left,
    rightTendency: spectrum.axis.right,
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
writeFileSync(presetPath, body);
console.log(`prepared ${people.length} answers -> ${presetPath}`);
console.log(`staging: ${stagingPath}`);
console.log("请补充作者昵称、头像与问题标题后，再运行 npm run build。");
