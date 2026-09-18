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
const OPENING_SOUND_VOLUME = 0.72;
const OPENING_CUES_MS = {
  zhihuGatherStart: 250,
  zhihuGatherEnd: 1_650,
  soularStart: 1_850,
  soular: 2_650,
  partnershipStart: 3_550,
  partnership: 4_350,
  reveal: 5_500,
  galaxySettle: 7_000,
} as const;
const RESIZE_DEBOUNCE_MS = 120;
const MAX_CANVAS_PIXELS = 4_000_000;

type OpeningPhase = "zhihu" | "soular" | "partnership" | "reveal";
type OpeningVisibility = "active" | "exiting" | "done";

type Point = Readonly<{
  x: number;
  y: number;
}>;

type Particle = {
  startX: number;
  startY: number;
  zhihuX: number;
  zhihuY: number;
  soularX: number;
  soularY: number;
  partnershipX: number;
  partnershipY: number;
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

function openingStageScale(width: number, height: number) {
  return Math.max(1, Math.min(width / 1_280, height / 720, 2.8));
}

function sampleWordmark({
  text,
  width,
  height,
  fontSize,
  step,
}: {
  text: string;
  width: number;
  height: number;
  fontSize: number;
  step: number;
}): Point[] {
  const mask = document.createElement("canvas");
  const maskHeight = Math.min(height, Math.ceil(fontSize * 1.5));
  mask.width = width;
  mask.height = maskHeight;
  const context = mask.getContext("2d", { willReadFrequently: true });
  if (!context) return [];

  context.clearRect(0, 0, width, maskHeight);
  context.fillStyle = "#ffffff";
  context.font = `700 ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, width * 0.5, maskHeight * 0.5);

  let pixels: Uint8ClampedArray;
  try {
    pixels = context.getImageData(0, 0, width, maskHeight).data;
  } catch {
    return [];
  }
  const points: Point[] = [];
  const targetOffsetY = height * 0.48 - maskHeight * 0.5;
  for (let y = 0; y < maskHeight; y += step) {
    for (let x = 0; x < width; x += step) {
      const alphaIndex = (y * width + x) * 4 + 3;
      if (pixels[alphaIndex] > 96) points.push({ x, y: y + targetOffsetY });
    }
  }
  return points;
}

function targetAt(points: Point[], index: number, offset: number, fallback: Point) {
  if (points.length === 0) return fallback;
  return points[(index * 47 + offset) % points.length];
}

function createParticles({
  count,
  width,
  height,
}: {
  count: number;
  width: number;
  height: number;
}): Particle[] {
  const compact = width < 600;
  const tablet = width >= 600 && width < 1000;
  const stageScale = openingStageScale(width, height);
  const sampleStep = compact ? 3 : 4;
  const zhihuPoints = sampleWordmark({
    text: "知乎",
    width,
    height,
    fontSize: Math.round((compact ? 128 : tablet ? 170 : 220) * stageScale),
    step: sampleStep,
  });
  const soularPoints = sampleWordmark({
    text: "思想银河",
    width,
    height,
    fontSize: Math.round((compact ? 68 : tablet ? 104 : 146) * stageScale),
    step: sampleStep,
  });
  const partnershipPoints = sampleWordmark({
    text: "知乎 × 思想银河",
    width,
    height,
    fontSize: Math.round((compact ? 42 : tablet ? 70 : 100) * stageScale),
    step: sampleStep,
  });
  const fallback = { x: width * 0.5, y: height * 0.48 };

  return Array.from({ length: count }, (_, index) => {
    const zhihu = targetAt(zhihuPoints, index, 3, fallback);
    const soular = targetAt(soularPoints, index, 17, fallback);
    const partnership = targetAt(partnershipPoints, index, 29, fallback);
    return {
      startX: seeded(index, 1),
      startY: seeded(index, 2),
      zhihuX: zhihu.x,
      zhihuY: zhihu.y,
      soularX: soular.x,
      soularY: soular.y,
      partnershipX: partnership.x,
      partnershipY: partnership.y,
      radiusSeed: seeded(index, 3),
      angleSeed: seeded(index, 4),
      driftSeed: seeded(index, 5),
      colorIndex: index % 7,
      size: 0.65 + seeded(index, 6) * 1.15,
    };
  });
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
  const stageScale = openingStageScale(width, height);
  const elapsed = progress * OPENING_DURATION_MS;
  const cue = (start: number, end: number) =>
    (elapsed - start) / (end - start);
  const zhihuBlend = easeInOut(
    cue(OPENING_CUES_MS.zhihuGatherStart, OPENING_CUES_MS.zhihuGatherEnd),
  );
  const soularBlend = easeInOut(
    cue(OPENING_CUES_MS.soularStart, OPENING_CUES_MS.soular),
  );
  const partnershipBlend = easeInOut(
    cue(OPENING_CUES_MS.partnershipStart, OPENING_CUES_MS.partnership),
  );
  const galaxyCue = cue(OPENING_CUES_MS.reveal, OPENING_CUES_MS.galaxySettle);
  const galaxyBlend = easeInOut(galaxyCue);
  const galaxyAlpha = clamp(galaxyCue);

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

  const maxRadius = Math.min(width * 0.5, height * 0.54);
  particles.forEach((particle, index) => {
    const startX = particle.startX * width;
    const startY = particle.startY * height;

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
      (particle.driftSeed - 0.5) * 18 * stageScale;
    const galaxyY = centerY +
      Math.sin(galaxyAngle) * galaxyRadius * 0.43 +
      (particle.angleSeed - 0.5) * 12 * stageScale;

    const zhihuX = mix(startX, particle.zhihuX, zhihuBlend);
    const zhihuY = mix(startY, particle.zhihuY, zhihuBlend);
    const soularX = mix(zhihuX, particle.soularX, soularBlend);
    const soularY = mix(zhihuY, particle.soularY, soularBlend);
    const partnershipX = mix(
      soularX,
      particle.partnershipX,
      partnershipBlend,
    );
    const partnershipY = mix(
      soularY,
      particle.partnershipY,
      partnershipBlend,
    );
    const shimmer = Math.sin(
      progress * Math.PI * 18 + particle.angleSeed * Math.PI * 2,
    ) * (1 - galaxyBlend) * 0.8;
    const x = mix(partnershipX + shimmer, galaxyX, galaxyBlend);
    const y = mix(partnershipY - shimmer, galaxyY, galaxyBlend);
    const textAlpha = 0.68 + particle.driftSeed * 0.32;
    const alpha = clamp(progress / 0.06) *
      mix(textAlpha, 0.3 + particle.driftSeed * 0.66, galaxyBlend);

    if (galaxyAlpha > 0.35 && index % 17 === 0) {
      context.save();
      context.globalAlpha = galaxyAlpha * 0.11;
      context.strokeStyle = particle.colorIndex === 0 ? "#c4a574" : "#69a5ff";
      context.lineWidth = 0.65 * Math.min(stageScale, 1.8);
      context.beginPath();
      context.moveTo(centerX, centerY);
      context.lineTo(x, y);
      context.stroke();
      context.restore();
    }

    const textColors = ["#ffffff", "#1772f6", "#ffffff", "#8ebfff"];
    const galaxyColors = [
      "#c4a574",
      "#1772f6",
      "#69a5ff",
      "#f3f0e9",
      "#1772f6",
      "#8ebfff",
      "#d8e8ff",
    ];
    const color = galaxyBlend < 0.45
      ? textColors[particle.colorIndex % textColors.length]
      : galaxyColors[particle.colorIndex];
    context.save();
    context.globalAlpha = alpha;
    context.fillStyle = color;
    context.beginPath();
    context.arc(
      x,
      y,
      mix(particle.size, particle.size * 1.4, galaxyBlend) * Math.min(stageScale, 2),
      0,
      Math.PI * 2,
    );
    context.fill();
    context.restore();
  });

  if (galaxyAlpha > 0.25) {
    context.save();
    context.globalAlpha = galaxyAlpha;
    context.fillStyle = "#f3f0e9";
    context.beginPath();
    context.arc(centerX, centerY, 2.8 * stageScale, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(105,165,255,0.46)";
    context.lineWidth = Math.min(stageScale, 2);
    context.beginPath();
    context.ellipse(
      centerX,
      centerY,
      56 * stageScale,
      20 * stageScale,
      -0.16,
      0,
      Math.PI * 2,
    );
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
  const audioRef = useRef<HTMLAudioElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const openingStartedAtRef = useRef(0);
  const finishedRef = useRef(false);
  const completionTimerRef = useRef<number | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const locationKey = `${location.pathname}\n${location.search}`;
  const previousLocationRef = useRef({
    key: locationKey,
    pathname: location.pathname,
  });
  const explicitReplay = new URLSearchParams(location.search).get("intro") === "1";
  const locationChanged = previousLocationRef.current.key !== locationKey;
  const routeRestartPending = locationChanged &&
    canShowOpening(location.pathname, location.search) &&
    (previousLocationRef.current.pathname === "/landing" || explicitReplay);
  const openingActive = visibility === "active" || routeRestartPending;
  const openingVisible = visibility !== "done" || routeRestartPending;

  const clearCompletionTimer = useCallback(() => {
    if (completionTimerRef.current === null) return;
    window.clearTimeout(completionTimerRef.current);
    completionTimerRef.current = null;
  }, []);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    audioRef.current?.pause();
    try {
      window.sessionStorage.setItem(OPENING_STORAGE_KEY, "seen");
    } catch {
      // 会话存储不可用时仍允许进入首页。
    }
    setVisibility("exiting");
    clearCompletionTimer();
    completionTimerRef.current = window.setTimeout(() => {
      completionTimerRef.current = null;
      setVisibility("done");
    }, EXIT_DURATION_MS);
  }, [clearCompletionTimer]);

  useEffect(() => {
    if (!locationChanged) return;
    const previousPathname = previousLocationRef.current.pathname;
    previousLocationRef.current = {
      key: locationKey,
      pathname: location.pathname,
    };

    if (!canShowOpening(location.pathname, location.search)) {
      clearCompletionTimer();
      finishedRef.current = false;
      setPhase("zhihu");
      setVisibility("done");
      return;
    }

    if (previousPathname !== "/landing" && !explicitReplay) return;

    clearCompletionTimer();
    finishedRef.current = false;
    setPhase("zhihu");
    setVisibility("active");
  }, [
    clearCompletionTimer,
    explicitReplay,
    location.pathname,
    location.search,
    locationChanged,
    locationKey,
  ]);

  useEffect(() => {
    if (!openingVisible) return undefined;
    skipRef.current?.focus();
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
    };
    const onMotionPreferenceChange = (event: MediaQueryListEvent) => {
      if (event.matches) finish();
    };
    window.addEventListener("keydown", onKeyDown);
    motionPreference.addEventListener("change", onMotionPreferenceChange);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      motionPreference.removeEventListener("change", onMotionPreferenceChange);
    };
  }, [finish, openingVisible]);

  useEffect(() => {
    if (visibility !== "active") return undefined;
    openingStartedAtRef.current = performance.now();
    const phaseTimers = [
      window.setTimeout(() => setPhase("soular"), OPENING_CUES_MS.soular),
      window.setTimeout(() => setPhase("partnership"), OPENING_CUES_MS.partnership),
      window.setTimeout(() => setPhase("reveal"), OPENING_CUES_MS.reveal),
      window.setTimeout(finish, OPENING_DURATION_MS),
    ];
    return () => phaseTimers.forEach(window.clearTimeout);
  }, [finish, visibility]);

  useEffect(() => {
    if (visibility !== "active") return undefined;
    const audio = audioRef.current;
    if (!audio) return undefined;
    setSoundEnabled(true);
    audio.currentTime = 0;
    audio.volume = OPENING_SOUND_VOLUME;
    void audio.play().catch(() => undefined);
    const resumeOnFirstGesture = () => {
      if (!audio.paused) return;
      const elapsed = Math.max(0, (performance.now() - openingStartedAtRef.current) / 1_000);
      const duration = Number.isFinite(audio.duration)
        ? audio.duration
        : OPENING_DURATION_MS / 1_000;
      audio.currentTime = Math.min(elapsed, Math.max(0, duration - 0.05));
      void audio.play().catch(() => undefined);
    };
    window.addEventListener("pointerdown", resumeOnFirstGesture, { once: true });
    return () => {
      window.removeEventListener("pointerdown", resumeOnFirstGesture);
      audio.pause();
      audio.currentTime = 0;
    };
  }, [visibility]);

  const toggleSound = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (soundEnabled) {
      audio.pause();
      setSoundEnabled(false);
      return;
    }
    const elapsed = Math.max(0, (performance.now() - openingStartedAtRef.current) / 1_000);
    const duration = Number.isFinite(audio.duration)
      ? audio.duration
      : OPENING_DURATION_MS / 1_000;
    audio.currentTime = Math.min(elapsed, Math.max(0, duration - 0.05));
    audio.volume = OPENING_SOUND_VOLUME;
    setSoundEnabled(true);
    void audio.play().catch(() => undefined);
  }, [soundEnabled]);

  useEffect(() => {
    if (visibility !== "active") return undefined;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      try {
        window.sessionStorage.setItem(OPENING_STORAGE_KEY, "seen");
      } catch {
        // 会话存储不可用时仍直接放行首页。
      }
      finishedRef.current = true;
      setVisibility("done");
      return undefined;
    }

    let animationFrame = 0;
    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let resizeTimer = 0;
    const startedAt = performance.now();

    const resize = () => {
      width = Math.max(1, window.innerWidth);
      height = Math.max(1, window.innerHeight);
      const pixelBudgetScale = Math.sqrt(MAX_CANVAS_PIXELS / (width * height));
      const deviceScale = Math.min(
        window.devicePixelRatio || 1,
        1.75,
        Math.max(0.75, pixelBudgetScale),
      );
      canvas.width = Math.round(width * deviceScale);
      canvas.height = Math.round(height * deviceScale);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
      const particleCount = width < 600
        ? 1_000
        : Math.round(1_600 * Math.min(openingStageScale(width, height), 2.4));
      particles = createParticles({ count: particleCount, width, height });
    };

    const scheduleResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resize, RESIZE_DEBOUNCE_MS);
    };

    const render = (now: number) => {
      const progress = clamp((now - startedAt) / OPENING_DURATION_MS);
      drawFrame(context, width, height, particles, progress);
      animationFrame = window.requestAnimationFrame(render);
    };

    resize();
    window.addEventListener("resize", scheduleResize);
    animationFrame = window.requestAnimationFrame(render);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", scheduleResize);
    };
  }, [finish, visibility]);

  useEffect(() => clearCompletionTimer, [clearCompletionTimer]);

  return (
    <>
      <div
        className="soular-app-layer"
        aria-hidden={openingVisible ? true : undefined}
        inert={openingVisible ? true : undefined}
      >
        {openingActive ? null : children}
      </div>
      {openingVisible ? (
        <section
          className={`soular-opening${visibility === "exiting" ? " soular-opening--exiting" : ""}`}
          data-phase={phase}
          role="dialog"
          aria-modal="true"
          aria-labelledby="soular-opening-title"
        >
          <audio
            ref={audioRef}
            src={asset("audio/opening-vienna.mp3")}
            preload="auto"
            aria-hidden="true"
          />
          <canvas ref={canvasRef} className="soular-opening__canvas" aria-hidden="true" />
          <header className="soular-opening__header">
            <div className="soular-opening__partnership" aria-label="知乎与思想银河">
              <span className="soular-opening__zhihu-word">知乎</span>
              <i aria-hidden="true">×</i>
              <img src={asset("brand/soular-mark.svg")} alt="" />
              <span>SOULAR</span>
            </div>
            <div className="soular-opening__header-actions">
              <button
                className="soular-opening__sound"
                type="button"
                aria-label={soundEnabled ? "关闭开场音乐" : "播放开场音乐"}
                aria-pressed={soundEnabled}
                onClick={toggleSound}
              >
                <span aria-hidden="true">♫</span><b>{soundEnabled ? "声音开" : "声音关"}</b>
              </button>
              <button ref={skipRef} type="button" onClick={finish}>
                跳过开场 <span aria-hidden="true">↗</span>
              </button>
            </div>
          </header>

          <div className="soular-opening__story">
            <h1 id="soular-opening-title" className="soular-opening__sr-title">
              知乎与思想银河粒子开场
            </h1>

            <div
              className="soular-opening__particle-caption soular-opening__particle-caption--zhihu"
              aria-hidden={phase !== "zhihu"}
            >
              <p>01 · ZHIHU</p>
              <span>每一个真实回答，正在汇聚</span>
            </div>

            <div
              className="soular-opening__particle-caption soular-opening__particle-caption--soular"
              aria-hidden={phase !== "soular"}
            >
              <p>02 · SOULAR</p>
              <span>每一种观点，开始拥有坐标</span>
            </div>

            <div
              className="soular-opening__particle-caption soular-opening__particle-caption--partnership"
              aria-hidden={phase !== "partnership"}
            >
              <p>03 · 知乎 × 思想银河</p>
              <span>讨论汇入银河，观点彼此照亮</span>
            </div>

            <div className="soular-opening__reveal" aria-hidden={phase !== "reveal"}>
              <div className="soular-opening__reveal-stage">
                <img
                  className="soular-opening__kanshan"
                  src={asset("kanshan/wave.gif")}
                  alt=""
                  aria-hidden="true"
                />
                <div className="soular-opening__reveal-copy">
                  <img src={asset("brand/soular-mark.svg")} alt="" />
                  <p>知乎讨论 · 观点星云</p>
                  <h2>思想银河</h2>
                  <span>让每一种观点，都有自己的坐标。</span>
                </div>
              </div>
              <button type="button" onClick={finish}>
                进入思想银河 <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>

          <footer className="soular-opening__footer">
            <ol aria-label="开场进度">
              <li data-active={phase === "zhihu"}><span>01</span> 知乎</li>
              <li data-active={phase === "soular"}><span>02</span> Soular</li>
              <li data-active={phase === "partnership"}><span>03</span> 联名</li>
              <li data-active={phase === "reveal"}><span>04</span> 相遇</li>
            </ol>
            <p>
              SOULAR · IDEAS IN ORBIT · MUSIC
              {" "}<a href="https://www.fiftysounds.com" target="_blank" rel="noreferrer">FIFTYSOUNDS</a>
            </p>
          </footer>
        </section>
      ) : null}
    </>
  );
}
