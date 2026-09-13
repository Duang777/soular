const PORTRAIT_TIMEOUT_MS = 20_000;
const MAX_KEYWORDS = 6;

export interface ZhihuPortraitKeyword {
  word: string;
  score: number;
}

export interface ZhihuPortraitStats {
  contents: number;
  followees: number;
  favlists: number;
  collections: number;
  likesReceived: number;
  contentKinds: Record<string, number>;
}

export interface ZhihuPortrait {
  generatedAt: string;
  stats: ZhihuPortraitStats;
  keywords: ZhihuPortraitKeyword[];
  partial: boolean;
}

export interface NebulaPortraitSignal {
  keywords: ZhihuPortraitKeyword[];
  evidenceCount: number;
  partial: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

function parsePortrait(value: unknown): ZhihuPortrait | null {
  if (!isRecord(value) || !isRecord(value.stats) || !Array.isArray(value.keywords)) {
    return null;
  }

  const contentKinds: Record<string, number> = {};
  if (isRecord(value.stats.contentKinds)) {
    for (const [kind, count] of Object.entries(value.stats.contentKinds)) {
      if (kind && kind.length <= 32) contentKinds[kind] = safeCount(count);
    }
  }

  const keywords: ZhihuPortraitKeyword[] = [];
  for (const item of value.keywords) {
    if (!isRecord(item) || typeof item.word !== "string") continue;
    const word = item.word.trim();
    if (!word || word.length > 24 || keywords.some((entry) => entry.word === word)) continue;
    keywords.push({
      word,
      score: typeof item.score === "number" && Number.isFinite(item.score)
        ? Math.max(0, item.score)
        : 0,
    });
    if (keywords.length >= MAX_KEYWORDS) break;
  }

  return {
    generatedAt: typeof value.generatedAt === "string" ? value.generatedAt : "",
    stats: {
      contents: safeCount(value.stats.contents),
      followees: safeCount(value.stats.followees),
      favlists: safeCount(value.stats.favlists),
      collections: safeCount(value.stats.collections),
      likesReceived: safeCount(value.stats.likesReceived),
      contentKinds,
    },
    keywords,
    partial: Array.isArray(value.warnings) && value.warnings.length > 0,
  };
}

export async function fetchZhihuPortrait(signal?: AbortSignal): Promise<ZhihuPortrait> {
  const controller = new AbortController();
  const abortFromParent = () => controller.abort();
  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener("abort", abortFromParent, { once: true });
  }
  const timeout = window.setTimeout(() => controller.abort(), PORTRAIT_TIMEOUT_MS);

  try {
    const response = await fetch("/api/me/portrait", {
      credentials: "include",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const payload: unknown = await response.json();
    if (!response.ok || !isRecord(payload) || payload.ok !== true) {
      throw new Error("portrait unavailable");
    }
    const portrait = parsePortrait(payload.data);
    if (!portrait) throw new Error("invalid portrait");
    return portrait;
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort", abortFromParent);
  }
}

export function toNebulaPortraitSignal(
  portrait: ZhihuPortrait,
): NebulaPortraitSignal {
  return {
    keywords: portrait.keywords,
    evidenceCount:
      portrait.stats.contents +
      portrait.stats.followees +
      portrait.stats.favlists +
      portrait.stats.collections,
    partial: portrait.partial,
  };
}
