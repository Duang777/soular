import assert from "node:assert/strict";
import { createHandler } from "../src/core/app.js";
import {
  buildQuestionSpectrumFromAnswers,
  collectQuestionAnswers,
  normalizeZhihuQuestionUrl,
} from "../src/core/question-spectrum.js";
import { SessionStore } from "../src/core/session.js";
import { InMemoryCache, InMemorySessionBackend } from "../src/core/storage.js";
import type { QuestionAnswersData } from "../src/types.js";
import { ZhihuApiError } from "../src/zhihu/client.js";

assert.equal(
  normalizeZhihuQuestionUrl("https://zhihu.com/question/123/?utm_source=test"),
  "https://www.zhihu.com/question/123",
);
assert.throws(() => normalizeZhihuQuestionUrl("https://example.com/question/123"));

const offsets: string[] = [];
const pages: Record<string, QuestionAnswersData> = {
  "0": {
    Items: [{ ContentType: "Answer", ContentToken: "1", Url: "https://www.zhihu.com/answer/1", Summary: "反对观点" }],
    Paging: { IsEnd: false, NextOffset: "42" },
  },
  "42": {
    Items: [{ ContentType: "Answer", ContentToken: "2", Url: "https://www.zhihu.com/answer/2", Summary: "支持观点" }],
    Paging: { IsEnd: true },
  },
};
const collected = await collectQuestionAnswers({
  async questionAnswers(_url, options) {
    const offset = String(options?.offset ?? "0");
    offsets.push(offset);
    return pages[offset];
  },
}, "https://www.zhihu.com/question/123", 2);
assert.deepEqual(offsets, ["0", "42"]);
assert.equal(collected.answers.length, 2);

let partialPage = 0;
const partial = await collectQuestionAnswers({
  async questionAnswers() {
    partialPage += 1;
    if (partialPage > 1) throw new Error("upstream timeout");
    return {
      Items: pages["0"].Items,
      Paging: { IsEnd: false, NextOffset: "42" },
    };
  },
}, "https://www.zhihu.com/question/123", 2);
assert.equal(partial.answers.length, 1);
assert.match(partial.warnings[0], /已保留前 1 条/);

let fatalPage = 0;
await assert.rejects(
  () => collectQuestionAnswers({
    async questionAnswers() {
      fatalPage += 1;
      if (fatalPage > 1) throw new ZhihuApiError(30002, "rate limit exceeded");
      return {
        Items: pages["0"].Items,
        Paging: { IsEnd: false, NextOffset: "42" },
      };
    },
  }, "https://www.zhihu.com/question/123", 2),
  (error: unknown) => error instanceof ZhihuApiError && error.code === 30002,
);
assert.equal(fatalPage, 2, "后续分页的配额错误必须立即终止采集");

const malformed = await collectQuestionAnswers({
  async questionAnswers() {
    return {
      Items: [
        null,
        {
          ContentType: "Answer",
          ContentToken: 3,
          Url: "https://www.zhihu.com/answer/3",
          Summary: "  可保留的回答  ",
        },
      ],
      Paging: null,
    } as unknown as QuestionAnswersData;
  },
}, "https://www.zhihu.com/question/123", 2);
assert.equal(malformed.answers.length, 1);
assert.equal(malformed.answers[0].ContentToken, "3");
assert.equal(malformed.answers[0].Summary, "可保留的回答");
assert.ok(malformed.warnings.some((warning) => warning.includes("格式无效")));
assert.ok(malformed.warnings.some((warning) => warning.includes("分页结构无效")));

const bounded = await collectQuestionAnswers({
  async questionAnswers() {
    return {
      Items: [
        null,
        {
          ContentType: "Answer",
          ContentToken: "valid-1",
          Url: "https://www.zhihu.com/answer/valid-1",
          Summary: "第一条有效回答",
        },
        {
          ContentType: "Answer",
          ContentToken: "valid-2",
          Url: "https://www.zhihu.com/answer/valid-2",
          Summary: "第二条有效回答",
        },
      ],
      Paging: { IsEnd: true },
    } as unknown as QuestionAnswersData;
  },
}, "https://www.zhihu.com/question/123", 2);
assert.deepEqual(
  bounded.answers.map((answer) => answer.ContentToken),
  ["valid-1", "valid-2"],
  "无效条目不得挤占有效回答的数量上限",
);

