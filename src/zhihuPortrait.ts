const PORTRAIT_TIMEOUT_MS = 20_000;
const PROFILE_TIMEOUT_MS = 7_000;
const MAX_KEYWORDS = 6;
let activeAccountVersion: string | null = null;

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
  accountVersion: string | null;
  generatedAt: string;
  stats: ZhihuPortraitStats;
  keywords: ZhihuPortraitKeyword[];
  partial: boolean;
}

export interface ZhihuPublicProfile {
  name: string | null;
  avatarUrl: string | null;
}

export interface ZhihuAccountStatus {
  authorized: boolean;
  accountVersion: string | null;
}

export function setActiveZhihuAccountVersion(value: unknown): void {
  activeAccountVersion =
    typeof value === "string" && /^[a-f0-9]{16}$/.test(value)
      ? value
      : null;
}

export function getActiveZhihuAccountVersion(): string | null {
  return activeAccountVersion;
}

export async function fetchZhihuAccountStatus(
  signal?: AbortSignal,
): Promise<ZhihuAccountStatus> {
  const controller = new AbortController();
  const abortFromParent = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", abortFromParent, { once: true });
  const timeout = window.setTimeout(() => controller.abort(), PROFILE_TIMEOUT_MS);

  try {
    const response = await fetch("/api/oauth/status", {
      credentials: "include",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const payload: unknown = await response.json();
    if (!response.ok || !isRecord(payload) || payload.ok !== true) {
      throw new Error("account status unavailable");
    }
    const accountVersion =
      typeof payload.accountVersion === "string" &&
      /^[a-f0-9]{16}$/.test(payload.accountVersion)
        ? payload.accountVersion
        : null;
    const authorized = payload.authorized === true && accountVersion !== null;
    return {
      authorized,
      accountVersion: authorized ? accountVersion : null,
    };
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort", abortFromParent);
  }
}

export async function fetchZhihuPublicProfile(
  expectedAccountVersion: string,
  signal?: AbortSignal,
): Promise<ZhihuPublicProfile | null> {
  const controller = new AbortController();
  const abortFromParent = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", abortFromParent, { once: true });
  const timeout = window.setTimeout(() => controller.abort(), PROFILE_TIMEOUT_MS);

  try {
    const response = await fetch("/api/oauth/profile", {
      credentials: "include",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const payload: unknown = await response.json();
    if (
      !response.ok ||
      !isRecord(payload) ||
      payload.ok !== true ||
      payload.accountVersion !== expectedAccountVersion
    ) {
      throw new Error("profile unavailable");
    }
    if (!isRecord(payload.profile)) return null;
    return {
      name: typeof payload.profile.name === "string"
        ? payload.profile.name
        : null,
      avatarUrl: typeof payload.profile.avatarUrl === "string"
        ? payload.profile.avatarUrl
        : null,
    };
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort", abortFromParent);
  }
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
    accountVersion: null,
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
    return {
      ...portrait,
      accountVersion:
        typeof payload.accountVersion === "string" &&
        /^[a-f0-9]{16}$/.test(payload.accountVersion)
          ? payload.accountVersion
          : null,
    };
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
