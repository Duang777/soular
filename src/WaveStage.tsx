import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import characterWaveSource from "./shaders/character-carousel/sources/character-wave.html?raw";

function buildWaveDocument() {
  const focusStyles = `<style data-character-wave-focus>
:root { --character-carousel-scale: 1; }
html, body, .stage { width: 100%; height: 100%; margin: 0; overflow: hidden; }
.stage { min-height: 0 !important; }
.deck { transform-origin: 50% 50%; }
</style>`;
  return characterWaveSource
    .replace(/<script[^>]+cloudflareinsights\.com[^>]*><\/script>/gi, "")
    .replace("</head>", `${focusStyles}</head>`);
}

export function WaveStage({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [hostVisible, setHostVisible] = useState(true);
  const source = useMemo(() => buildWaveDocument(), []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(([entry]) => setHostVisible(entry?.isIntersecting ?? true));
    observer.observe(iframe);
    return () => observer.disconnect();
  }, []);

  const onLoad = useCallback(() => {
    iframeRef.current?.style.setProperty("opacity", hostVisible ? "1" : "0.001");
  }, [hostVisible]);

  return (
    <div className={`wave-stage${className ? ` ${className}` : ""}`} style={style}>
      <iframe
        ref={iframeRef}
        title="银河的故事 · 观点人格卡"
        srcDoc={source}
        sandbox="allow-scripts"
        onLoad={onLoad}
      />
    </div>
  );
}
