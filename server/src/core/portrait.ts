import type {
  FavlistRecord,
  FolloweeItem,
  UserContentItem,
} from "../types.js";
import type { ZhihuClient } from "../zhihu/client.js";

export const PORTRAIT_TTL_SECONDS = 10 * 60;

const FETCH_LIMIT = 50;
const TOP_CONTENT_COUNT = 6;
const TOP_FAVLIST_COUNT = 10;
const TOP_FOLLOWEE_COUNT = 12;
const TOP_COLLECTION_COUNT = 8;
const KEYWORD_COUNT = 12;
const PRUNE_POOL_SIZE = 80;
const FRAGMENT_COVERAGE_RATIO = 1;

export interface KeywordTag {
  word: string;
  score: number;
}

export interface Portrait {
  generatedAt: string;
  stats: {
    contents: number;
    followees: number;
    favlists: number;
    collections: number;
    likesReceived: number;
    contentKinds: Record<string, number>;
  };
  keywords: KeywordTag[];
  topContents: UserContentItem[];
  favlists: Array<{ title: string; description: string; isPublic: boolean }>;
  followees: Array<{ name: string; headline: string; followerCount: number }>;
  recentCollections: UserContentItem[];
  warnings: string[];
}

interface ScoredText {
  text: string;
  weight: number;
}

const CJK_STOP_CHARS = new Set(
  (
    "的了是我你他她它们在有和就不都而与及也很被把让给对从到等中上下这那个些么如何怎为什可以一个没或但因所如果样自己们最更还之于以其则又再便只却吧呢吗啊呀哦哈嘛呗欤哎喔能会要去说想做看用觉得知道"
  ).split(""),
);

const CJK_STOP_WORDS = new Set([
  "分析", "数据", "方法", "公式", "问题", "解决", "方案", "设计", "思路",
  "学习", "笔记", "整理", "理解", "内容", "文章", "回答", "介绍", "总结",
  "相关", "关于", "通过", "进行", "需要", "可以", "可能", "应该", "这些",
  "那些", "这个", "那个", "这种", "一种", "一些", "一下", "知乎", "我们",
  "你们", "他们", "自己", "什么", "怎么", "为什么", "如何", "已经", "比较",
  "非常", "真的", "因为", "所以", "但是", "或者", "如果", "然后", "知道",
  "觉得", "就是", "还是", "不是", "没有", "以及", "一个", "时候", "现在",
  "今天", "出来", "起来", "东西", "事情", "其实", "感觉", "建议", "看到",
  "笔记整理", "图片",
]);

const EN_STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for",
  "with", "is", "are", "was", "were", "be", "by", "at", "as", "it",
  "this", "that", "from", "your", "you", "we", "our", "their", "his",
  "her", "its", "not", "no", "can", "how", "what", "why", "do", "does",
  "https", "http", "com", "www", "zhihu", "html", "jpg", "png",
]);

function bump(map: Map<string, number>, key: string, delta: number): void {
  map.set(key, (map.get(key) ?? 0) + delta);
}

function everyCharMeaningful(word: string): boolean {
  for (const char of word) {
    if (CJK_STOP_CHARS.has(char)) return false;
  }
  return true;
}

function validGram(gram: string): boolean {
  return everyCharMeaningful(gram) && !CJK_STOP_WORDS.has(gram);
}

