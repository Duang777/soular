import { Link, Navigate, useParams } from "react-router-dom";
import { asset, CASTS, castByKey } from "./cast";

export function ShelfPage() {
  const { cast: castKey = "" } = useParams();
  if (!CASTS.some((item) => item.key === castKey)) {
    return <Navigate to="/" replace />;
  }
  const cast = castByKey(castKey);
  const src = `${asset("books/shelf.html")}?cast=${encodeURIComponent(cast.key)}`;

  return (
    <div className="shelf-root">
      <iframe className="landing-page-frame" src={src} title={`${cast.name} · 知乎九派`} />
      <img src={asset("kanshan/wave.gif")} alt="" className="kanshan kanshan-shelf" />
      <nav className="shelf-nav" aria-label="书页">
        <div className="shelf-nav__tags">
          <Link to="/" className="shelf-tag">
            返回九派
          </Link>
        </div>
        <p className="shelf-nav__cast">
          {cast.volume} · {cast.name}
        </p>
      </nav>
    </div>
  );
}
