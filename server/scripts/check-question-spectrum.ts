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

const leanSpectrum = await buildQuestionSpectrumFromAnswers({
  async zhiDaText() {
    return JSON.stringify({
      axis: { left: "旁系亲属应分得遗产", center: "扶养事实决定酌给", right: "无继承人房产归国家" },
      answers: [
        { i: 0, s: -0.8, r: 0.9, p: "goat" },
        { i: 1, s: 0.2, r: 0.1, p: "fox" },
      ],
    });
  },
}, "https://www.zhihu.com/question/123", [
  {
    ContentType: "Answer",
    ContentToken: "on-axis",
    Url: "https://www.zhihu.com/answer/1",
    Summary: "旁系亲属照顾多年应当分得遗产",
  },
  {
    ContentType: "Answer",
    ContentToken: "off-axis",
    Url: "https://www.zhihu.com/answer/2",
    Summary: "顺便提醒大家记得立遗嘱",
  },
  {
    ContentType: "Answer",
    ContentToken: "unscored",
    Url: "https://www.zhihu.com/answer/3",
    Summary: "法律上房产就该归国家",
  },
]);
assert.deepEqual(
  leanSpectrum.answers.map((answer) => answer.contentToken),
  ["on-axis", "unscored", "off-axis"],
  "模型不再输出 c 字段时，标注仍须生效并参与排序",
);
assert.deepEqual(
  leanSpectrum.answers.map((answer) => answer.relevance),
  [0.9, 0, 0.1],
  "离轴度须按模型输出读取，未被标注的条目记为 0",
);
assert.equal(
  leanSpectrum.answers[0].claim,
  "旁系亲属照顾多年应当分得遗产",
  "模型不再输出主张时须回退到摘要",
);
assert.deepEqual(
  [leanSpectrum.axis.leftReason, leanSpectrum.axis.centerReason, leanSpectrum.axis.rightReason],
  ["", "", ""],
  "模型未返回理由时须留空，由前端降级为单行极标，不得编造",
);

const reasonedSpectrum = await buildQuestionSpectrumFromAnswers({
  async zhiDaText() {
    return JSON.stringify({
      axis: {
        left: "数学是在练人的思维",
        leftReason: "AI 算得再快，也替不了人自己想明白",
        center: "AI 能用，但得有人复核",
        centerReason: "机器给的结论，人不看一遍不敢信",
        right: "AI 已经做出了真数学",
        rightReason: "证明能被机器一步步验过，超出 20 字的部分应当被截断",
      },
      answers: [{ i: 0, s: -0.6, r: 0.9, p: "goat" }],
    });
  },
}, "https://www.zhihu.com/question/123", [{
  ContentType: "Answer",
  ContentToken: "reasoned",
  Url: "https://www.zhihu.com/answer/1",
  Summary: "数学训练的是人的推理能力",
}]);
assert.equal(
  reasonedSpectrum.axis.leftReason,
  "AI 算得再快，也替不了人自己想明白",
  "模型返回理由时须原样保留",
);
assert.equal(
  reasonedSpectrum.axis.centerReason,
  "机器给的结论，人不看一遍不敢信",
  "中间立场的理由同样须保留",
);
assert.ok(
  reasonedSpectrum.axis.rightReason.length <= 20 &&
    reasonedSpectrum.axis.rightReason.endsWith("…"),
  "超长理由须截断到 20 字以内并带省略号，避免撑破极标",
);

// 实测缺陷：模型把 prompt 里的自检说法「加上我觉得读得通」当成输出前缀照写，
// 三个字吃掉 12 字预算后主张被截成残句，因此解析层必须在 clip 之前剥离。
const prefixedSpectrum = await buildQuestionSpectrumFromAnswers({
  async zhiDaText() {
    return JSON.stringify({
      axis: {
        left: "我觉得没继承权就该归国家",
        leftReason: "我认为法定继承顺序写得很明白",
        center: "个人觉得照顾过的人该分一点",
        centerReason: "",
        right: "我觉得，亲戚来争就是吃绝户",
        rightReason: "我的看法是平时不照顾人走了才来抢",
      },
      answers: [{ i: 0, s: -0.6, r: 0.9, p: "goat" }],
    });
  },
}, "https://www.zhihu.com/question/123", [{
  ContentType: "Answer",
  ContentToken: "prefixed",
  Url: "https://www.zhihu.com/answer/1",
  Summary: "法定继承顺序里没有叔舅姑姨",
}]);
assert.equal(
  prefixedSpectrum.axis.left,
  "没继承权就该归国家",
  "「我觉得」前缀须在截断前剥离，剥离后正文完整保留",
);
assert.equal(
  prefixedSpectrum.axis.center,
  "照顾过的人该分一点",
  "「个人觉得」同样须剥离",
);
assert.equal(
  prefixedSpectrum.axis.right,
  "亲戚来争就是吃绝户",
  "前缀后跟逗号时须连标点一起剥离",
);
assert.equal(
  prefixedSpectrum.axis.leftReason,
  "法定继承顺序写得很明白",
  "理由字段的「我认为」前缀同样须剥离",
);
assert.equal(
  prefixedSpectrum.axis.rightReason,
  "平时不照顾人走了才来抢",
  "「我的看法是」前缀须剥离",
);
assert.equal(
  prefixedSpectrum.axis.centerReason,
  "",
  "空理由剥离后仍须是空串，不得变成占位内容",
);

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