export function extractKeywords(documents: ScoredText[]): KeywordTag[] {
  const scores = new Map<string, number>();
  const docFreq = new Map<string, number>();
  const coveredFreq = new Map<string, number>();
  const en = new Map<string, number>();

  for (const doc of documents) {
    const text = doc.text.trim();
    if (!text) continue;

    for (const match of text.matchAll(/[a-zA-Z][a-zA-Z+#.-]{1,}/g)) {
      const word = match[0].toLowerCase().replace(/[.+#-]+$/, "");
      if (word.length >= 2 && !EN_STOP_WORDS.has(word)) bump(en, word, doc.weight);
    }

    const rawGrams = new Set<string>();
    for (const segment of text.match(/[\u4e00-\u9fff]+/g) ?? []) {
      for (let size = 2; size <= 6; size += 1) {
        for (let i = 0; i + size <= segment.length; i += 1) {
          const gram = segment.slice(i, i + size);
          rawGrams.add(gram);
          if (size <= 5 && validGram(gram)) bump(scores, gram, doc.weight * size);
        }
      }
    }

    for (const gram of rawGrams) {
      if (!validGram(gram)) continue;
      docFreq.set(gram, (docFreq.get(gram) ?? 0) + 1);
      for (const longer of rawGrams) {
        if (longer.length > gram.length && longer.includes(gram)) {
          coveredFreq.set(gram, (coveredFreq.get(gram) ?? 0) + 1);
          break;
        }
      }
    }
  }

  const candidates = new Map<string, number>(scores);
  for (const [word, score] of en) {
    candidates.set(word, (candidates.get(word) ?? 0) + score * 2);
  }

  const pool = [...candidates.entries()]
    .map(([word, score]) => ({ word, score }))
    .sort((a, b) => b.score - a.score || b.word.length - a.word.length)
    .slice(0, PRUNE_POOL_SIZE);

  const survivors: { word: string; score: number }[] = [];
  for (const candidate of pool) {
    const df = docFreq.get(candidate.word) ?? 0;
    const covered = coveredFreq.get(candidate.word) ?? 0;
    if (df > 0 && covered / df >= FRAGMENT_COVERAGE_RATIO) continue;

    const overlapping = survivors.some((tag) => {
      if (tag.word.includes(candidate.word) || candidate.word.includes(tag.word)) {
        return true;
      }
      if (
        tag.word.length === candidate.word.length &&
        candidate.word.length >= 3
      ) {
        const overlap = candidate.word.length - 1;
        return (
          tag.word.slice(1) === candidate.word.slice(0, overlap) ||
          tag.word.slice(0, overlap) === candidate.word.slice(1)
        );
      }
      return false;
    });
    if (!overlapping) survivors.push(candidate);
  }

  return survivors
    .slice(0, KEYWORD_COUNT)
    .map(({ word, score }) => ({ word, score: Math.round(score * 10) / 10 }));
}

function isSettled<T>(result: PromiseSettledResult<T>): result is PromiseFulfilledResult<T> {
  return result.status === "fulfilled";
}

function failureName(result: PromiseSettledResult<unknown>): string {
  return result.status === "rejected" && result.reason instanceof Error
    ? result.reason.message
    : "请求失败";
}

export async function buildPortrait(
  client: ZhihuClient,
  oauthToken: string,
): Promise<Portrait> {
  const [contentsResult, followeesResult, favlistsResult, collectionsResult] =
    await Promise.allSettled([
      client.userContents(oauthToken, { contentType: "all", limit: FETCH_LIMIT, sortField: "ts" }),
      client.userFollowees(oauthToken, { limit: FETCH_LIMIT }),
      client.userFavlists(oauthToken, FETCH_LIMIT),
      client.userCollections(oauthToken, FETCH_LIMIT),
    ]);

  const warnings: string[] = [];
  if (!isSettled(contentsResult)) warnings.push(`创作数据获取失败：${failureName(contentsResult)}`);
  if (!isSettled(followeesResult)) warnings.push(`关注列表获取失败：${failureName(followeesResult)}`);
  if (!isSettled(favlistsResult)) warnings.push(`收藏夹获取失败：${failureName(favlistsResult)}`);
  if (!isSettled(collectionsResult)) warnings.push(`近期收藏获取失败：${failureName(collectionsResult)}`);

  const contentItems: UserContentItem[] = isSettled(contentsResult)
    ? contentsResult.value.Items
    : [];
  const followeeItems: FolloweeItem[] = isSettled(followeesResult)
    ? followeesResult.value.Items
    : [];
  const favlistItems: FavlistRecord[] = isSettled(favlistsResult)
    ? favlistsResult.value.Items
    : [];
  const collectionItems: UserContentItem[] = isSettled(collectionsResult)
    ? collectionsResult.value.Items
    : [];

  const contentKinds: Record<string, number> = {};
  let likesReceived = 0;
  for (const item of contentItems) {
    contentKinds[item.ContentType] = (contentKinds[item.ContentType] ?? 0) + 1;
    likesReceived += item.LikeCount;
  }

  const publicFavlists = favlistItems
    .filter((favlist) => favlist.IsPublic !== false)
    .slice(0, TOP_FAVLIST_COUNT)
    .map((favlist) => ({
      title: favlist.Title,
      description: favlist.Description,
      isPublic: favlist.IsPublic,
    }));

  const followees = [...followeeItems]
    .sort((a, b) => b.FollowerCount - a.FollowerCount)
    .slice(0, TOP_FOLLOWEE_COUNT)
    .map((item) => ({
      name: item.Fullname,
      headline: item.Headline,
      followerCount: item.FollowerCount,
    }));

  const topContents = [...contentItems]
    .sort((a, b) => b.LikeCount - a.LikeCount)
    .slice(0, TOP_CONTENT_COUNT);

  const recentCollections = collectionItems.slice(0, TOP_COLLECTION_COUNT);

  const corpus: ScoredText[] = [];
  for (const favlist of publicFavlists) {
    corpus.push({ text: favlist.title, weight: 3 });
    if (favlist.description) corpus.push({ text: favlist.description, weight: 1 });
  }
  for (const item of contentItems) {
    corpus.push({ text: item.Title, weight: 2 });
    if (item.Summary) corpus.push({ text: item.Summary, weight: 1 });
  }
  for (const item of collectionItems) {
    corpus.push({ text: item.Title, weight: 2 });
    if (item.Summary) corpus.push({ text: item.Summary, weight: 1 });
  }
  for (const item of followeeItems) {
    if (item.Headline) corpus.push({ text: item.Headline, weight: 1 });
  }

  return {
    generatedAt: new Date().toISOString(),
    stats: {
      contents: isSettled(contentsResult) ? contentsResult.value.Paging.Totals : 0,
      followees: isSettled(followeesResult) ? followeesResult.value.Paging.Totals : 0,
      favlists: favlistItems.length,
      collections: collectionItems.length,
      likesReceived,
      contentKinds,
    },
    keywords: extractKeywords(corpus),
    topContents,
    favlists: publicFavlists,
    followees,
    recentCollections,
    warnings,
  };
}
