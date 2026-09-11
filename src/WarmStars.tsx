import { useEffect, useRef } from "react";

type Star = {
  x: number;
  y: number;
  r: number;
  color: string;
  phase: number;
  speed: number;
  base: number;
  cross: boolean;
};

const PALETTE = ["#f6ead2", "#eedcb8", "#e7cd9c", "#dcc18c", "#e8d3ac"];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeStars(count: number, seed: number): Star[] {
  const rand = mulberry32(seed);
  const stars: Star[] = [];
  for (let i = 0; i < count; i += 1) {
    const bright = rand();
    stars.push({
      x: rand(),
      y: Math.pow(rand(), 0.95) * 0.98,
      r: 0.9 + bright * 1.6,
      color: PALETTE[Math.floor(rand() * PALETTE.length)],
      phase: rand() * Math.PI * 2,
      speed: 0.4 + rand() * 0.9,
      base: 0.5 + rand() * 0.34,
      cross: bright > 0.78,
    });
  }
  return stars;
}

export function WarmStars({
  count = 38,
  seed = 20260911,
  className = "",
}: {
  count?: number;
  seed?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    const reduce = typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stars = makeStars(count, seed);
    let width = 0;
    let height = 0;
    let raf = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reduce) draw(performance.now() * 0.001 + 2.2);
    };

    const drawCross = (x: number, y: number, r: number, alpha: number) => {
      const len = r * 5.2;
      const grad = (sx: number, sy: number, ex: number, ey: number) => {
        const g = ctx.createLinearGradient(x + sx * len, y + sy * len, x + ex * len, y + ey * len);
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(0.5, `rgba(244, 226, 190, ${0.75 * alpha})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.strokeStyle = g;
        ctx.beginPath();
        ctx.moveTo(x + sx * len, y + sy * len);
        ctx.lineTo(x + ex * len, y + ey * len);
        ctx.stroke();
      };
      ctx.lineWidth = 1.1;
      grad(-1, 0, 1, 0);
      grad(0, -1, 0, 1);
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, width, height);
      stars.forEach((s) => {
        const tw = reduce ? 0.9 : 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
        const alpha = Math.min(1, s.base * tw);
        const x = s.x * width;
        const y = s.y * height;
        const haloR = s.r * 3.6;
        const glow = ctx.createRadialGradient(x, y, 0, x, y, haloR);
        glow.addColorStop(0, s.color);
        glow.addColorStop(0.35, s.color);
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.globalAlpha = alpha;
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, haloR, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = Math.min(1, alpha * 1.35);
        ctx.fillStyle = "#fffaf0";
        ctx.beginPath();
        ctx.arc(x, y, s.r * 0.68, 0, Math.PI * 2);
        ctx.fill();
        if (s.cross) {
          ctx.globalAlpha = Math.min(1, alpha * 1.1);
          drawCross(x, y, s.r, tw);
        }
      });
      ctx.globalAlpha = 1;
    };

    const loop = (now: number) => {
      draw(now * 0.001);
      raf = requestAnimationFrame(loop);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    if (!reduce) raf = requestAnimationFrame(loop);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [count, seed]);

  return <canvas ref={canvasRef} className={`warm-stars${className ? ` ${className}` : ""}`} aria-hidden="true" />;
}
