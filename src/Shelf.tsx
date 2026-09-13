import { useEffect, useState } from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { BrandMark } from "./BrandMark";
import { asset, withVersion, CASTS, castByKey } from "./cast";
import { CardDraw, type CardSubject } from "./CardDraw";
import {
  clearSelfProfileContexts,
  countMatchingNebulaLikes,
  DEFAULT_NEBULA_PRESET,
  nebulaPresetVersion,
  personByIndex,
  personFromValue,
  resolveNebulaPreset,
  selfProfileFromValue,
  stagedPersonByIndex,
  stagedSelfProfile,
  transientSelfProfile,
} from "./people";
import {
  fetchZhihuAccountStatus,
  fetchZhihuPortrait,
  getActiveZhihuAccountVersion,
  setActiveZhihuAccountVersion,
  toNebulaPortraitSignal,
  type NebulaPortraitSignal,
} from "./zhihuPortrait";

type ShelfPhase = "draw" | "book" | "card";
type ShelfNavigationState = {
  person?: unknown;
  selfProfile?: unknown;
};
const OFFICIAL_ORIGIN = "https://soular.top";

function currentNebulaLikeCount(
  preset: string,
  version: string,
  expectedIndexes: readonly number[] | undefined,
): number | null {
  try {
    const raw = window.localStorage.getItem(
      `jiupai:nebula:likes:v2:${preset}:${version}`,
    );
    if (raw === null) return 0;
    const parsed = JSON.parse(raw);
    return countMatchingNebulaLikes(parsed, expectedIndexes, preset);
  } catch {
    return null;
  }
}

