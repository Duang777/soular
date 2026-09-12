import type { CSSProperties, RefObject } from "react";
import { asset, withVersion } from "./cast";

export function NebulaStage({
  className = "",
  style,
  presetId = "career-35",
  iframeRef,
}: {
  className?: string;
  style?: CSSProperties;
  presetId?: string;
  iframeRef?: RefObject<HTMLIFrameElement | null>;
}) {
  return (
    <div className={`nebula-stage${className ? ` ${className}` : ""}`} style={style}>
      <iframe
        ref={iframeRef}
        className="landing-page-frame"
        src={withVersion(
          `${asset("nebula-scene/index.html")}?preset=${encodeURIComponent(presetId)}`,
        )}
        title="观点星云 · 思想银河"
      />
    </div>
  );
}
