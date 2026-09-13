import { useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CASTS } from "./cast";
import { OAuthAccount } from "./OAuthAccount";
import { WaveStage } from "./WaveStage";

export function Home() {
  const navigate = useNavigate();
  const waveFrameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    try {
      window.sessionStorage.setItem("jiupai:lobby", "/");
    } catch {
      // 存储不可用时仍保留 iframe 导航。
    }
    function onMessage(event: MessageEvent) {
      if (event.source !== waveFrameRef.current?.contentWindow) return;
      const cast = event.data?.cast;
      if (event.data?.type !== "wave-open" || typeof cast !== "string") return;
      if (!CASTS.some((item) => item.key === cast)) return;
      navigate(`/shelf/${cast}?peek=1`);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [navigate]);

  return (
    <>
      <WaveStage iframeRef={waveFrameRef} />
      <OAuthAccount />
      <Link to="/nebula" className="nebula-entry" aria-label="进入观点星云，抽取我的人格卡">
        <span className="nebula-entry__star" aria-hidden="true">✦</span>
        <span className="nebula-entry__copy">
          <b>进入观点星云</b>
          <small>点赞形成星位 · 抽我的人格卡</small>
        </span>
        <span className="nebula-entry__arrow" aria-hidden="true">→</span>
      </Link>
    </>
  );
}
