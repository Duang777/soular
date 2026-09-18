import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import { asset } from "./cast";

const OPENING_STORAGE_KEY = "soular:opening:zhihu-nebula:v1";
const OPENING_DURATION_MS = 8_400;
const EXIT_DURATION_MS = 620;

type OpeningPhase = "zhihu" | "spectrum" | "galaxy" | "reveal";
type OpeningVisibility = "active" | "exiting" | "done";

type Particle = {
  startX: number;
  startY: number;
  radiusSeed: number;
  angleSeed: number;
  driftSeed: number;
  colorIndex: number;
  size: number;
};

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function easeInOut(value: number) {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
}

function mix(from: number, to: number, amount: number) {
  return from + (to - from) * amount;
}

function seeded(index: number, salt: number) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43_758.5453;
  return value - Math.floor(value);
}

function createParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, index) => ({
    startX: seeded(index, 1),
    startY: seeded(index, 2),
    radiusSeed: seeded(index, 3),
    angleSeed: seeded(index, 4),
    driftSeed: seeded(index, 5),
    colorIndex: index % 7,
    size: 0.7 + seeded(index, 6) * 1.7,
  }));
}

function drawFrame(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  particles: Particle[],
  progress: number,
) {
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#05070a";
  context.fillRect(0, 0, width, height);

  const centerX = width * 0.5;
  const centerY = height * 0.48;
  const shortEdge = Math.min(width, height);
  const markBlend = easeInOut(progress / 0.18);
  const spectrumBlend = easeInOut((progress - 0.24) / 0.24);
  const galaxyBlend = easeInOut((progress - 0.5) / 0.3);
  const spectrumAlpha = clamp(1 - Math.abs(progress - 0.43) / 0.19);
  const galaxyAlpha = clamp((progress - 0.48) / 0.24);

  if (spectrumAlpha > 0) {
    context.save();
    context.globalAlpha = spectrumAlpha * 0.64;
    context.strokeStyle = "#4173a7";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(width * 0.12, centerY);
    context.lineTo(width * 0.88, centerY);
    context.stroke();
    context.fillStyle = "#c4a574";
    context.fillRect(centerX - 2, centerY - 2, 4, 4);
    context.restore();
  }

  if (galaxyAlpha > 0) {
    const glow = context.createRadialGradient(
      centerX,
      centerY,
      0,
      centerX,
      centerY,
      shortEdge * 0.19,
    );
    glow.addColorStop(0, "rgba(23,114,246,0.24)");
    glow.addColorStop(0.45, "rgba(23,114,246,0.08)");
    glow.addColorStop(1, "rgba(23,114,246,0)");
    context.globalAlpha = galaxyAlpha;
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);
    context.globalAlpha = 1;
  }

  const maxRadius = Math.min(width * 0.44, height * 0.48);
  particles.forEach((particle, index) => {
    const startX = particle.startX * width;
    const startY = particle.startY * height;

    const markAngle = particle.angleSeed * Math.PI * 2;
    const markRadius = 28 + particle.radiusSeed * shortEdge * 0.16;
    const markX = centerX + Math.cos(markAngle) * markRadius;
    const markY = centerY + Math.sin(markAngle) * markRadius * 0.72;

    const spectrumX = width * (0.12 + particle.radiusSeed * 0.76);
    const spectrumY = centerY +
      (particle.driftSeed - 0.5) * height * 0.16 +
      Math.sin(markAngle * 2) * 8;

    const arm = index % 2;
    const galaxyRadius = Math.pow(particle.radiusSeed, 0.62) * maxRadius;
    const galaxyAngle = (
      particle.radiusSeed * Math.PI * 5.8 +
      arm * Math.PI +
      progress * 0.72 +
      particle.driftSeed * 0.42
    );
    const galaxyX = centerX +
      Math.cos(galaxyAngle) * galaxyRadius +
      (particle.driftSeed - 0.5) * 18;
    const galaxyY = centerY +
      Math.sin(galaxyAngle) * galaxyRadius * 0.43 +
      (particle.angleSeed - 0.5) * 12;

    const enteringX = mix(startX, markX, markBlend);
    const enteringY = mix(startY, markY, markBlend);
    const spectrumStageX = mix(enteringX, spectrumX, spectrumBlend);
    const spectrumStageY = mix(enteringY, spectrumY, spectrumBlend);
    const x = mix(spectrumStageX, galaxyX, galaxyBlend);
    const y = mix(spectrumStageY, galaxyY, galaxyBlend);
    const alpha = clamp(progress / 0.08) *
      (0.28 + particle.driftSeed * 0.68);

    if (galaxyAlpha > 0.35 && index % 17 === 0) {
      context.save();
      context.globalAlpha = galaxyAlpha * 0.11;
      context.strokeStyle = particle.colorIndex === 0 ? "#c4a574" : "#69a5ff";
      context.lineWidth = 0.65;
      context.beginPath();
      context.moveTo(centerX, centerY);
      context.lineTo(x, y);
      context.stroke();
      context.restore();
    }

    const colors = [
      "#c4a574",
      "#1772f6",
      "#69a5ff",
      "#f3f0e9",
      "#1772f6",
      "#8ebfff",
      "#d8e8ff",
    ];
    context.save();
    context.globalAlpha = alpha;
    context.fillStyle = colors[particle.colorIndex];
    context.beginPath();
    context.arc(x, y, particle.size, 0, Math.PI * 2);
    context.fill();
    context.restore();
  });

  if (galaxyAlpha > 0.25) {
    context.save();
    context.globalAlpha = galaxyAlpha;
    context.fillStyle = "#f3f0e9";
    context.beginPath();
    context.arc(centerX, centerY, 2.8, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(105,165,255,0.46)";
    context.lineWidth = 1;
    context.beginPath();
    context.ellipse(centerX, centerY, 56, 20, -0.16, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }
}

function canShowOpening(pathname: string, search: string) {
  if (pathname !== "/") return false;
  const params = new URLSearchParams(search);
  if (
    params.get("confirm") === "1" ||
    params.get("explore") === "1" ||
    params.has("login") ||
    params.has("oauth")
  ) {
    return false;
  }
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return false;
  }
  if (params.get("intro") === "1") return true;
  try {
    return window.sessionStorage.getItem(OPENING_STORAGE_KEY) !== "seen";
  } catch {
    return true;
  }
}

