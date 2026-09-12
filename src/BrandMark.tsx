import { Link } from "react-router-dom";

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <Link
      to="/"
      className={`brand-lockup${className ? ` ${className}` : ""}`}
      aria-label="思想银河首页"
    >
      <svg
        className="brand-lockup__mark"
        viewBox="0 0 64 64"
        aria-hidden="true"
      >
        <rect className="brand-lockup__mark-bg" x="1" y="1" width="62" height="62" rx="14" />
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path
            className="brand-lockup__orbit brand-lockup__orbit--primary"
            d="M10.5 35.3C8.9 22.5 18.5 11.5 31.8 10.7c8.7-.5 16.6 3.4 21.1 9.7"
          />
          <path
            className="brand-lockup__orbit brand-lockup__orbit--accent"
            d="M54.6 27.3c2.3 12.2-6.2 23.6-19.1 25.7-9 1.5-17.8-2.1-22.7-8.8"
          />
        </g>
        <circle className="brand-lockup__node brand-lockup__node--primary" cx="12.2" cy="35.5" r="4.7" />
        <circle className="brand-lockup__node brand-lockup__node--accent" cx="53.1" cy="22.5" r="4.7" />
        <circle className="brand-lockup__satellite" cx="46.8" cy="46.4" r="2.4" />
        <path
          className="brand-lockup__star"
          d="M32 21.1c1.1 5.9 4 8.8 9.9 9.9-5.9 1.1-8.8 4-9.9 9.9-1.1-5.9-4-8.8-9.9-9.9 5.9-1.1 8.8-4 9.9-9.9Z"
        />
        <circle className="brand-lockup__core" cx="32" cy="31" r="2.3" />
      </svg>
      <span className="brand-lockup__copy">
        <b>思想银河</b>
        <small>SOULAR</small>
      </span>
    </Link>
  );
}
