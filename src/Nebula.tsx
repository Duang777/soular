import { useCallback, useEffect, useRef, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { CASTS } from "./cast";
import {
  resolveIdentityRevision,
  type IdentityRevisionStorage,
} from "./identityRevision";
import { NebulaStage } from "./NebulaStage";
import {
  clearSelfProfileContexts,
  personFromValue,
  resolveNebulaPreset,
  selfProfileFromValue,
  stageTransientSelfProfile,
} from "./people";
import {
  fetchZhihuPortrait,
  fetchZhihuPublicProfile,
  setActiveZhihuAccountVersion,
  toNebulaPortraitSignal,
  type NebulaPortraitSignal,
} from "./zhihuPortrait";

const NAVIGATION_CONTEXT_PREFIX = "jiupai:nebula:";
const NAVIGATION_CONTEXT_KINDS = ["self", "subject"] as const;
const MAX_NAVIGATION_CONTEXTS = 24;
const OFFICIAL_ORIGIN = "https://soular.top";
const OAUTH_STATUS_TIMEOUT_MS = 8_000;
const IDENTITY_REVISIONS_KEY = "jiupai:nebula:identity-revisions:v1";
const MAX_IDENTITY_REVISIONS = 8;
const volatileIdentityRevisions = new Map<string, number>();

interface NebulaUserProfile {
  name: string | null;
  avatarUrl: string | null;
}

interface NebulaUserContext {
  profile: NebulaUserProfile;
  portrait: NebulaPortraitSignal | null;
  accountVersion: string | null;
}

function identityRevisionFor(accountVersion: string | null): number {
  let storage: IdentityRevisionStorage | null = null;
  try {
    storage = window.sessionStorage;
  } catch {
    // Storage access can be disabled; the resolver keeps a page-local map.
  }
  return resolveIdentityRevision(
    accountVersion,
    storage,
    volatileIdentityRevisions,
    IDENTITY_REVISIONS_KEY,
    MAX_IDENTITY_REVISIONS,
  );
}

function safeZhihuAvatarUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
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

function navigationContextTimestamp(storageKey: string): number {
  const token = storageKey.slice(storageKey.lastIndexOf(":") + 1);
  const match = token.match(/^([a-z0-9]+)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  if (!match) return 0;
  const timestamp = Number.parseInt(match[1], 36);
  return Number.isSafeInteger(timestamp) ? timestamp : 0;
}

function createNavigationContextKey(): string | null {
  try {
    let uuid: string;
    if (typeof crypto.randomUUID === "function") {
      uuid = crypto.randomUUID();
    } else {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
      uuid = [
        hex.slice(0, 4).join(""),
        hex.slice(4, 6).join(""),
        hex.slice(6, 8).join(""),
        hex.slice(8, 10).join(""),
        hex.slice(10).join(""),
      ].join("-");
    }
    return `${Date.now().toString(36)}-${uuid}`;
  } catch {
    return null;
  }
}

function storeNavigationContext(
  kind: "self" | "subject",
  value: unknown,
  contextKey?: string,
): string | null {
  try {
    const existing: string[] = [];
    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index);
      if (
        key &&
        NAVIGATION_CONTEXT_KINDS.some((kind) =>
          key.startsWith(`${NAVIGATION_CONTEXT_PREFIX}${kind}:`)
        )
      ) {
        existing.push(key);
      }
    }
    existing.sort((left, right) =>
      navigationContextTimestamp(left) - navigationContextTimestamp(right) ||
      left.localeCompare(right)
    );
    const key = contextKey ?? createNavigationContextKey();
    if (!key) return null;
    window.sessionStorage.setItem(
      `${NAVIGATION_CONTEXT_PREFIX}${kind}:${key}`,
      JSON.stringify(value),
    );
    while (existing.length >= MAX_NAVIGATION_CONTEXTS) {
      const key = existing.shift();
      if (key) window.sessionStorage.removeItem(key);
    }
    return key;
  } catch {
    return null;
  }
}