export function ShelfPage() {
  const { cast: castKey = "" } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<ShelfPhase>("draw");
  const [latePortrait, setLatePortrait] = useState<NebulaPortraitSignal | null>(null);
  const [verifiedAccountVersion, setVerifiedAccountVersion] = useState<
    string | null | undefined
  >(undefined);
  const requestedSelf = searchParams.get("self") === "1";
  const requestedProfileKey = searchParams.get("profile") ?? "";
  const validCast = CASTS.some((item) => item.key === castKey);
  const cast = castByKey(castKey);
  const requestedPresetId = searchParams.get("preset") ?? DEFAULT_NEBULA_PRESET;
  const presetId = resolveNebulaPreset(requestedPresetId);
  const currentPresetVersion = nebulaPresetVersion(presetId)!;
  const requestedVersion = searchParams.get("version") ?? "";
  const validRequestedVersion = /^[a-z0-9-]{1,15}$/.test(requestedVersion)
    ? requestedVersion
    : "";
  const presetVersion = validRequestedVersion || currentPresetVersion;
  const staleVersion = Boolean(
    validRequestedVersion && validRequestedVersion !== currentPresetVersion,
  );
  const profileKey = /^[a-z0-9-]{1,64}$/.test(requestedProfileKey)
    ? requestedProfileKey
    : "";
  const navigationState = location.state &&
    typeof location.state === "object" &&
    !Array.isArray(location.state)
    ? location.state as ShelfNavigationState
    : {};
  const storedSelfProfile = transientSelfProfile(
    presetId,
    presetVersion,
    cast.key,
    profileKey,
  ) ?? selfProfileFromValue(
    navigationState.selfProfile,
    presetId,
    presetVersion,
    cast.key,
  ) ?? stagedSelfProfile(presetId, presetVersion, cast.key, profileKey);

  useEffect(() => {
    setLatePortrait(null);
    setVerifiedAccountVersion(undefined);
    if (
      !validCast ||
      !requestedSelf ||
      window.location.origin !== OFFICIAL_ORIGIN
    ) return undefined;

    let controller: AbortController | null = null;
    let refreshSequence = 0;
    const refresh = () => {
      const sequence = ++refreshSequence;
      controller?.abort();
      controller = new AbortController();
      setLatePortrait(null);
      setVerifiedAccountVersion(undefined);
      const signal = controller.signal;

      void (async () => {
        let status;
        try {
          status = await fetchZhihuAccountStatus(signal);
        } catch {
          if (signal.aborted || sequence !== refreshSequence) return;
          setLatePortrait(null);
          setVerifiedAccountVersion(null);
          return;
        }
        if (signal.aborted || sequence !== refreshSequence) return;
        const accountVersion = status.authorized
          ? status.accountVersion
          : null;
        const previousAccountVersion = getActiveZhihuAccountVersion();
        if (
          (
            previousAccountVersion !== null &&
            previousAccountVersion !== accountVersion
          ) ||
          (
            storedSelfProfile?.accountVersion &&
            storedSelfProfile.accountVersion !== accountVersion
          )
        ) {
          clearSelfProfileContexts();
        }
        setActiveZhihuAccountVersion(accountVersion);
        setVerifiedAccountVersion(accountVersion);
        if (!accountVersion) return;

        try {
          const portrait = await fetchZhihuPortrait(signal);
          if (
            signal.aborted ||
            sequence !== refreshSequence ||
            portrait.accountVersion !== accountVersion
          ) return;
          setLatePortrait(toNebulaPortraitSignal(portrait));
        } catch {
          if (signal.aborted || sequence !== refreshSequence) return;
          setLatePortrait(null);
        }
      })();
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    refresh();
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      refreshSequence += 1;
      controller?.abort();
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [
    requestedProfileKey,
    requestedSelf,
    validCast,
  ]);

  if (!validCast) {
    return <Navigate to="/" replace />;
  }
  const src = withVersion(`${asset("books/shelf.html")}?cast=${encodeURIComponent(cast.key)}`);

  const verifiedSelfProfile = storedSelfProfile
    ? {
        ...storedSelfProfile,
        interest:
          storedSelfProfile.accountVersion &&
          storedSelfProfile.accountVersion === verifiedAccountVersion
            ? storedSelfProfile.interest
            : undefined,
      }
    : null;
  let subject: CardSubject = {
    kind: "self",
    preset: presetId,
    version: presetVersion || undefined,
    profile: verifiedSelfProfile ?? undefined,
  };
  if (
    subject.kind === "self" &&
    subject.profile &&
    latePortrait &&
    !subject.profile.interest
  ) {
    subject = {
      ...subject,
      profile: { ...subject.profile, interest: latePortrait },
    };
  }
  let missingPerson = false;
  const uRaw = searchParams.get("u");
  if (uRaw !== null && /^\d+$/.test(uRaw)) {
    const index = Number(uRaw);
    const requestedPersonKey = searchParams.get("person") ?? "";
    const personKey = /^[a-z0-9-]{1,64}$/.test(requestedPersonKey)
      ? requestedPersonKey
      : "";
    const person = personFromValue(
      navigationState.person,
      presetId,
      presetVersion,
      index,
    ) ??
      stagedPersonByIndex(presetId, presetVersion, index, personKey) ??
      (
        presetId === DEFAULT_NEBULA_PRESET &&
        presetVersion === currentPresetVersion
          ? personByIndex(index)
          : null
      );
    if (person && person.cast === cast.key) {
      subject = {
        kind: "person",
        index,
        preset: presetId,
        version: presetVersion || undefined,
        person,
      };
    } else {
      missingPerson = true;
    }
  } else if (searchParams.get("peek") !== null) {
    subject = { kind: "peek" };
  }

  let lobbyRaw: string | null = null;
  try {
    lobbyRaw = typeof window !== "undefined"
      ? window.sessionStorage.getItem("jiupai:lobby")
      : null;
  } catch {
    // 存储不可用时返回首页。
  }
  const storedLobbyTarget = lobbyRaw === "/" || lobbyRaw === "/nebula" || lobbyRaw?.startsWith("/nebula?")
    ? lobbyRaw
    : "/";
  const lobbyTarget = subject.kind === "peek"
    ? storedLobbyTarget
    : `/nebula?preset=${encodeURIComponent(subject.preset)}`;

  if (missingPerson || (staleVersion && subject.kind === "person")) {
    return <Navigate to={`/nebula?preset=${encodeURIComponent(presetId)}`} replace />;
  }

  function handleExit() {
    navigate(lobbyTarget);
  }

  function handleDiscoverPeers() {
    navigate(`/nebula?preset=${encodeURIComponent(presetId)}&peers=1`);
  }

  const activeLikeCount = currentNebulaLikeCount(
    presetId,
    presetVersion,
    subject.kind === "self" ? subject.profile?.likedIndexes : undefined,
  );
  const canDiscoverPeers =
    !staleVersion &&
    subject.kind === "self" &&
    Boolean(subject.profile && subject.profile.likedCount >= 3) &&
    activeLikeCount !== null &&
    activeLikeCount >= 3;

  return (
    <div className="shelf-root">
      <iframe className="landing-page-frame" src={src} title={`${cast.name} · 思想银河`} />
      <img src={asset("kanshan/wave.gif")} alt="" className="kanshan kanshan-shelf" />
      <nav className="shelf-nav" aria-label="书页">
        <BrandMark className="brand-lockup--shelf" />
        <div className="shelf-nav__tags">
          <Link to={lobbyTarget} className="shelf-tag">
            {lobbyTarget.startsWith("/nebula") ? "返回星云" : "返回首页"}
          </Link>
        </div>
        <p className="shelf-nav__cast">
          {cast.volume} · {cast.name}
        </p>
        <div className="shelf-nav__share">
          <button type="button" className="shelf-tag shelf-tag--share" onClick={() => setPhase("card")}>
            <span aria-hidden="true">✦</span> {subject.kind === "person" ? "分享这个观点" : "分享人格卡"}
          </button>
        </div>
      </nav>

      {phase !== "book" && (
        <CardDraw
          cast={cast}
          subject={subject}
          mode={phase === "draw" ? "enter" : "revisit"}
          onEnter={() => setPhase("book")}
          onClose={() => setPhase("book")}
          onExit={handleExit}
          onDiscoverPeers={canDiscoverPeers ? handleDiscoverPeers : undefined}
        />
      )}
    </div>
  );
}
