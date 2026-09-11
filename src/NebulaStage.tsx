import type { CSSProperties } from "react";
import { asset } from "./cast";

export function NebulaStage({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={`nebula-stage${className ? ` ${className}` : ""}`} style={style}>
      <iframe
        className="landing-page-frame"
        src={asset("nebula/index.html")}
        title="观点星云 · 知乎九派"
      />
    </div>
  );
}
