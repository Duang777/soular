import { Link } from "react-router-dom";
import { SHOWCASE_GALAXIES } from "./nebulaCatalog";

export function GalaxyShowcase() {
  return (
    <section className="galaxy-showcase" aria-labelledby="galaxy-showcase-title">
      <div className="galaxy-showcase__head">
        <p className="galaxy-showcase__eyebrow">已发布星云</p>
        <h2 id="galaxy-showcase-title">选一场讨论，进入观点银河</h2>
      </div>
      <div className="galaxy-showcase__grid">
        {SHOWCASE_GALAXIES.map((galaxy) => (
          <Link
            key={galaxy.id}
            to={`/nebula?preset=${encodeURIComponent(galaxy.id)}`}
            className="galaxy-card"
          >
            <div className="galaxy-card__meta">
              <span className="galaxy-card__serial">{galaxy.serial}</span>
              <span className={`galaxy-card__kind galaxy-card__kind--${galaxy.kind}`}>
                {galaxy.kind === "real" ? "真实热点" : "示例"}
              </span>
            </div>
            <h3 className="galaxy-card__title">{galaxy.question}</h3>
            <p className="galaxy-card__blurb">{galaxy.blurb}</p>
            <div className="galaxy-card__spectrum" aria-hidden="true">
              <span>{galaxy.axisLeft}</span>
              <i />
              <span>{galaxy.axisRight}</span>
            </div>
            <p className="galaxy-card__foot">
              <span>{galaxy.signalCount} 个观点信号</span>
              <span className="galaxy-card__cta">进入星云 →</span>
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
