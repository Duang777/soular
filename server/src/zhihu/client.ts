import type {
  ChatMessage,
  CollectionContentData,
  FavlistListData,
  FolloweeListData,
  GlobalSearchData,
  HotListItem,
  HotListData,
  QuestionAnswersData,
  UserContentData,
  ZhiDaModel,
  ZhiDaResponse,
  ZhihuEnvelope,
} from "../types.js";
import type { AsyncCache } from "../core/storage.js";

const DATA_BASE = "https://developer.zhihu.com";
const REQUEST_TIMEOUT_MS = 30_000;
const AI_TIMEOUT_MS = 45_000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const RATE_LIMIT_RETRIES = 2;
const RATE_LIMIT_BACKOFF_MS = 700;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const HOT_LIST_TTL_SECONDS = 6 * 60 * 60;
const HOT_LIST_LIMIT = 30;
const SEARCH_TTL_SECONDS = 5 * 60;
const QUESTION_ANSWERS_TTL_SECONDS = 10 * 60;

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

async function readResponseText(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new ZhihuApiError(90001, "知乎上游响应超过大小限制");
  }
  if (!response.body) return response.text();

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_RESPONSE_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new ZhihuApiError(90001, "知乎上游响应超过大小限制");
    }
    chunks.push(decoder.decode(value, { stream: true }));
  }
  chunks.push(decoder.decode());
  return chunks.join("");
}

function normalizeHotListData(value: unknown, limit: number): HotListData {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const rawItems = Array.isArray(record.Items) ? record.Items.slice(0, 30) : [];
  const items: HotListItem[] = [];
  for (const rawItem of rawItems) {
    if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) continue;
    const item = rawItem as Record<string, unknown>;
    if (typeof item.Title !== "string" || typeof item.Url !== "string") continue;
    items.push({
      Title: item.Title,
      Url: item.Url,
      ThumbnailUrl: typeof item.ThumbnailUrl === "string" ? item.ThumbnailUrl : "",
      Summary: typeof item.Summary === "string" ? item.Summary : "",
    });
    if (items.length >= limit) break;
  }
  const total = typeof record.Total === "number" && Number.isFinite(record.Total)
    ? Math.max(0, record.Total)
    : items.length;
  return { Total: total, Items: items };
}

export class ZhihuClient {
  private readonly inflight = new Map<string, Promise<unknown>>();

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

      const raw = await readResponseText(response);
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
        envelopeCode === 30002 ||
        /second limit exceeded|rate limit|频率/i.test(envelopeMessage);
      const secondLimited = /second limit exceeded/i.test(envelopeMessage);

      if (rateLimited && secondLimited && method === "GET" && attempt < RATE_LIMIT_RETRIES) {
        await sleep(RATE_LIMIT_BACKOFF_MS * 2 ** attempt);
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
    const existing = this.inflight.get(key) as Promise<T> | undefined;
    if (existing) return existing;

    const pending = (async () => {
      const stale = this.cache ? (await this.cache.get<T>(key)) ?? null : null;
      if (stale && stale.ageMs <= ttlSeconds * 1000) return stale.value;
      try {
        const value = await load();
        await this.cache?.set(key, value, ttlSeconds);
        return value;
      } catch (error) {
        if (stale) return stale.value;
        throw error;
      }
    })().finally(() => {
      this.inflight.delete(key);
    });
    this.inflight.set(key, pending);
    return pending;
  }

  private queryKey(pathname: string, query: Query): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") params.set(key, String(value));
    }
    return `${pathname}?${params.toString()}`;
  }

  async hotList(limit = HOT_LIST_LIMIT): Promise<HotListData> {
    const normalizedLimit = clamp(limit, 1, HOT_LIST_LIMIT, HOT_LIST_LIMIT);
    const query: Query = { Limit: HOT_LIST_LIMIT };
    const result = await this.cached(
      this.queryKey("/api/v1/content/hot_list", query),
      HOT_LIST_TTL_SECONDS,
      async () => normalizeHotListData(
        await this.envelope<HotListData>("/api/v1/content/hot_list", query),
        HOT_LIST_LIMIT,
      ),
    );
    return { ...result, Items: result.Items.slice(0, normalizedLimit) };
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

  questionAnswers(
    questionUrl: string,
    options: { offset?: string | number; limit?: number } = {},
  ): Promise<QuestionAnswersData> {
    const trimmedUrl = questionUrl.trim();
    if (!trimmedUrl) throw new ZhihuApiError(10001, "问题链接 QuestionUrl 不能为空");
    const offset = String(options.offset ?? "0").trim();
    if (!/^\d+$/.test(offset)) {
      throw new ZhihuApiError(10001, "分页偏移 Offset 必须是非负整数");
    }
    const query: Query = {
      QuestionUrl: trimmedUrl,
      Offset: offset,
      Limit: clamp(options.limit ?? 20, 1, 50, 20),
    };
    return this.cached(
      this.queryKey("/api/v1/content/question_answers", query),
      QUESTION_ANSWERS_TTL_SECONDS,
      () => this.envelope<QuestionAnswersData>("/api/v1/content/question_answers", query),
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
