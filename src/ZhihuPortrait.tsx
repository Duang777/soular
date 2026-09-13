import { useCallback, useEffect, useState } from "react";

const OFFICIAL_ORIGIN = "https://soular.top";
const REQUEST_TIMEOUT_MS = 8_000;

interface PortraitKeyword {
  word: string;
  score: number;
}

interface PortraitData {
  generatedAt: string;
  stats: {
    contents: number;
    followees: number;
    favlists: number;
    collections: number;
  };
  keywords: PortraitKeyword[];
  warnings: string[];
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const abortFromParent = () => controller.abort();
  if (init.signal?.aborted) {
    controller.abort();
  } else {
    init.signal?.addEventListener("abort", abortFromParent, { once: true });
  }
  const timeout = window.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
    init.signal?.removeEventListener("abort", abortFromParent);
  }
}

export function ZhihuPortrait({ embedded = false }: { embedded?: boolean }) {
  const isOfficialOrigin = window.location.origin === OFFICIAL_ORIGIN;
  const [portrait, setPortrait] = useState<PortraitData | null>(null);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const loadPortrait = useCallback(async (signal?: AbortSignal) => {
    if (!isOfficialOrigin) return;
    setLoading(true);
    setUnavailable(false);
    try {
      const response = await fetchWithTimeout("/api/me/portrait", {
        credentials: "include",
        headers: { Accept: "application/json" },
        signal,
      });
      const payload: unknown = await response.json();
      if (response.status === 401) {
        setPortrait(null);
        return;
      }
      if (
        !response.ok ||
        !payload ||
        typeof payload !== "object" ||
        !("ok" in payload) ||
        payload.ok !== true
      ) {
        throw new Error("Portrait unavailable");
      }
      const value = payload as Record<string, unknown>;
      const data = value.data && typeof value.data === "object"
        ? value.data as Record<string, unknown>
        : null;
      if (!data) throw new Error("Portrait unavailable");
      const stats = data.stats && typeof data.stats === "object"
        ? data.stats as Record<string, unknown>
        : {};
      const keywords = Array.isArray(data.keywords)
        ? data.keywords
            .filter((item): item is PortraitKeyword =>
              Boolean(item) &&
              typeof item === "object" &&
              typeof (item as PortraitKeyword).word === "string" &&
              typeof (item as PortraitKeyword).score === "number"
            )
            .slice(0, 8)
        : [];
      setPortrait({
        generatedAt: typeof data.generatedAt === "string" ? data.generatedAt : "",
        stats: {
          contents: typeof stats.contents === "number" ? stats.contents : 0,
          followees: typeof stats.followees === "number" ? stats.followees : 0,
          favlists: typeof stats.favlists === "number" ? stats.favlists : 0,
          collections: typeof stats.collections === "number" ? stats.collections : 0,
        },
        keywords,
        warnings: Array.isArray(data.warnings)
          ? data.warnings.filter((item): item is string => typeof item === "string")
          : [],
      });
    } catch (error) {
      if (signal?.aborted) return;
      setPortrait(null);
      setUnavailable(true);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [isOfficialOrigin]);

  useEffect(() => {
    if (!isOfficialOrigin) return undefined;
    const controller = new AbortController();
    void loadPortrait(controller.signal);
    return () => controller.abort();
  }, [isOfficialOrigin, loadPortrait]);

  if (!isOfficialOrigin || (!loading && !portrait && !unavailable)) {
    return null;
  }

  return (
    <section
      className={`zhihu-portrait${embedded ? " zhihu-portrait--embedded" : ""}`}
      aria-label="知乎兴趣画像"
      aria-live="polite"
    >
      <div className="zhihu-portrait__head">
        <b>知乎兴趣画像</b>
        <small>来自你的公开创作与收藏，仅供本次探索参考</small>
      </div>
      {loading ? (
        <p className="zhihu-portrait__status">正在整理画像…</p>
      ) : unavailable ? (
        <button
          className="zhihu-portrait__retry"
          type="button"
          onClick={() => void loadPortrait()}
        >
          画像暂不可用，点击重试
        </button>
      ) : portrait ? (
        <>
          <p className="zhihu-portrait__stats">
            创作 {portrait.stats.contents} · 关注 {portrait.stats.followees} · 收藏夹 {portrait.stats.favlists} · 近期收藏 {portrait.stats.collections}
          </p>
          {portrait.keywords.length ? (
            <div className="zhihu-portrait__tags">
              {portrait.keywords.map((keyword) => (
                <span key={keyword.word} className="zhihu-portrait__tag">
                  {keyword.word}
                </span>
              ))}
            </div>
          ) : (
            <p className="zhihu-portrait__status">暂时还没有足够的关键词</p>
          )}
          {portrait.warnings.length ? (
            <p className="zhihu-portrait__warning">
              部分数据源暂不可用，已展示可用部分。
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
