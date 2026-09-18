import {
  Component,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import {
  StructureFlowCollection,
  TextAnimationCollection,
} from "@designcodeio/threeui";
import "@designcodeio/threeui/style.css";

class SceneErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed
      ? <div className="threeui-background" />
      : this.props.children;
  }
}

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reducedMotion;
}

export function Scene() {
  const reducedMotion = useReducedMotion();

  return (
    <div className="shader-frame">
      {reducedMotion ? (
        <div className="threeui-background" />
      ) : (
        <SceneErrorBoundary>
          <StructureFlowCollection
            variant="structure-flow"
            speed={1.00}
            pointSize={0.080}
            opacity={0.40}
            maskStart={0.20}
            maskSolid={0.50}
          />
        </SceneErrorBoundary>
      )}
    </div>
  );
}

export function WordmarkScene() {
  return (
    <div className="shader-frame">
      <SceneErrorBoundary>
        <TextAnimationCollection
          variant="particle-wordmark"
          mode="dark"
          hue={0}
          saturation={1.00}
          brightness={1.00}
        />
      </SceneErrorBoundary>
    </div>
  );
}

const journey = [
  {
    number: "01",
    title: "看见分歧",
    copy: "把一场讨论压缩成连续的观点光谱，先看清主要立场如何分布。",
  },
  {
    number: "02",
    title: "找到坐标",
    copy: "沿着真实回答阅读、表态，让选择逐步形成属于你的观点星位。",
  },
  {
    number: "03",
    title: "遇见同频",
    copy: "比较彼此的距离，在相近、相反与中间地带发现值得认识的人。",
  },
] as const;

export function Landing() {
  return (
    <div className="landing-root">
      <a className="landing-skip" href="#landing-story">
        跳到产品介绍
      </a>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero__scene" aria-hidden="true">
          <Scene />
        </div>
        <div className="landing-hero__shade" aria-hidden="true" />

        <header className="landing-nav">
          <Link className="landing-brand" to="/" aria-label="进入思想银河">
            <img src={`${import.meta.env.BASE_URL}brand/soular-mark.svg`} alt="" />
            <span>
              <strong>思想银河</strong>
              <small>SOULAR</small>
            </span>
          </Link>
          <span className="landing-nav__edition">知乎黑客松 2026</span>
        </header>

        <div className="landing-hero__content">
          <p className="landing-kicker">
            <span aria-hidden="true" />
            真实观点构成的可探索宇宙
          </p>
          <h1 id="landing-title">思想银河</h1>
          <p className="landing-lead">
            把一场讨论，变成一张可以漫游的观点地图。
            看见分歧，找到自己的坐标，也找到与你同频的人。
          </p>
          <div className="landing-actions">
            <Link className="landing-cta" to="/">
              <span>进入思想银河</span>
              <span className="landing-cta__arrow" aria-hidden="true">↗</span>
            </Link>
            <a className="landing-story-link" href="#landing-story">
              了解它如何工作
            </a>
          </div>
        </div>

        <div className="landing-hero__footer" aria-hidden="true">
          <span>观点 / 立场 / 连接</span>
          <span>SCROLL TO EXPLORE</span>
        </div>
      </section>

      <main id="landing-story">
        <section className="landing-manifesto" aria-labelledby="landing-manifesto-title">
          <div className="landing-section-label">
            <span>01</span>
            <p>不是又一条信息流</p>
          </div>
          <div className="landing-manifesto__copy">
            <h2 id="landing-manifesto-title">
              讨论不该只剩下
              <br />
              一条向下滑动的长河。
            </h2>
            <p>
              热门问题里有共识，也有冲突、犹疑和岔路。思想银河用 AI 提炼结构，
              再把真实回答放回可以观察、阅读和核验的位置。
            </p>
          </div>
        </section>

        <section className="landing-journey" aria-labelledby="landing-journey-title">
          <div className="landing-section-label landing-section-label--dark">
            <span>02</span>
            <p>一次探索的路径</p>
          </div>
          <h2 id="landing-journey-title">从围观讨论，到认出彼此。</h2>
          <div className="landing-journey__steps">
            {journey.map((step) => (
              <article key={step.number} className="landing-step">
                <span>{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-wordmark-page" aria-labelledby="landing-wordmark-title">
          <div className="landing-section-label landing-section-label--dark">
            <span>03</span>
            <p id="landing-wordmark-title">开放代码，继续探索</p>
          </div>

          <div className="landing-wordmark-page__animation" role="img" aria-label="Soular">
            <WordmarkScene />
          </div>

          <footer className="landing-wordmark-page__footer">
            <p>让真实观点被看见，也让实现可以被阅读。</p>
            <nav className="landing-wordmark-page__actions" aria-label="项目入口">
              <a
                className="landing-wordmark-page__link"
                href="https://github.com/Duang777/soular"
                target="_blank"
                rel="noreferrer"
              >
                <span>GitHub</span>
                <span aria-hidden="true">↗</span>
              </a>
              <Link className="landing-footer-cta" to="/">
                <span>进入思想银河</span>
                <span aria-hidden="true">→</span>
              </Link>
            </nav>
          </footer>
        </section>
      </main>
    </div>
  );
}
