import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CASTS } from "./cast";
import { NebulaStage } from "./NebulaStage";

export function Nebula() {
  const navigate = useNavigate();

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      const cast = data?.cast;
      if (data?.type !== "nebula-open" || typeof cast !== "string") return;
      if (!CASTS.some((item) => item.key === cast)) return;
      navigate(`/shelf/${cast}`);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [navigate]);

  return (
    <div className="shelf-root nebula-root">
      <NebulaStage />
      <nav className="shelf-nav" aria-label="星云导航">
        <div className="shelf-nav__tags">
          <Link to="/" className="shelf-tag">
            返回九派
          </Link>
        </div>
        <p className="shelf-nav__cast">SPECTRUM · 观点星云</p>
      </nav>
    </div>
  );
}
