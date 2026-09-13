import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppChrome } from "./AppChrome";
import { CASTS } from "./cast";
import { NebulaStage } from "./NebulaStage";
import {
  personFromValue,
  resolveNebulaPreset,
  selfProfileFromValue,
} from "./people";

const NAVIGATION_CONTEXT_PREFIX = "jiupai:nebula:";
const MAX_NAVIGATION_CONTEXTS = 24;
const OFFICIAL_ORIGIN = "https://soular.top";
const OAUTH_STATUS_TIMEOUT_MS = 8_000;

interface NebulaUserProfile {
  name: string | null;
  avatarUrl: string;
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

function storeNavigationContext(kind: "self" | "subject", value: unknown): string | null {
  try {
    const existing: string[] = [];
    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith(NAVIGATION_CONTEXT_PREFIX) && key !== "jiupai:nebula:lobby") {
        existing.push(key);
      }
    }
    existing.sort((left, right) =>
      navigationContextTimestamp(left) - navigationContextTimestamp(right) ||
      left.localeCompare(right)
    );
    const key = `${Date.now().toString(36)}-${crypto.randomUUID()}`;
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

export function Nebula() {
  const navigate = useNavigate();
  const nebulaFrameRef = useRef<HTMLIFrameElement>(null);
  const userProfileRef = useRef<NebulaUserProfile | null>(null);
  const [searchParams] = useSearchParams();
  const [isCardsView, setIsCardsView] = useState(false);
  const requestedPreset = searchParams.get("preset") ?? "";
  const presetId = resolveNebulaPreset(requestedPreset);

  useEffect(() => {
    if (window.location.origin !== OFFICIAL_ORIGIN) return undefined;
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      OAUTH_STATUS_TIMEOUT_MS,
    );

    void (async () => {
      const response = await fetch("/api/oauth/status", {
        credentials: "include",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      const payload: unknown = await response.json();
      if (!response.ok || !payload || typeof payload !== "object") return;
      const status = payload as Record<string, unknown>;
      const profile = status.profile && typeof status.profile === "object"
        ? status.profile as Record<string, unknown>
        : null;
      const avatarUrl = safeZhihuAvatarUrl(profile?.avatarUrl);
      if (status.authorized !== true || !avatarUrl) return;

      const userProfile = {
        name: typeof profile?.name === "string" ? profile.name : null,
        avatarUrl,
      };
      userProfileRef.current = userProfile;
      nebulaFrameRef.current?.contentWindow?.postMessage(
        { type: "nebula-user-profile", profile: userProfile },
        window.location.origin,
      );
    })().catch(() => undefined).finally(() => {
      window.clearTimeout(timeout);
    });

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const lobby = `/nebula?preset=${encodeURIComponent(presetId)}`;
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
        if (userProfileRef.current) {
          source?.postMessage(
            {
              type: "nebula-user-profile",
              profile: userProfileRef.current,
            },
            event.origin,
          );
        }
        return;
      }
      if (
        data?.type === "nebula-preset-change" &&
        typeof data.preset === "string" &&
        /^[a-z0-9-]+$/.test(data.preset)
      ) {
        navigate(`/nebula?preset=${encodeURIComponent(data.preset)}`, { replace: true });
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
        const profile = activeVersion === null
          ? null
          : selfProfileFromValue(
              data.selfProfile,
              activePreset,
              activeVersion,
              cast,
            );
        let profileQuery = "";
        if (profile) {
          const profileKey = storeNavigationContext("self", profile);
          if (profileKey) {
            profileQuery = `&profile=${encodeURIComponent(profileKey)}`;
          }
        }
        navigate(
          `/shelf/${cast}?self=1&preset=${encodeURIComponent(activePreset)}${versionQuery}${profileQuery}`,
          { state: profile ? { selfProfile: profile } : undefined },
        );
      } else if (Number.isSafeInteger(data?.u) && data.u >= 0) {
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
          { state: personContext ? { person: personContext } : undefined },
        );
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [navigate, presetId]);

  return (
    <div className={`shelf-root nebula-root${isCardsView ? " nebula-root--cards" : ""}`}>
      <NebulaStage presetId={presetId} iframeRef={nebulaFrameRef} />
      <AppChrome
        hidden={isCardsView}
        backLink={{ to: "/", label: "返回首页" }}
      />
    </div>
  );
}
