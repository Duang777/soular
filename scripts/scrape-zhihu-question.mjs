import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const CAST_KEYS = ["fox", "bear", "cat", "owl", "rabbit", "penguin", "redpanda", "goat", "frog"];

function clip(text, max = 72) {
  const chars = Array.from(text.replace(/\s+/g, " ").trim());
  return chars.length > max ? `${chars.slice(0, max - 1).join("")}…` : chars.join("");
}

function fetchMarkdown(questionId) {
  const url = `https://www.zhihu.com/question/${questionId}`;
  const output = execFileSync("moli", [
    "fetch",
    "--dump",
    "markdown",
    "--wait-until",
    "domstable",
    url,
  ], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  const jsonStart = output.indexOf("{");
  const markdown = jsonStart >= 0 && output.trimStart().startsWith("{")
    ? JSON.parse(output).html ?? output.slice(output.lastIndexOf("\n") + 1)
    : output;
  return typeof markdown === "string" ? markdown : output;
}

function parseQuestionTitle(markdown) {
  const match = markdown.match(/^# (.+)$/m);
  return match?.[1]?.trim() ?? "";
}

function parseAnswers(markdown, questionId) {
  const lines = markdown.split("\n");
  const answers = [];
  let current = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const avatarMatch = line.match(/^\[!\[([^\]]+)\]\((https:\/\/[^)]+)\)\]\((\/\/www\.zhihu\.com\/people\/[^)]+)\)/);
    if (avatarMatch) {
      if (current?.name) answers.push(current);
      current = {
        name: avatarMatch[1].trim(),
        avatar: avatarMatch[2],
        votes: null,
        claim: "",
        answerUrl: "",
      };
      continue;
    }
    const answerLink = line.match(
      new RegExp(`\\]\\(\\/\\/www\\.zhihu\\.com\\/question\\/${questionId}\\/answer\\/(\\d+)\\)`),
    );
    if (current && answerLink) {
      current.answerUrl = `https://www.zhihu.com/question/${questionId}/answer/${answerLink[1]}`;
      continue;
    }
    const voteMatch = line.match(/(?:^|\s)赞同\s*(\d[\d,]*)/);
    if (current && voteMatch) {
      current.votes = Number(voteMatch[1].replace(/,/g, ""));
      continue;
    }
    if (current && !current.claim && line.trim() && !line.startsWith("[") && !line.startsWith("!")) {
      const text = line.trim();
      if (text.length > 12 && !text.startsWith("阅读全文")) {
        current.claim = clip(text);
      }
    }
  }
  if (current?.name) answers.push(current);
  return answers.filter((answer) => answer.answerUrl && answer.claim);
}

function stanceForIndex(index, total) {
  if (total <= 1) return 0;
  return Math.round((-0.88 + (index / (total - 1)) * 1.76) * 100) / 100;
}

function main() {
  const questionId = process.argv[2];
  const presetId = process.argv[3];
  if (!questionId || !presetId) {
    console.error("usage: node scripts/scrape-zhihu-question.mjs <questionId> <presetId>");
    process.exit(1);
  }
  const markdown = fetchMarkdown(questionId);
  const question = parseQuestionTitle(markdown);
  const answers = parseAnswers(markdown, questionId);
  const output = {
    presetId,
    questionId,
    question,
    sourceQuestion: `https://www.zhihu.com/question/${questionId}`,
    answers: answers.map((answer, index) => ({
      ...answer,
      cast: CAST_KEYS[index % CAST_KEYS.length],
      stance: stanceForIndex(index, answers.length),
    })),
  };
  const outDir = resolve("server/.staging");
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, `${presetId}.json`);
  writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`wrote ${answers.length} answers to ${outPath}`);
}

main();