export function OpeningExperience({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [visibility, setVisibility] = useState<OpeningVisibility>(() =>
    canShowOpening(location.pathname, location.search) ? "active" : "done"
  );
  const [phase, setPhase] = useState<OpeningPhase>("zhihu");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const finishedRef = useRef(false);
  const completionTimerRef = useRef<number | null>(null);
  const openingVisible = visibility !== "done";

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    try {
      window.sessionStorage.setItem(OPENING_STORAGE_KEY, "seen");
    } catch {
      // 会话存储不可用时仍允许进入首页。
    }
    setVisibility("exiting");
    completionTimerRef.current = window.setTimeout(() => {
      setVisibility("done");
    }, EXIT_DURATION_MS);
  }, []);

  useEffect(() => {
    if (!openingVisible) return undefined;
    skipRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [finish, openingVisible]);

  useEffect(() => {
    if (visibility !== "active") return undefined;
    const phaseTimers = [
      window.setTimeout(() => setPhase("spectrum"), 2_200),
      window.setTimeout(() => setPhase("galaxy"), 4_300),
      window.setTimeout(() => setPhase("reveal"), 6_400),
      window.setTimeout(finish, OPENING_DURATION_MS),
    ];
    return () => phaseTimers.forEach(window.clearTimeout);
  }, [finish, visibility]);

  useEffect(() => {
    if (visibility !== "active") return undefined;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      finish();
      return undefined;
    }

    let animationFrame = 0;
    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    const startedAt = performance.now();

    const resize = () => {
      width = Math.max(1, window.innerWidth);
      height = Math.max(1, window.innerHeight);
      const deviceScale = Math.min(window.devicePixelRatio || 1, 1.75);
      canvas.width = Math.round(width * deviceScale);
      canvas.height = Math.round(height * deviceScale);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
      const particleCount = width < 600 ? 150 : 260;
      particles = createParticles(particleCount);
    };

    const render = (now: number) => {
      const progress = clamp((now - startedAt) / OPENING_DURATION_MS);
      drawFrame(context, width, height, particles, progress);
      animationFrame = window.requestAnimationFrame(render);
    };

    resize();
    window.addEventListener("resize", resize);
    animationFrame = window.requestAnimationFrame(render);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
    };
  }, [finish, visibility]);

  useEffect(() => () => {
    if (completionTimerRef.current !== null) {
      window.clearTimeout(completionTimerRef.current);
    }
  }, []);

  return (
    <>
      <div
        className="soular-app-layer"
        aria-hidden={openingVisible ? true : undefined}
        inert={openingVisible ? true : undefined}
      >
        {visibility === "active" ? null : children}
      </div>
      {openingVisible ? (
        <section
          className={`soular-opening${visibility === "exiting" ? " soular-opening--exiting" : ""}`}
          data-phase={phase}
          role="dialog"
          aria-modal="true"
          aria-labelledby="soular-opening-title"
        >
          <canvas ref={canvasRef} className="soular-opening__canvas" aria-hidden="true" />
          <header className="soular-opening__header">
            <div className="soular-opening__partnership" aria-label="知乎与思想银河">
              <span className="soular-opening__zhihu-word">知乎</span>
              <i aria-hidden="true">×</i>
              <img src={asset("brand/soular-mark.svg")} alt="" />
              <span>SOULAR</span>
            </div>
            <button ref={skipRef} type="button" onClick={finish}>
              跳过开场 <span aria-hidden="true">↗</span>
            </button>
          </header>

          <div className="soular-opening__story">
            <div className="soular-opening__zhihu-lockup" aria-hidden={phase !== "zhihu"}>
              <span>知</span>
              <b>知乎</b>
            </div>

            <div className="soular-opening__question" aria-hidden={phase !== "spectrum"}>
              <p>ZHIHU DISCUSSION</p>
              <h1 id="soular-opening-title">
                一个问题，
                <br />
                容得下多少种答案？
              </h1>
              <div className="soular-opening__axis" aria-hidden="true">
                <span>不同立场</span>
                <i />
                <span>真实回答</span>
              </div>
            </div>

            <div className="soular-opening__galaxy-copy" aria-hidden={phase !== "galaxy"}>
              <p>观点不是一条队伍</p>
              <strong>它们会形成一片星系</strong>
            </div>

            <div className="soular-opening__reveal" aria-hidden={phase !== "reveal"}>
              <img src={asset("brand/soular-mark.svg")} alt="" />
              <p>知乎讨论 · 观点星云</p>
              <h2>思想银河</h2>
              <span>让每一种观点，都有自己的坐标。</span>
              <button type="button" onClick={finish}>
                进入思想银河 <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>

          <footer className="soular-opening__footer">
            <ol aria-label="开场进度">
              <li data-active={phase === "zhihu"}><span>01</span> 问题</li>
              <li data-active={phase === "spectrum"}><span>02</span> 立场</li>
              <li data-active={phase === "galaxy"}><span>03</span> 星云</li>
              <li data-active={phase === "reveal"}><span>04</span> 相遇</li>
            </ol>
            <p>SOULAR · IDEAS IN ORBIT</p>
          </footer>
        </section>
      ) : null}
    </>
  );
}
