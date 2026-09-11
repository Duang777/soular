import { useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { asset, withVersion, CASTS, castByKey } from "./cast";
import { CardDraw, type CardSubject } from "./CardDraw";
import { personByIndex } from "./people";

type ShelfPhase = "draw" | "book" | "card";

export function ShelfPage() {
  const { cast: castKey = "" } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<ShelfPhase>("draw");

  if (!CASTS.some((item) => item.key === castKey)) {
    return <Navigate to="/" replace />;
  }
  const cast = castByKey(castKey);
  const src = withVersion(`${asset("books/shelf.html")}?cast=${encodeURIComponent(cast.key)}`);

  let subject: CardSubject = { kind: "self" };
  const uRaw = searchParams.get("u");
  if (uRaw !== null && /^\d+$/.test(uRaw)) {
    const index = Number(uRaw);
    const person = personByIndex(index);
    if (person && person.cast === cast.key) {
      subject = { kind: "person", index };
    }
  } else if (searchParams.get("peek") !== null) {
    subject = { kind: "peek" };
  }

  const lobbyRaw = typeof window !== "undefined" ? window.sessionStorage.getItem("jiupai:lobby") : null;
  const lobbyTarget = lobbyRaw === "/nebula" || lobbyRaw === "/" ? lobbyRaw : "/";

  function handleExit() {
    navigate(lobbyTarget);
  }

  return (
    <div className="shelf-root">
      <iframe className="landing-page-frame" src={src} title={`${cast.name} · 知乎九派`} />
      <img src={asset("kanshan/wave.gif")} alt="" className="kanshan kanshan-shelf" />
      <nav className="shelf-nav" aria-label="书页">
        <div className="shelf-nav__tags">
          <Link to={lobbyTarget} className="shelf-tag">
            {lobbyTarget === "/nebula" ? "返回星云" : "返回九派"}
          </Link>
        </div>
        <p className="shelf-nav__cast">
          {cast.volume} · {cast.name}
        </p>
        <div className="shelf-nav__share">
          <button type="button" className="shelf-tag shelf-tag--share" onClick={() => setPhase("card")}>
            <span aria-hidden="true">✦</span> 分享人格卡
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
