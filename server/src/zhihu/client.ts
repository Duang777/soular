import type {
  ChatMessage,
  CollectionContentData,
  FavlistListData,
  FolloweeListData,
  GlobalSearchData,
  HotListData,
  UserContentData,
  ZhiDaModel,
  ZhiDaResponse,
  ZhihuEnvelope,
  ZhihuSearchData,
} from "../types.js";
import type { AsyncCache } from "../core/storage.js";

const DATA_BASE = "https://developer.zhihu.com";
const REQUEST_TIMEOUT_MS = 30_000;
const AI_TIMEOUT_MS = 45_000;
const RATE_LIMIT_RETRIES = 2;
const RATE_LIMIT_BACKOFF_MS = 700;
const LONG_RATE_LIMIT_BACKOFF_MS = 2500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const HOT_LIST_TTL_SECONDS = 10 * 60;
const SEARCH_TTL_SECONDS = 5 * 60;

export class ZhihuApiError extends Error {
  code: number | string;
  constructor(code: number | string, message: string) {
    super(message);
    this.name = "ZhihuApiError";
    this.code = code;
  }
}

type Query = Record<string, string | number | undefined>;

function clamp(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

export class ZhihuClient {
  constructor(
    private readonly accessSecret: string,
    private readonly cache: AsyncCache | null = null,
  ) {
    if (!accessSecret) throw new Error("ZhihuClient 需要 Access Secret");
  }

  private buildHeaders(oauthToken?: string): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessSecret}`,
      "X-Request-Timestamp": String(Math.floor(Date.now() / 1000)),
      "Content-Type": "application/json",
    };
    if (oauthToken) headers["X-OAuth-Token"] = oauthToken;
    return headers;
  }

  private async requestJson<T>(
    method: "GET" | "POST",
    pathname: string,
    query?: Query,
    body?: unknown,
    oauthToken?: string,
    timeoutMs: number = REQUEST_TIMEOUT_MS,
  ): Promise<T> {
    const url = new URL(pathname, DATA_BASE);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
      }
    }

    for (let attempt = 0; attempt <= RATE_LIMIT_RETRIES; attempt += 1) {
      const response = await fetch(url, {
        method,
        headers: this.buildHeaders(oauthToken),
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });

      const raw = await response.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new ZhihuApiError(response.status, `非 JSON 响应 (HTTP ${response.status})`);
      }

      const record = (parsed ?? {}) as Record<string, unknown>;
      const envelopeCode = typeof record.Code === "number" ? record.Code : null;
      const envelopeMessage =
        typeof record.Message === "string" ? record.Message : "";
      const rateLimited =
        response.status === 429 ||
        envelopeCode === 30001 ||
        /second limit exceeded|rate limit|频率/i.test(envelopeMessage);

      if (rateLimited && method === "GET" && attempt < RATE_LIMIT_RETRIES) {
        const base = /second limit/i.test(envelopeMessage)
          ? RATE_LIMIT_BACKOFF_MS
          : LONG_RATE_LIMIT_BACKOFF_MS;
        await sleep(base * 2 ** attempt);
        continue;
      }

      if (envelopeCode !== null && envelopeCode !== 0) {
        throw new ZhihuApiError(envelopeCode, envelopeMessage || "知乎接口业务错误");
      }

      if (!response.ok) {
        const error = record.error as Record<string, unknown> | undefined;
        const message =
          (typeof error?.message === "string" && error.message) ||
          envelopeMessage ||
          `请求失败 (HTTP ${response.status})`;
        const code =
          (error?.code as string) ?? envelopeCode ?? response.status;
        throw new ZhihuApiError(code, message);
      }

      return parsed as T;
    }

    throw new ZhihuApiError(30001, "请求过于频繁，退避重试后仍被限流");
  }

  private async envelope<T>(
    pathname: string,
    query: Query,
    oauthToken?: string,
  ): Promise<T> {
    const envelope = await this.requestJson<ZhihuEnvelope<T>>(
      "GET",
      pathname,
      query,
      undefined,
      oauthToken,
    );
    if (envelope.Code !== 0) {
      throw new ZhihuApiError(envelope.Code, envelope.Message ?? "知乎接口返回错误");
    }
    return envelope.Data;
  }

  private async cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
    if (!this.cache) return load();

    const stale = (await this.cache.get<T>(key)) ?? null;
    if (stale && stale.ageMs <= ttlSeconds * 1000) return stale.value;

    try {
      const value = await load();
      await this.cache.set(key, value, ttlSeconds);
      return value;
    } catch (error) {
      if (stale) return stale.value;
      throw error;
    }
  }

  private queryKey(pathname: string, query: Query): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") params.set(key, String(value));
    }
    return `${pathname}?${params.toString()}`;
  }

  hotList(limit = 30): Promise<HotListData> {
    const query: Query = { Limit: clamp(limit, 1, 30, 30) };
    return this.cached(this.queryKey("/api/v1/content/hot_list", query), HOT_LIST_TTL_SECONDS, () =>
      this.envelope<HotListData>("/api/v1/content/hot_list", query),
    );
  }

  zhihuSearch(query: string, count = 10): Promise<ZhihuSearchData> {
    const trimmed = query.trim();
    if (!trimmed) throw new ZhihuApiError(10001, "搜索关键词 Query 不能为空");
    const params: Query = { Query: trimmed, Count: clamp(count, 1, 10, 10) };
    return this.cached(this.queryKey("/api/v1/content/zhihu_search", params), SEARCH_TTL_SECONDS, () =>
      this.envelope<ZhihuSearchData>("/api/v1/content/zhihu_search", params),
    );
  }

  globalSearch(
    query: string,
    count = 10,
    filter?: string,
    searchDb: "all" | "realtime" | "static" = "all",
  ): Promise<GlobalSearchData> {
    const trimmed = query.trim();
    if (!trimmed) throw new ZhihuApiError(10001, "搜索关键词 Query 不能为空");
    const params: Query = {
      Query: trimmed,
      Count: clamp(count, 1, 20, 10),
      Filter: filter,
      SearchDB: searchDb,
    };
    return this.cached(this.queryKey("/api/v1/content/global_search", params), SEARCH_TTL_SECONDS, () =>
      this.envelope<GlobalSearchData>("/api/v1/content/global_search", params),
    );
  }

  userContents(
    oauthToken: string,
    options: { contentType?: string; offset?: string; limit?: number; sortField?: string } = {},
  ): Promise<UserContentData> {
    return this.envelope<UserContentData>(
      "/api/v1/user/contents",
      {
        ContentType: options.contentType ?? "all",
        Offset: options.offset ?? "0",
        Limit: clamp(options.limit ?? 20, 1, 50, 20),
        SortField: options.sortField ?? "ts",
        SortOrder: "desc",
      },
      oauthToken,
    );
  }

  userFollowees(
    oauthToken: string,
    options: { offset?: string; limit?: number } = {},
  ): Promise<FolloweeListData> {
    return this.envelope<FolloweeListData>(
      "/api/v1/user/followees",
      { Offset: options.offset ?? "0", Limit: clamp(options.limit ?? 20, 1, 50, 20) },
      oauthToken,
    );
  }

  userFavlists(oauthToken: string, limit = 20): Promise<FavlistListData> {
    return this.envelope<FavlistListData>(
      "/api/v1/user/favlists",
      { Limit: clamp(limit, 1, 50, 20) },
      oauthToken,
    );
  }

  userFavlistContents(
    oauthToken: string,
    favlistUrlToken: string | number,
    options: { offset?: string; limit?: number } = {},
  ): Promise<CollectionContentData> {
    return this.envelope<CollectionContentData>(
      "/api/v1/user/favlist_contents",
      {
        FavlistUrlToken: String(favlistUrlToken),
        Offset: options.offset ?? "0",
        Limit: clamp(options.limit ?? 20, 1, 50, 20),
      },
      oauthToken,
    );
  }

  userCollections(oauthToken: string, limit = 20): Promise<CollectionContentData> {
    return this.envelope<CollectionContentData>(
      "/api/v1/user/collections",
      { Limit: clamp(limit, 1, 50, 20) },
      oauthToken,
    );
  }

  async zhiDa(
    messages: ChatMessage[],
    model: ZhiDaModel = "zhida-fast-1p5",
  ): Promise<ZhiDaResponse> {
    if (!messages.length) throw new ZhihuApiError(10001, "messages 不能为空");
    return this.requestJson(
      "POST",
      "/v1/chat/completions",
      undefined,
      { model, messages, stream: false },
      undefined,
      AI_TIMEOUT_MS,
    );
  }

  async zhiDaText(messages: ChatMessage[], model: ZhiDaModel = "zhida-fast-1p5"): Promise<string> {
    const response = await this.zhiDa(messages, model);
    const content = response.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new ZhihuApiError(90001, "直答模型未返回有效内容");
    }
    return content;
  }
}
