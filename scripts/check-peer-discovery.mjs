import assert from "node:assert/strict";
import {
  describePeerMatch,
  rankPeerCandidates,
  takePeerBatch,
} from "../public/nebula-scene/peer-discovery.js";

const people = [
  ["同派近邻", 0.28, "fox", "关注协作方法"],
  ["异派最近", 0.21, "owl", "关注职业判断"],
  ["同派远端", -0.7, "fox", "关注技术边界"],
  ["异派兴趣", 0.9, "bear", "Agent 协作需要验证"],
  ["异派中段", 0.42, "cat", "保留人的判断"],
  ["异派稍远", 0.5, "goat", "工具不能代替理解"],
  ["异派远端", -0.9, "frog", "谨慎对待模型输出"],
];

const interestByIndex = new Map([
  [0, { score: 0.1, word: "协作" }],
  [3, { score: 1, word: "Agent" }],
]);

const ranked = rankPeerCandidates({
  people,
  myStance: 0.2,
  myCast: "fox",
  likedIndexes: [],
  interestForIndex: (index) => interestByIndex.get(index),
});

assert.deepEqual(
  ranked.slice(0, 2).map(({ index }) => index),
  [0, 2],
  "同人格候选必须优先于其他人格",
);
assert.ok(
  ranked.find(({ index }) => index === 1).score >
    ranked.find(({ index }) => index === 3).score,
  "立场接近度必须以 82% 权重压过 18% 兴趣相关性",
);
assert.ok(
  Math.abs(ranked.find(({ index }) => index === 3).score - 0.713) < 1e-9,
  "同频综合分必须固定使用 82% 立场和 18% 兴趣权重",
);

const excludingLiked = rankPeerCandidates({
  people,
  myStance: 0.2,
  myCast: "fox",
  likedIndexes: [0, 3],
  interestForIndex: (index) => interestByIndex.get(index),
});
assert.equal(excludingLiked.length, people.length - 2);
assert.ok(
  excludingLiked.every(({ index }) => index !== 0 && index !== 3),
  "仍有未点赞候选时不得推荐已点赞回答者",
);

const first = takePeerBatch(ranked, [], 5);
const second = takePeerBatch(ranked, first.seenIndexes, 5);
const third = takePeerBatch(ranked, second.seenIndexes, 5);

assert.equal(first.items.length, 5, "首批必须展示五位候选");
assert.equal(second.items.length, 2, "最后一批不足五人时必须保留真实数量");
assert.equal(
  new Set([...first.items, ...second.items].map(({ index }) => index)).size,
  7,
  "候选耗尽前不得重复",
);
assert.equal(second.exhausted, true, "最后一批必须标记候选已耗尽");
assert.equal(third.restarted, true, "候选耗尽后下一批才能开启新一轮");
assert.equal(third.items.length, 5, "新一轮恢复五人批次");

const fallback = rankPeerCandidates({
  people: people.slice(0, 3),
  myStance: 0.2,
  myCast: "fox",
  likedIndexes: [0, 1, 2],
});
assert.equal(fallback.length, 3, "无未点赞候选时必须降级到完整静态快照");

assert.deepEqual(
  describePeerMatch({
    candidate: ranked[0],
    myStance: 0.2,
    myCast: "fox",
    castName: "解构狐",
    leftChoice: "谨慎",
    rightChoice: "乐观",
  }),
  {
    similarity: "同属「解构狐」，本题立场相似 96 / 100",
    difference: "TA 比你略偏向「乐观」",
  },
  "无画像时必须仅依据本题人格和立场解释",
);

console.log("peer discovery checks passed");
