import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import characterWaveUrl from "./shaders/character-carousel/sources/character-wave.html?url";

export function WaveStage({
  className = "",
  style,
  iframeRef,
}: {
  className?: string;
  style?: CSSProperties;
  iframeRef?: RefObject<HTMLIFrameElement | null>;
}) {
  const localIframeRef = useRef<HTMLIFrameElement>(null);
  const activeIframeRef = iframeRef ?? localIframeRef;
  const [hostVisible, setHostVisible] = useState(true);

  useEffect(() => {
    const iframe = activeIframeRef.current;
    if (!iframe || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(([entry]) => setHostVisible(entry?.isIntersecting ?? true));
    observer.observe(iframe);
    return () => observer.disconnect();
  }, [activeIframeRef]);

  const onLoad = useCallback(() => {
    activeIframeRef.current?.style.setProperty("opacity", hostVisible ? "1" : "0.001");
  }, [activeIframeRef, hostVisible]);

  return (
    <div className={`wave-stage${className ? ` ${className}` : ""}`} style={style}>
      <iframe
        ref={activeIframeRef}
        title="思想银河 · 观点人格卡"
        src={characterWaveUrl}
        sandbox="allow-scripts"
        onLoad={onLoad}
      />
    </div>
  );
}
