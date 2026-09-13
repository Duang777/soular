import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { asset } from "./cast";
import {
  fetchZhihuPortrait,
  fetchZhihuPublicProfile,
  getActiveZhihuAccountVersion,
  setActiveZhihuAccountVersion,
  type ZhihuPortrait,
} from "./zhihuPortrait";
import { clearSelfProfileContexts } from "./people";

const OFFICIAL_ORIGIN = "https://soular.top";
const REQUEST_TIMEOUT_MS = 8_000;
const DEFAULT_NEBULA_PRESET = "ai-math";

interface OAuthProfile {
  name: string | null;
  avatarUrl: string | null;
}

interface OAuthStatus {
  configured: boolean;
  authorized: boolean;
  accountVersion: string | null;
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

function formatSignalCount(value: number): string {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(value);
}

function PortraitCalibration({
  open,
  portrait,
  state,
  onClose,
  onRetry,
  onExplore,
}: {
  open: boolean;
  portrait: ZhihuPortrait | null;
  state: "idle" | "loading" | "unavailable";
  onClose: () => void;
  onRetry: () => void;
  onExplore: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return;
    if (!dialog.open) dialog.showModal();
    const close = () => onClose();
    dialog.addEventListener("close", close);
    return () => {
      dialog.removeEventListener("close", close);
    };
  }, [onClose, open]);

  if (!open) return null;

  const ready = Boolean(portrait);
  const loading = state === "loading" || (state === "idle" && !portrait);
  const unavailable = state === "unavailable";
  const signalRows = portrait
    ? [
        ["创作", portrait.stats.contents],
        ["关注", portrait.stats.followees],
        ["收藏夹", portrait.stats.favlists],
        ["近期收藏", portrait.stats.collections],
      ] as const
    : [];
  const maxKeywordScore = Math.max(
    1,
    ...(portrait?.keywords.map(({ score }) => score) ?? []),
  );