let overlapPage = 0;
const overlap = await collectQuestionAnswers({
  async questionAnswers() {
    overlapPage += 1;
    return overlapPage === 1
      ? {
          Items: [pages["0"].Items[0]],
          Paging: { IsEnd: false, NextOffset: "42" },
        }
      : {
          Items: [pages["0"].Items[0], pages["42"].Items[0]],
          Paging: { IsEnd: true },
        };
  },
}, "https://www.zhihu.com/question/123", 2);
assert.deepEqual(
  overlap.answers.map((answer) => answer.ContentToken),
  ["1", "2"],
  "分页重叠不得生成重复观点或挤占唯一回答",
);
assert.ok(overlap.warnings.some((warning) => warning.includes("重复回答")));

const spectrum = await buildQuestionSpectrumFromAnswers({
  async zhiDaText() {
    return JSON.stringify({
      axis: { left: "反对", center: "观望", right: "支持" },
      answers: [
        { i: 0, s: -0.8, c: "核心反对理由", p: "goat" },
        { i: 1, s: 0.7, c: "核心支持理由", p: "redpanda" },
      ],
    });
  },
}, "https://www.zhihu.com/question/123", collected.answers);
assert.equal(spectrum.source, "ai");
assert.deepEqual(spectrum.answers.map((answer) => answer.stance), [-0.8, 0.7]);
assert.deepEqual(spectrum.answers.map((answer) => answer.cast), ["goat", "redpanda"]);
assert.equal(spectrum.axis.center, "观望");

const sortedSpectrum = await buildQuestionSpectrumFromAnswers({
  async zhiDaText() {
    return JSON.stringify({
      axis: {},
      answers: [
        { i: 0, s: 0.8, c: "支持", p: "fox" },
        { i: 1, s: -0.8, c: "反对", p: "goat" },
      ],
    });
  },
}, "https://www.zhihu.com/question/123", collected.answers);
assert.deepEqual(
  sortedSpectrum.answers.map((answer) => answer.stance),
  [-0.8, 0.8],
  "离线结果必须按立场从左到右排列",
);

const unicodeSpectrum = await buildQuestionSpectrumFromAnswers({
  async zhiDaText() {
    return "模型输出格式无效";
  },
}, "https://www.zhihu.com/question/123", [{
  ContentType: "Answer",
  ContentToken: "unicode",
  Url: "https://www.zhihu.com/answer/unicode",
  Summary: `${"a".repeat(70)}👨‍👩‍👧‍👦xy`,
}]);
assert.equal(unicodeSpectrum.answers[0].claim, `${"a".repeat(70)}👨‍👩‍👧‍👦…`);
assert.ok(!unicodeSpectrum.answers[0].claim.includes("�"));

let quotaCalls = 0;
await assert.rejects(
  () => buildQuestionSpectrumFromAnswers({
    async zhiDaText() {
      quotaCalls += 1;
      throw new ZhihuApiError(30002, "rate limit exceeded");
    },
  }, "https://www.zhihu.com/question/123", collected.answers),
  (error: unknown) => error instanceof ZhihuApiError && error.code === 30002,
);
assert.equal(quotaCalls, 1, "模型配额错误必须立即向上游传播");

const handler = createHandler({
  config: {
    appId: "",
    appKey: "",
    accessSecret: "",
    redirectUri: null,
    frontendUrl: "http://localhost:4325/",
    cookieSecure: false,
    oauthConfigured: false,
    dataApiConfigured: false,
  },
  sessions: new SessionStore(new InMemorySessionBackend(), false),
  contentCache: new InMemoryCache(),
});
for (const pathname of [
  "/api/galaxy",
  "/api/question-spectrum?questionUrl=https://www.zhihu.com/question/123",
  "/api/zhihu/question-answers?questionUrl=https://www.zhihu.com/question/123",
  "/api/zhihu/question-recommendations",
  "/api/zhihu/search?q=test",
]) {
  const response = await handler(new Request(`http://localhost${pathname}`));
  assert.equal(response.status, 404, `${pathname} 不得暴露为公网接口`);
}

console.log("question-spectrum checks passed");
