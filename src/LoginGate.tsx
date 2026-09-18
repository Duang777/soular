import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  fetchZhihuAccountStatus,
  setActiveZhihuAccountVersion,
} from "./zhihuPortrait";

const OFFICIAL_ORIGIN = "https://soular.top";
const PUBLIC_PATHS = new Set(["/", "/landing"]);

type GateState =
  | "checking"
  | "authorized"
  | "anonymous"
  | "required"
  | "unavailable";

function LoginPrompt({
  state,
  loginFailed,
  loginHref,
  onClose,
  onRetry,
}: {
  state: GateState;
  loginFailed: boolean;
  loginHref: string;
  onClose: () => void;
  onRetry: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="login-gate"
      aria-labelledby="login-gate-title"
      onClose={onClose}
    >
      <button
        className="login-gate__close"
        type="button"
        aria-label="暂不登录，进入匿名体验"
        onClick={() => dialogRef.current?.close()}
      >
        ×
      </button>
      <section className="login-gate__panel">
        <p className="login-gate__eyebrow">ZHIHU ACCOUNT · OPTIONAL</p>
        <h1 id="login-gate-title">登录知乎，校准你的星谱</h1>
        <p>登录后会加入公开兴趣画像；关闭窗口也可以直接匿名进入。</p>
        {state === "checking" ? (
          <div className="login-gate__status" role="status" aria-live="polite">
            正在确认登录状态…
          </div>
        ) : state === "unavailable" ? (
          <button className="login-gate__action" type="button" onClick={onRetry}>
            重新检查
          </button>
        ) : (
          <a className="login-gate__action" href={loginHref}>
            {loginFailed ? "重新登录知乎" : "登录知乎并进入"}
          </a>
        )}
        <small>仅读取授权范围内的公开信息；原始收藏与关注明细不会进入星云。</small>
      </section>
    </dialog>
  );
}

export function LoginGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isOfficialOrigin = window.location.origin === OFFICIAL_ORIGIN;
  const bypassedForDevelopment = import.meta.env.DEV;
  const [state, setState] = useState<GateState>(
    bypassedForDevelopment
      ? "authorized"
      : isOfficialOrigin
        ? "checking"
        : "required",
  );
  const [retry, setRetry] = useState(0);
  const searchParams = new URLSearchParams(location.search);
  const loginFailed = searchParams.get("oauth") === "error";
  const promptOpen = searchParams.get("login") === "required" || loginFailed;
  const anonymousAccess = state === "anonymous";
  const accessGranted = state === "authorized" || anonymousAccess;
  const protectedLocation = !PUBLIC_PATHS.has(location.pathname) ||
    (
      location.pathname === "/" &&
      (
        searchParams.get("confirm") === "1" ||
        searchParams.get("explore") === "1"
      )
    );

  const checkAccount = useCallback(async (signal: AbortSignal) => {
    try {
      const status = await fetchZhihuAccountStatus(signal);
      setActiveZhihuAccountVersion(status.accountVersion);
      setState(status.authorized ? "authorized" : "required");
    } catch {
      if (signal.aborted) return;
      setActiveZhihuAccountVersion(null);
      setState("unavailable");
    }
  }, []);

  useEffect(() => {
    if (bypassedForDevelopment || !isOfficialOrigin || anonymousAccess) {
      return undefined;
    }
    let controller = new AbortController();
    const refresh = () => {
      controller.abort();
      controller = new AbortController();
      void checkAccount(controller.signal);
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    refresh();
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      controller.abort();
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [anonymousAccess, bypassedForDevelopment, checkAccount, isOfficialOrigin, retry]);

  useEffect(() => {
    if (state === "authorized" && promptOpen) navigate("/", { replace: true });
  }, [navigate, promptOpen, state]);

  const loginHref = isOfficialOrigin
    ? "/api/oauth/start"
    : `${OFFICIAL_ORIGIN}/api/oauth/start`;
  const continueAnonymously = () => {
    setState("anonymous");
    if (promptOpen) navigate("/", { replace: true });
  };

  if (!accessGranted && protectedLocation) {
    return (
      <LoginPrompt
        state={state}
        loginFailed={loginFailed}
        loginHref={loginHref}
        onClose={continueAnonymously}
        onRetry={() => {
          setState("checking");
          setRetry((value) => value + 1);
        }}
      />
    );
  }

  return (
    <>
      {children}
      {!bypassedForDevelopment && state !== "authorized" && promptOpen ? (
        <LoginPrompt
          state={state}
          loginFailed={loginFailed}
          loginHref={loginHref}
          onClose={continueAnonymously}
          onRetry={() => {
            setState("checking");
            setRetry((value) => value + 1);
          }}
        />
      ) : null}
    </>
  );
}
