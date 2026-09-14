import type { CSSProperties, RefObject } from "react";
import { asset, withVersion } from "./cast";

export function NebulaStage({
  className = "",
  style,
  entryState = null,
  presetId = "career-35",
  autoGenerate = false,
  openPeerDiscovery = false,
  onLoad,
  iframeRef,
}: {
  className?: string;
  style?: CSSProperties;
  entryState?: "discover" | "confirm" | "explore" | null;
  presetId?: string;
  autoGenerate?: boolean;
  openPeerDiscovery?: boolean;
  onLoad?: () => void;
  iframeRef?: RefObject<HTMLIFrameElement | null>;
}) {
  return (
    <div className={`nebula-stage${className ? ` ${className}` : ""}`} style={style}>
      <iframe
        ref={iframeRef}
        onLoad={onLoad}
        className="landing-page-frame"
        src={withVersion(
          `${asset("nebula-scene/index.html")}?preset=${encodeURIComponent(presetId)}${entryState ? `&entry=${entryState}` : ""}${autoGenerate ? "&generate=1" : ""}${openPeerDiscovery ? "&peers=1" : ""}`,
        )}
        title="观点星云 · 思想银河"
      />
    </div>
  );
}
