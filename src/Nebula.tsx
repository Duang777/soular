import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CASTS } from "./cast";
import { NebulaStage } from "./NebulaStage";

export function Nebula() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isCardsView, setIsCardsView] = useState(false);
  const requestedPreset = searchParams.get("preset") ?? "";
  const presetId = /^[a-z0-9-]+$/.test(requestedPreset)
    ? requestedPreset
    : "career-35";

  useEffect(() => {
    const lobby = `/nebula?preset=${encodeURIComponent(presetId)}`;
    window.sessionStorage.setItem("jiupai:lobby", lobby);
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (
        data?.type === "nebula-view-change" &&
        (data.view === "cards" || data.view === "nebula")
      ) {
        setIsCardsView(data.view === "cards");
        return;
      }
      if (data?.type === "nebula-scene-ready") {
        const source = event.source as (Window & { __nebHost?: boolean }) | null;
        if (source) {
          source.__nebHost = true;
          source.postMessage({ type: "nebula-host-ready" }, event.origin);
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
      const source = event.source as Window | null;
      if (source && typeof data.requestId === "string") {
        source.postMessage(
          { type: "nebula-open-ack", requestId: data.requestId },
          event.origin,
        );
      }
      if (data?.self === true) {
        navigate(`/shelf/${cast}?self=1&preset=${encodeURIComponent(activePreset)}`);
      } else if (Number.isInteger(data?.u) && data.u >= 0 && data.u < 200) {
        if (data.person && typeof data.person === "object") {
          try {
            window.sessionStorage.setItem(
              "jiupai:nebula:subject",
              JSON.stringify(data.person),
            );
          } catch {
            // Session storage 不可用时，默认快照仍可按索引回退。
          }
        }
        navigate(
          `/shelf/${cast}?u=${data.u}&preset=${encodeURIComponent(activePreset)}`,
        );
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [navigate, presetId]);

  return (
    <div className={`shelf-root nebula-root${isCardsView ? " nebula-root--cards" : ""}`}>
      <NebulaStage presetId={presetId} />
      {!isCardsView && (
        <nav className="shelf-nav shelf-nav--nebula" aria-label="星云导航">
          <div className="shelf-nav__tags">
            <Link to="/" className="shelf-tag">
              返回九派
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
}