export function Nebula({
  entryMode = false,
  active = true,
}: {
  entryMode?: boolean;
  active?: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const nebulaFrameRef = useRef<HTMLIFrameElement>(null);
  const userContextRef = useRef<NebulaUserContext | null>(null);
  const identityRevisionRef = useRef(0);
  const selfOpenPendingRef = useRef(false);
  const [searchParams] = useSearchParams();
  const [isCardsView, setIsCardsView] = useState(false);
  const fromPersonaHome =
    location.state &&
    typeof location.state === "object" &&
    "fromPersonaHome" in location.state &&
    location.state.fromPersonaHome === true;
  const requestedPreset = searchParams.get("preset") ?? "";
  const presetId = resolveNebulaPreset(requestedPreset);
  const openPeerDiscovery = !entryMode && searchParams.get("peers") === "1";
  const autoGenerate =
    entryMode && searchParams.get("generate") === "1";
  const entryState = entryMode
    ? searchParams.get("confirm") === "1"
      ? "confirm"
      : searchParams.get("explore") === "1"
        ? "explore"
        : "discover"
    : null;

  const requestOpenPeerDiscovery = useCallback(() => {
    if (!openPeerDiscovery) return;
    nebulaFrameRef.current?.contentWindow?.postMessage(
      { type: "nebula-open-peer-discovery" },
      window.location.origin,
    );
  }, [openPeerDiscovery]);

  const publishStageVisibility = useCallback(() => {
    nebulaFrameRef.current?.contentWindow?.postMessage(
      { type: "nebula-host-visibility", visible: active },
      window.location.origin,
    );
  }, [active]);

  useEffect(() => {
    publishStageVisibility();
  }, [presetId, publishStageVisibility]);

  useEffect(() => {
    if (active) selfOpenPendingRef.current = false;
  }, [active]);

  useEffect(() => {
    if (!openPeerDiscovery) return undefined;
    const timer = window.setTimeout(requestOpenPeerDiscovery, 0);
    window.addEventListener("pageshow", requestOpenPeerDiscovery);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pageshow", requestOpenPeerDiscovery);
    };
  }, [openPeerDiscovery, presetId, requestOpenPeerDiscovery]);

  useEffect(() => {
    if (window.location.origin !== OFFICIAL_ORIGIN) return undefined;
    let controller: AbortController | null = null;
    let timeout = 0;
    let refreshSequence = 0;
    let lastRefreshAt = 0;

    function publishUserContext(userContext: NebulaUserContext) {
      const previousAccountVersion =
        userContextRef.current?.accountVersion ?? null;
      if (
        userContextRef.current === null ||
        previousAccountVersion !== userContext.accountVersion
      ) {
        identityRevisionRef.current = identityRevisionFor(
          userContext.accountVersion,
        );
      }
      userContextRef.current = userContext;
      nebulaFrameRef.current?.contentWindow?.postMessage(
        {
          type: "nebula-user-profile",
          profile: userContext.profile,
          portrait: userContext.portrait,
          identityRevision: identityRevisionRef.current,
        },
        window.location.origin,
      );
    }

    function loadUserContext() {
      const now = Date.now();
      if (now - lastRefreshAt < 500) return;
      lastRefreshAt = now;
      const sequence = ++refreshSequence;
      controller?.abort();
      window.clearTimeout(timeout);
      const requestController = new AbortController();
      controller = requestController;
      const signal = requestController.signal;
      const requestTimeout = window.setTimeout(
        () => requestController.abort(),
        OAUTH_STATUS_TIMEOUT_MS,
      );
      timeout = requestTimeout;

      void (async () => {
        const response = await fetch("/api/oauth/status", {
          credentials: "include",
          headers: { Accept: "application/json" },
          signal,
        });
        window.clearTimeout(requestTimeout);
        const payload: unknown = await response.json();
        if (
          sequence !== refreshSequence ||
          !response.ok ||
          !payload ||
          typeof payload !== "object"
        ) return;
        const status = payload as Record<string, unknown>;
        const profile = status.profile && typeof status.profile === "object"
          ? status.profile as Record<string, unknown>
          : null;
        const avatarUrl = safeZhihuAvatarUrl(profile?.avatarUrl);
        const accountVersion =
          typeof status.accountVersion === "string" &&
          /^[a-f0-9]{16}$/.test(status.accountVersion)
            ? status.accountVersion
            : null;
        if (status.authorized !== true || !accountVersion) {
          clearSelfProfileContexts();
          setActiveZhihuAccountVersion(null);
          publishUserContext({
            profile: { name: null, avatarUrl: null },
            portrait: null,
            accountVersion: null,
          });
          return;
        }
        if (userContextRef.current?.accountVersion !== accountVersion) {
          clearSelfProfileContexts();
        }
        setActiveZhihuAccountVersion(accountVersion);
        const previousContext =
          userContextRef.current?.accountVersion === accountVersion
            ? userContextRef.current
            : null;

        const userContext: NebulaUserContext = {
          profile: {
            name: typeof profile?.name === "string"
              ? profile.name
              : previousContext?.profile.name ?? null,
            avatarUrl: avatarUrl ?? previousContext?.profile.avatarUrl ?? null,
          },
          portrait: previousContext?.portrait ?? null,
          accountVersion,
        };
        publishUserContext(userContext);

        const recoveryTasks: Promise<void>[] = [];
        if (!avatarUrl) {
          recoveryTasks.push(
            fetchZhihuPublicProfile(accountVersion, signal)
              .then((recoveredProfile) => {
                if (!recoveredProfile || sequence !== refreshSequence) return;
                const current = userContextRef.current;
                if (current?.accountVersion !== accountVersion) return;
                publishUserContext({
                  ...current,
                  profile: {
                    name: recoveredProfile.name ?? current.profile.name,
                    avatarUrl:
                      safeZhihuAvatarUrl(recoveredProfile.avatarUrl) ??
                      current.profile.avatarUrl,
                  },
                });
              })
              .catch(() => undefined),
          );
        }
        recoveryTasks.push(
          fetchZhihuPortrait(signal)
            .then((portrait) => {
              if (
                sequence !== refreshSequence ||
                portrait.accountVersion !== accountVersion
              ) return;
              const current = userContextRef.current;
              if (current?.accountVersion !== accountVersion) return;
              publishUserContext({
                ...current,
                portrait: toNebulaPortraitSignal(portrait),
              });
            })
            .catch(() => undefined),
        );
        await Promise.allSettled(recoveryTasks);
      })().catch(() => undefined);
    }

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") loadUserContext();
    };
    loadUserContext();
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      refreshSequence += 1;
      window.clearTimeout(timeout);
      controller?.abort();
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  useEffect(() => {
    const lobbyPath = entryMode ? "/" : "/nebula";
    const lobby = `${lobbyPath}?preset=${encodeURIComponent(presetId)}`;
    try {
      window.sessionStorage.setItem("jiupai:lobby", lobby);
    } catch {
      // 存储不可用时仍保留 iframe 消息与路由。
    }
    function onMessage(event: MessageEvent) {
      if (
        event.origin !== window.location.origin ||
        event.source !== nebulaFrameRef.current?.contentWindow
      ) return;
      const data = event.data;
      if (
        data?.type === "nebula-view-change" &&
        (data.view === "cards" || data.view === "nebula")
      ) {
        setIsCardsView(data.view === "cards");
        return;
      }
      if (data?.type === "nebula-scene-ready") {
        const source = event.source as Window | null;
        source?.postMessage({ type: "nebula-host-ready" }, event.origin);
        source?.postMessage(
          { type: "nebula-host-visibility", visible: active },
          event.origin,
        );
        if (userContextRef.current) {
          source?.postMessage(
            {
              type: "nebula-user-profile",
              profile: userContextRef.current.profile,
              portrait: userContextRef.current.portrait,
              identityRevision: identityRevisionRef.current,
            },
            event.origin,
          );
        }
        if (openPeerDiscovery) {
          source?.postMessage(
            { type: "nebula-open-peer-discovery" },
            event.origin,
          );
        }
        return;
      }
      if (data?.type === "nebula-entry-back" && entryMode) {
        if (fromPersonaHome) navigate(-1);
        else navigate("/", { replace: true });
        return;
      }
      if (
        data?.type === "nebula-entry-explore" &&
        entryMode &&
        typeof data.preset === "string" &&
        /^[a-z0-9-]+$/.test(data.preset)
      ) {
        const next = new URL(window.location.href);
        next.search = "";
        next.searchParams.set("preset", data.preset);
        next.searchParams.set("explore", "1");
        window.history.replaceState(
          window.history.state,
          "",
          `${next.pathname}${next.search}${next.hash}`,
        );
        return;
      }
      if (
        data?.type === "nebula-preset-change" &&
        typeof data.preset === "string" &&
        /^[a-z0-9-]+$/.test(data.preset)
      ) {
        const entryQuery = entryMode && data.entry === "generate"
          ? "&confirm=1&generate=1"
          : entryMode && data.entry === "confirm"
            ? "&confirm=1"
          : entryMode &&
              new URLSearchParams(window.location.search).get("explore") === "1"
            ? "&explore=1"
            : "";
        navigate(`${lobbyPath}?preset=${encodeURIComponent(data.preset)}${entryQuery}`, {
          replace: true,
          state: fromPersonaHome ? { fromPersonaHome: true } : undefined,
        });
        return;
      }
      const cast = data?.cast;
      if (data?.type !== "nebula-open" || typeof cast !== "string") return;
      if (!CASTS.some((item) => item.key === cast)) return;
      const activePreset = typeof data.preset === "string" &&
        /^[a-z0-9-]+$/.test(data.preset)
        ? data.preset
        : presetId;
      const activeVersion = typeof data.version === "string" &&
        /^[a-z0-9-]{1,15}$/.test(data.version)
        ? data.version
        : null;
      const versionQuery = activeVersion
        ? `&version=${encodeURIComponent(activeVersion)}`
        : "";
      const source = event.source as Window | null;
      if (source && typeof data.requestId === "string") {
        source.postMessage(
          { type: "nebula-open-ack", requestId: data.requestId },
          event.origin,
        );
      }
      if (data?.self === true) {
        if (selfOpenPendingRef.current) return;
        selfOpenPendingRef.current = true;
        const parsedProfile = activeVersion === null
          ? null
          : selfProfileFromValue(
              data.selfProfile,
              activePreset,
              activeVersion,
              cast,
            );
        const userContext = userContextRef.current;
        const portrait = userContext?.portrait ?? null;
        const profile = parsedProfile
          ? {
              ...parsedProfile,
              accountVersion: userContext?.accountVersion ?? undefined,
              interest: portrait ?? parsedProfile.interest,
            }
          : null;
        let profileQuery = "";
        let persistedProfile = profile;
        if (profile) {
          persistedProfile = { ...profile, interest: undefined };
          const profileKey = createNavigationContextKey();
          if (profileKey) {
            stageTransientSelfProfile(profileKey, profile);
            storeNavigationContext("self", persistedProfile, profileKey);
            profileQuery = `&profile=${encodeURIComponent(profileKey)}`;
          }
        }
        navigate(
          `/shelf/${cast}?self=1&preset=${encodeURIComponent(activePreset)}${versionQuery}${profileQuery}`,
          { state: { backgroundLocation: location } },
        );
        return;
      }
      if (Number.isSafeInteger(data?.u) && data.u >= 0) {
        const person = activeVersion === null
          ? null
          : personFromValue(data.person, activePreset, activeVersion, data.u);
        const personContext = person && activeVersion
          ? {
              ...person,
              preset: activePreset,
              version: activeVersion,
              index: data.u,
            }
          : null;
        let personQuery = "";
        if (personContext) {
          const personKey = storeNavigationContext("subject", personContext);
          if (personKey) {
            personQuery = `&person=${encodeURIComponent(personKey)}`;
          }
        }
        navigate(
          `/shelf/${cast}?u=${data.u}&preset=${encodeURIComponent(activePreset)}${versionQuery}${personQuery}`,
          {
            state: {
              backgroundLocation: location,
              ...(personContext ? { person: personContext } : {}),
            },
          },
        );
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [
    entryMode,
    entryState,
    fromPersonaHome,
    active,
    location,
    navigate,
    openPeerDiscovery,
    presetId,
  ]);

  return (
    <div className={`shelf-root nebula-root${isCardsView ? " nebula-root--cards" : ""}`}>
      <NebulaStage
        entryState={entryState}
        presetId={presetId}
        autoGenerate={autoGenerate}
        openPeerDiscovery={openPeerDiscovery}
        onLoad={requestOpenPeerDiscovery}
        iframeRef={nebulaFrameRef}
      />
      {!entryMode && !isCardsView && (
        <nav className="shelf-nav shelf-nav--nebula" aria-label="星云导航">
          <div className="shelf-nav__tags">
            <Link to="/" className="shelf-tag">
              返回首页
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
}
