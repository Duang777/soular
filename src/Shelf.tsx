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
  fetchZhihuPortrait,
  getActiveZhihuAccountVersion,
  toNebulaPortraitSignal,
  type NebulaPortraitSignal,
} from "./zhihuPortrait";

type ShelfPhase = "draw" | "book" | "card";
type ShelfNavigationState = {
  person?: unknown;
  selfProfile?: unknown;
};
const OFFICIAL_ORIGIN = "https://soular.top";

export function ShelfPage() {
  const { cast: castKey = "" } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<ShelfPhase>("draw");
  const [latePortrait, setLatePortrait] = useState<NebulaPortraitSignal | null>(null);
  const requestedSelf = searchParams.get("self") === "1";
  const requestedProfileKey = searchParams.get("profile") ?? "";

  useEffect(() => {
    setLatePortrait(null);
    if (!requestedSelf || window.location.origin !== OFFICIAL_ORIGIN) return undefined;
    const expectedAccountVersion = getActiveZhihuAccountVersion();
    if (!expectedAccountVersion) return undefined;
    const controller = new AbortController();
    void fetchZhihuPortrait(controller.signal)
      .then((portrait) => {
        if (portrait.accountVersion === expectedAccountVersion) {
          setLatePortrait(toNebulaPortraitSignal(portrait));
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [requestedProfileKey, requestedSelf]);

  if (!CASTS.some((item) => item.key === castKey)) {
    return <Navigate to="/" replace />;
  }
  const cast = castByKey(castKey);
  const src = withVersion(`${asset("books/shelf.html")}?cast=${encodeURIComponent(cast.key)}`);

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
  let subject: CardSubject = {
    kind: "self",
    preset: presetId,
    version: presetVersion || undefined,
    profile: transientSelfProfile(
      presetId,
      presetVersion,
      cast.key,
      profileKey,
    ) ?? selfProfileFromValue(
      navigationState.selfProfile,
      presetId,
      presetVersion,
      cast.key,
    ) ?? stagedSelfProfile(presetId, presetVersion, cast.key, profileKey) ?? undefined,
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
        />
      )}
    </div>
  );
}
