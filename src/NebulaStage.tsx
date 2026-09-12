import type { CSSProperties, SyntheticEvent } from "react";
import { asset, withVersion } from "./cast";

export function NebulaStage({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  const markHost = (event: SyntheticEvent<HTMLIFrameElement>) => {
    try {
      const win = event.currentTarget.contentWindow as
        | (Window & { __nebHost?: boolean })
        | null;
      if (win) win.__nebHost = true;
    } catch {
      // 跨域或 iframe 尚未就绪时忽略；场景页会退化为直接跳转
    }
  };

  return (
    <div className={`nebula-stage${className ? ` ${className}` : ""}`} style={style}>
      <iframe
        className="landing-page-frame"
        src={withVersion(asset("nebula-scene/index.html"))}
        title="观点星云 · 知乎九派"
        onLoad={markHost}
      />
    </div>
  );
}
