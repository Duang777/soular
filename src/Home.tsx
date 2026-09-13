import { useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CASTS } from "./cast";
import { AppChrome } from "./AppChrome";
import { GalaxyShowcase } from "./GalaxyShowcase";
import { WaveStage } from "./WaveStage";

const FLOW_STEPS = [
  { title: "看见分布", copy: "把数百条回答压成一张立场星图" },
  { title: "留下坐标", copy: "点赞认同的观点，星位随之移动" },
  { title: "带走人格", copy: "沉淀为可分享的观点人格卡" },
];

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
    <div className="home-shell">
      <WaveStage className="home-shell__stage" iframeRef={waveFrameRef} />
      <div className="home-shell__veil" aria-hidden="true" />
      <AppChrome />
      <main className="home-landing">
        <section className="home-hero">
          <p className="home-hero__eyebrow">知乎讨论 · 观点光谱 · 可探索星图</p>
          <h1 className="home-hero__title">
            把一场讨论，
            <br />
            变成一张可漫游的<span>观点地图</span>
          </h1>
          <p className="home-hero__lede">
            每颗星对应一条真实或示例回答，位置代表立场，距离呈现分歧。
            沿光谱阅读、点赞比较，最后找到自己在讨论中的坐标。
          </p>
          <ol className="home-flow" aria-label="体验流程">
            {FLOW_STEPS.map((step, index) => (
              <li key={step.title} className="home-flow__item">
                <span className="home-flow__index" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="home-flow__copy">
                  <b>{step.title}</b>
                  <small>{step.copy}</small>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <GalaxyShowcase />

        <section className="home-secondary" aria-label="人格卡入口">
          <div className="home-secondary__copy">
            <p className="home-secondary__eyebrow">九派人格书架</p>
            <h2>先翻翻人格卡，再进星云点赞</h2>
            <p>下方波浪带可试读九种观点人格。进入星云后，点赞会让星位更贴近你的立场。</p>
          </div>
          <Link to="/nebula?preset=ai-math" className="home-cta">
            <span className="home-cta__glyph" aria-hidden="true">✦</span>
            <span className="home-cta__copy">
              <b>进入观点星云</b>
              <small>从 AI 与数学的真实讨论开始</small>
            </span>
            <span className="home-cta__arrow" aria-hidden="true">→</span>
          </Link>
        </section>
      </main>
    </div>
  );
}
