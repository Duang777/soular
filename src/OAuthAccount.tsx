import { useCallback, useEffect, useState } from "react";
import {
  fetchZhihuPortrait,
  type ZhihuPortrait,
} from "./zhihuPortrait";
import { clearSelfProfileContexts } from "./people";

const OFFICIAL_ORIGIN = "https://soular.top";
const REQUEST_TIMEOUT_MS = 8_000;

interface OAuthProfile {
  name: string | null;
  avatarUrl: string | null;
}

interface OAuthStatus {
  configured: boolean;
  authorized: boolean;
  stateVerified: boolean | null;
  profile: OAuthProfile | null;
  error: { code: string; message: string } | null;
}

function safeAvatarUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      /(^|\.)zhimg\.com$/i.test(url.hostname)
      ? url.href
      : null;
  } catch {
    return null;
  }
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

export function OAuthAccount() {
  const isOfficialOrigin = window.location.origin === OFFICIAL_ORIGIN;
  const [status, setStatus] = useState<OAuthStatus | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [logoutFailed, setLogoutFailed] = useState(false);
  const [portrait, setPortrait] = useState<ZhihuPortrait | null>(null);
  const [portraitState, setPortraitState] = useState<"idle" | "loading" | "unavailable">("idle");
  const [callbackFailed, setCallbackFailed] = useState(
    () => new URLSearchParams(window.location.search).get("oauth") === "error",
  );

  const loadStatus = useCallback(async (signal?: AbortSignal) => {
    if (!isOfficialOrigin) return;
    try {
      const response = await fetchWithTimeout("/api/oauth/status", {
        credentials: "include",
        headers: { Accept: "application/json" },
        signal,
      });
      const payload: unknown = await response.json();
      if (
        !response.ok ||
        !payload ||
        typeof payload !== "object" ||
        !("ok" in payload) ||
        payload.ok !== true
      ) {
        throw new Error("OAuth status unavailable");
      }
      const value = payload as Record<string, unknown>;
      if (value.authorized !== true) clearSelfProfileContexts();
      const profileValue =
        value.profile && typeof value.profile === "object"
          ? (value.profile as Record<string, unknown>)
          : null;
      const errorValue =
        value.error && typeof value.error === "object"
          ? (value.error as Record<string, unknown>)
          : null;
      setStatus({
        configured: value.configured === true,
        authorized: value.authorized === true,
        stateVerified:
          typeof value.stateVerified === "boolean" ? value.stateVerified : null,
        profile: profileValue
          ? {
              name: typeof profileValue.name === "string" ? profileValue.name : null,
              avatarUrl:
                typeof profileValue.avatarUrl === "string" ? profileValue.avatarUrl : null,
            }
          : null,
        error:
          errorValue &&
          typeof errorValue.code === "string" &&
          typeof errorValue.message === "string"
            ? { code: errorValue.code, message: errorValue.message }
            : null,
      });
      setUnavailable(false);
      setLogoutFailed(false);
    } catch (error) {
      if (signal?.aborted) return;
      setUnavailable(true);
    }
  }, [isOfficialOrigin]);

  useEffect(() => {
    if (!isOfficialOrigin) return undefined;
    const controller = new AbortController();
    void loadStatus(controller.signal);
    return () => controller.abort();
  }, [isOfficialOrigin, loadStatus]);

  useEffect(() => {
    if (!isOfficialOrigin || status?.authorized !== true) {
      setPortrait(null);
      setPortraitState("idle");
      return undefined;
    }

    const controller = new AbortController();
    setPortraitState("loading");
    void fetchZhihuPortrait(controller.signal)
      .then((value) => {
        setPortrait(value);
        setPortraitState("idle");
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setPortrait(null);
        setPortraitState("unavailable");
      });
    return () => controller.abort();
  }, [isOfficialOrigin, status?.authorized]);

  async function logout() {
    setBusy(true);
    setLogoutFailed(false);
    try {
      const response = await fetchWithTimeout("/api/oauth/logout", {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("OAuth logout failed");
      setStatus({
        configured: true,
        authorized: false,
        stateVerified: null,
        profile: null,
        error: null,
      });
      setPortrait(null);
      setPortraitState("idle");
      clearSelfProfileContexts();
      setUnavailable(false);
      setCallbackFailed(false);
    } catch {
      setLogoutFailed(true);
    } finally {
      setBusy(false);
    }
  }

  if (!isOfficialOrigin) {
    return (
      <a className="oauth-account oauth-account--action" href={`${OFFICIAL_ORIGIN}/api/oauth/start`}>
        知乎登录
      </a>
    );
  }

  if (unavailable) {
    return (
      <button
        className="oauth-account oauth-account--action"
        type="button"
        onClick={() => void loadStatus()}
      >
        重新连接
      </button>
    );
  }

  if (!status) {
    return (
      <div className="oauth-account oauth-account--status" role="status" aria-live="polite">
        正在检查账号
      </div>
    );
  }

  if (!status.authorized) {
    const loginFailed = callbackFailed || Boolean(status.error);
    if (!status.configured) {
      return (
        <div className="oauth-account oauth-account--status" role="status">
          登录配置中
        </div>
      );
    }
    return (
      <a
        className="oauth-account oauth-account--action"
        href="/api/oauth/start"
        aria-label={loginFailed ? "知乎登录未完成，重新连接" : "使用知乎账号登录"}
      >
        {loginFailed ? "重新登录" : "知乎登录"}
      </a>
    );
  }

  const avatarUrl = safeAvatarUrl(status.profile?.avatarUrl);
  const isTemporaryConnection = status.stateVerified === false;
  const loginFailed = callbackFailed || Boolean(status.error);
  const connectionWarning = logoutFailed
    ? "退出失败"
    : loginFailed
      ? "重登失败"
    : isTemporaryConnection
      ? "仅适合临时联调"
      : null;
  const connectionLabel = logoutFailed
    ? "知乎退出失败，原账号仍连接"
    : loginFailed
      ? "知乎重新登录未完成，原账号仍连接"
    : isTemporaryConnection
      ? "知乎账号已连接，仅适合临时联调"
      : "知乎账号已连接";
  const portraitWords = portrait?.keywords
    .slice(0, 2)
    .map(({ word }) => Array.from(word).slice(0, 8).join("")) ?? [];
  const portraitDetail = portraitState === "loading"
    ? "正在同步兴趣画像"
    : portraitWords.length
      ? "兴趣画像已校准"
      : portraitState === "unavailable"
        ? "兴趣画像暂不可用"
        : null;
  return (
    <div
      className="oauth-account oauth-account--connected"
      aria-label={`${connectionLabel}${portraitWords.length ? `，兴趣底色 ${portraitWords.join("、")}` : ""}`}
    >
      {avatarUrl ? (
        <img className="oauth-account__avatar" src={avatarUrl} alt="" />
      ) : (
        <span className="oauth-account__dot" aria-hidden="true" />
      )}
      <span className="oauth-account__name">
        <span>{status.profile?.name || "已连接知乎"}</span>
        {connectionWarning || portraitDetail ? (
          <small className={connectionWarning ? "oauth-account__warning" : "oauth-account__portrait"}>
            {connectionWarning ?? portraitDetail}
            {!connectionWarning && portraitWords.length > 0 ? (
              <span className="oauth-account__portrait-words">
                {` · ${portraitWords.join(" / ")}`}
              </span>
            ) : null}
          </small>
        ) : null}
      </span>
      <button
        className="oauth-account__logout"
        type="button"
        disabled={busy}
        onClick={() => void logout()}
      >
        {busy ? "处理中" : logoutFailed ? "重试退出" : "退出"}
      </button>
    </div>
  );
}