  return (
    <dialog
      ref={dialogRef}
      className="portrait-calibration"
      aria-labelledby="portrait-calibration-title"
      aria-describedby="portrait-calibration-description"
      aria-busy={loading}
      data-state={ready ? "ready" : unavailable ? "unavailable" : "loading"}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const outside =
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom;
        if (outside) onClose();
      }}
    >
      <button
        type="button"
        className="portrait-calibration__close"
        aria-label="关闭兴趣星谱"
        onClick={onClose}
      >
        ×
      </button>

      <header className="portrait-calibration__header">
        <p className="portrait-calibration__kicker">知乎公开兴趣 · ZHIHU SIGNAL</p>
        <h2 id="portrait-calibration-title">
          {loading
            ? "刘看山正在校准你的兴趣星谱"
            : unavailable
              ? "兴趣星谱暂时无法校准"
              : "你的知乎兴趣星谱"}
        </h2>
        <p id="portrait-calibration-description">
          {loading
            ? "正在汇总公开创作、关注和收藏信号，完成后再呈现结果。"
            : unavailable
              ? "本次没有取得可用画像，你仍可继续使用人格卡和观点星云。"
              : "公开足迹化为兴趣坐标，帮助星云寻找与你同频或互补的观点。"}
        </p>
      </header>

      <div className="portrait-calibration__instrument" aria-hidden="true">
        <i className="portrait-calibration__orbit portrait-calibration__orbit--outer" />
        <i className="portrait-calibration__orbit portrait-calibration__orbit--inner" />
        <i className="portrait-calibration__beam" />
        <img
          src={asset(ready ? "kanshan/wave.gif" : "kanshan/hi.gif")}
          width="320"
          height="320"
          alt=""
        />
      </div>

      {loading ? (
        <div className="portrait-calibration__waiting" role="status" aria-live="polite">
          <span />
          <b>正在读取公开信号</b>
          <small>接口返回前不显示推测结果</small>
        </div>
      ) : null}

      {ready && portrait ? (
        <div className="portrait-calibration__results">
          <section className="portrait-calibration__register" aria-labelledby="portrait-sources-title">
            <div className="portrait-calibration__section-heading">
              <span id="portrait-sources-title">公开信号概况</span>
              <small>{portrait.partial ? "部分来源可用" : "校准完成"}</small>
            </div>
            <dl>
              {signalRows.map(([label, count]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{formatSignalCount(count)}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="portrait-calibration__spectrum" aria-labelledby="portrait-spectrum-title">
            <div className="portrait-calibration__section-heading">
              <span id="portrait-spectrum-title">兴趣星谱</span>
              <small>按公开信号相对强度排序</small>
            </div>
            {portrait.keywords.length ? (
              <ol>
                {portrait.keywords.map(({ word, score }, index) => (
                  <li key={word}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <b>{word}</b>
                    <i aria-hidden="true">
                      <span style={{ width: `${Math.max(14, score / maxKeywordScore * 100)}%` }} />
                    </i>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="portrait-calibration__empty">
                当前公开信号不足，暂不生成兴趣关键词。
              </p>
            )}
          </section>

          {portrait.partial ? (
            <p className="portrait-calibration__partial">
              部分公开来源暂不可用，星谱仅使用成功返回的数据。
            </p>
          ) : null}
        </div>
      ) : null}

      <footer className="portrait-calibration__footer">
        <p>
          <span aria-hidden="true" />
          仅汇总公开信息，原始收藏与关注明细不会进入星云。
        </p>
        {unavailable ? (
          <button type="button" onClick={onRetry}>
            重新校准
          </button>
        ) : (
          <button type="button" disabled={!ready} onClick={onExplore}>
            {ready ? "带着星谱进入银河" : "正在校准"}
          </button>
        )}
        {ready ? <small>本题人格仍由你在当前银河中的表态生成。</small> : null}
      </footer>
    </dialog>
  );
}

export function OAuthAccount() {
  const navigate = useNavigate();
  const isOfficialOrigin = window.location.origin === OFFICIAL_ORIGIN;
  const oauthResult = new URLSearchParams(window.location.search).get("oauth");
  const [status, setStatus] = useState<OAuthStatus | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [logoutFailed, setLogoutFailed] = useState(false);
  const [portrait, setPortrait] = useState<ZhihuPortrait | null>(null);
  const [portraitState, setPortraitState] = useState<"idle" | "loading" | "unavailable">("idle");
  const [portraitRetry, setPortraitRetry] = useState(0);
  const [calibrationOpen, setCalibrationOpen] = useState(oauthResult === "success");
  const [callbackFailed, setCallbackFailed] = useState(
    () => oauthResult === "error",
  );
  const statusRequestSequenceRef = useRef(0);
  const statusRequestControllerRef = useRef<AbortController | null>(null);
  const activeAccountVersionRef = useRef(getActiveZhihuAccountVersion());
  const logoutInProgressRef = useRef(false);

  const loadStatus = useCallback(async () => {
    if (!isOfficialOrigin || logoutInProgressRef.current) return;
    const sequence = ++statusRequestSequenceRef.current;
    statusRequestControllerRef.current?.abort();
    const controller = new AbortController();
    statusRequestControllerRef.current = controller;
    try {
      const response = await fetchWithTimeout("/api/oauth/status", {
        credentials: "include",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      const payload: unknown = await response.json();
      if (
        controller.signal.aborted ||
        sequence !== statusRequestSequenceRef.current
      ) return;
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
      const accountVersion =
        typeof value.accountVersion === "string" &&
        /^[a-f0-9]{16}$/.test(value.accountVersion)
          ? value.accountVersion
          : null;
      const nextAccountVersion = value.authorized === true
        ? accountVersion
        : null;
      const accountChanged =
        activeAccountVersionRef.current !== nextAccountVersion;
      if (accountChanged) {
        clearSelfProfileContexts();
        setPortrait(null);
        setPortraitState("idle");
      }
      activeAccountVersionRef.current = nextAccountVersion;
      setActiveZhihuAccountVersion(nextAccountVersion);
      const profileValue =
        value.profile && typeof value.profile === "object"
          ? (value.profile as Record<string, unknown>)
          : null;
      const errorValue =
        value.error && typeof value.error === "object"
          ? (value.error as Record<string, unknown>)
          : null;
      const nextStatus: OAuthStatus = {
        configured: value.configured === true,
        authorized: nextAccountVersion !== null,
        accountVersion: nextAccountVersion,
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
      };
      setStatus((current) => {
        if (
          current?.accountVersion &&
          current.accountVersion !== nextStatus.accountVersion
        ) {
          clearSelfProfileContexts();
        }
        if (
          current?.accountVersion &&
          current.accountVersion === nextStatus.accountVersion
        ) {
          return {
            ...nextStatus,
            profile: {
              name: nextStatus.profile?.name ?? current.profile?.name ?? null,
              avatarUrl:
                nextStatus.profile?.avatarUrl ??
                current.profile?.avatarUrl ??
                null,
            },
          };
        }
        return nextStatus;
      });
      setUnavailable(false);
      setLogoutFailed(false);
    } catch (error) {
      if (
        controller.signal.aborted ||
        sequence !== statusRequestSequenceRef.current
      ) return;
      setUnavailable(true);
    } finally {
      if (statusRequestControllerRef.current === controller) {
        statusRequestControllerRef.current = null;
      }
    }
  }, [isOfficialOrigin]);

  useEffect(() => {
    if (!isOfficialOrigin) return undefined;
    let lastRefreshAt = 0;
    const refresh = () => {
      const now = Date.now();
      if (now - lastRefreshAt < 500) return;
      lastRefreshAt = now;
      void loadStatus();
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    refresh();
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      statusRequestSequenceRef.current += 1;
      statusRequestControllerRef.current?.abort();
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [isOfficialOrigin, loadStatus]);

  useEffect(() => {
    if (
      !isOfficialOrigin ||
      status?.authorized !== true ||
      !status.accountVersion ||
      safeAvatarUrl(status.profile?.avatarUrl)
    ) {
      return undefined;
    }

    const controller = new AbortController();
    void fetchZhihuPublicProfile(status.accountVersion, controller.signal)
      .then((profile) => {
        if (!profile) return;
        setStatus((current) =>
          current?.accountVersion === status.accountVersion
            ? {
                ...current,
                profile: {
                  name: profile.name ?? current.profile?.name ?? null,
                  avatarUrl: profile.avatarUrl ?? current.profile?.avatarUrl ?? null,
                },
              }
            : current
        );
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [isOfficialOrigin, status?.accountVersion, status?.authorized, status?.profile?.avatarUrl]);

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
        if (
          !status.accountVersion ||
          value.accountVersion !== status.accountVersion ||
          activeAccountVersionRef.current !== status.accountVersion
        ) {
          throw new Error("portrait account changed");
        }
        setPortrait(value);
        setPortraitState("idle");
      })
      .catch(() => {
        if (
          controller.signal.aborted ||
          activeAccountVersionRef.current !== status.accountVersion
        ) return;
        setPortrait(null);
        setPortraitState("unavailable");
      });
    return () => controller.abort();
  }, [isOfficialOrigin, portraitRetry, status?.accountVersion, status?.authorized]);

  useEffect(() => {
    if (status?.authorized !== true || oauthResult !== "success") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("oauth");
    url.searchParams.delete("reason");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, [oauthResult, status?.authorized]);

  async function logout() {
    logoutInProgressRef.current = true;
    statusRequestSequenceRef.current += 1;
    statusRequestControllerRef.current?.abort();
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
        accountVersion: null,
        stateVerified: null,
        profile: null,
        error: null,
      });
      setPortrait(null);
      setPortraitState("idle");
      setCalibrationOpen(false);
      activeAccountVersionRef.current = null;
      setActiveZhihuAccountVersion(null);
      clearSelfProfileContexts();
      setUnavailable(false);
      setCallbackFailed(false);
    } catch {
      setLogoutFailed(true);
    } finally {
      logoutInProgressRef.current = false;
      setBusy(false);
    }
  }

  const closeCalibration = useCallback(() => {
    setCalibrationOpen(false);
  }, []);
  const retryCalibration = useCallback(() => {
    setPortraitRetry((value) => value + 1);
  }, []);
  const exploreWithPortrait = useCallback(() => {
    setCalibrationOpen(false);
    navigate(`/?preset=${DEFAULT_NEBULA_PRESET}&confirm=1`, {
      state: { fromPersonaHome: true },
    });
  }, [navigate]);

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
    ? "正在校准兴趣星谱"
    : portraitWords.length
      ? "兴趣星谱已校准"
      : portraitState === "unavailable"
        ? "兴趣星谱暂不可用"
        : null;
  return (
    <>
      <div className="oauth-account oauth-account--connected">
        <button
          className="oauth-account__identity"
          type="button"
          aria-label={`${connectionLabel}，查看兴趣星谱${portraitWords.length ? `，兴趣底色 ${portraitWords.join("、")}` : ""}`}
          onClick={() => setCalibrationOpen(true)}
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
        </button>
        <button
          className="oauth-account__logout"
          type="button"
          disabled={busy}
          onClick={() => void logout()}
        >
          {busy ? "处理中" : logoutFailed ? "重试退出" : "退出"}
        </button>
      </div>
      <PortraitCalibration
        open={calibrationOpen}
        portrait={portrait}
        state={portraitState}
        onClose={closeCalibration}
        onRetry={retryCalibration}
        onExplore={exploreWithPortrait}
      />
    </>
  );
}
