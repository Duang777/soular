import type { CSSProperties } from "react";
import { asset, withVersion } from "./cast";

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
        src={withVersion(asset("nebula-scene/index.html"))}
        title="观点星云 · 知乎九派"
      />
    </div>
  );
}
