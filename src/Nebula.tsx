import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CASTS } from "./cast";
import { NebulaStage } from "./NebulaStage";

export function Nebula() {
  const navigate = useNavigate();
  const [isCardsView, setIsCardsView] = useState(false);

  useEffect(() => {
    window.sessionStorage.setItem("jiupai:lobby", "/nebula");
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
      const cast = data?.cast;
      if (data?.type !== "nebula-open" || typeof cast !== "string") return;
      if (!CASTS.some((item) => item.key === cast)) return;
      const source = event.source as Window | null;
      if (source && typeof data.requestId === "string") {
        source.postMessage(
          { type: "nebula-open-ack", requestId: data.requestId },
          event.origin,
        );
      }
      if (data?.self === true) {
        navigate(`/shelf/${cast}?self=1`);
      } else if (Number.isInteger(data?.u) && data.u >= 0 && data.u < 48) {
        navigate(`/shelf/${cast}?u=${data.u}`);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [navigate]);

  return (
    <div className={`shelf-root nebula-root${isCardsView ? " nebula-root--cards" : ""}`}>
      <NebulaStage />
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
