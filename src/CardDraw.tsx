import { useEffect, useMemo, useRef, useState } from "react";
import { BrandMark } from "./BrandMark";
import { asset, CASTS, type Cast } from "./cast";
import {
  DEFAULT_NEBULA_PRESET,
  personAvatarFile,
  personByIndex,
  type Person,
  type SelfProfile,
} from "./people";
import { WarmStars } from "./WarmStars";

export type CardSubject =
  | { kind: "self"; preset: string; version?: string; profile?: SelfProfile }
  | { kind: "peek" }
  | { kind: "person"; index: number; preset: string; version?: string; person?: Person };

type DrawMode = "enter" | "revisit";
type Phase = "shuffle" | "flip" | "reveal";

const SHUFFLE_MS = 1900;
const FLIP_MS = 850;
const ENTER_BOOK_MS = 950;

function selfCardQuery(preset: string, version?: string) {
  return `?self=1&preset=${encodeURIComponent(preset)}` +
    (version ? `&version=${encodeURIComponent(version)}` : "");
}

function safeZhihuUrl(value?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && /(^|\.)zhihu\.com$/.test(url.hostname)
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [46, 48, 64];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(hex: string, alpha: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapClaim(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): [string, string?] {
  let line = "";
  const chars = Array.from(text);
  for (const ch of chars) {
    if (ctx.measureText(line + ch).width > maxWidth && line) {
      const rest = text.slice(line.length);
      return [line, rest];
    }
    line += ch;
  }
  return [line];
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number, dy: number, dw: number, dh: number
) {
  const ir = img.width / img.height;
  const dr = dw / dh;
  let sw = img.width;
  let sh = img.height;
  let sx = 0;
  let sy = 0;
  if (ir > dr) {
    sw = img.height * dr;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / dr;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

async function buildPoster(cast: Cast, subject: CardSubject): Promise<string> {
  const flavor = subject.kind;
  const person: Person | null = flavor === "person"
    ? subject.person ?? personByIndex(subject.index)
    : null;
  const isSelf = flavor === "self";
  const selfProfile = flavor === "self" ? subject.profile : undefined;
  const isPeek = flavor === "peek";
  const W = 1080;
  const H = 1440;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");

  const [r, g, b] = hexToRgb(cast.color);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0b0c12");
  bg.addColorStop(0.52, `rgb(${Math.round(r * 0.5)}, ${Math.round(g * 0.5)}, ${Math.round(b * 0.55)})`);
  bg.addColorStop(1, "#07070b");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const halo = ctx.createRadialGradient(W / 2, 560, 40, W / 2, 560, 620);
  halo.addColorStop(0, rgba(cast.color, 0.55));
  halo.addColorStop(1, rgba(cast.color, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(196, 165, 116, 0.55)";
  ctx.lineWidth = 2;
  ctx.strokeRect(48, 48, W - 96, H - 96);
  ctx.strokeStyle = "rgba(196, 165, 116, 0.22)";
  ctx.strokeRect(66, 66, W - 132, H - 132);

  const fontStack = '"PingFang SC", "Noto Sans SC", "Hiragino Sans GB", sans-serif';
  ctx.textAlign = "center";

  ctx.fillStyle = "rgba(243, 240, 233, 0.62)";
  ctx.font = `500 30px ${fontStack}`;
  const posterEyebrow = isSelf
    ? "思想银河 · 银河的故事"
    : isPeek
      ? "思想银河 · 观点人格卡"
      : "思想银河 · 观点星云";
  ctx.fillText(posterEyebrow, W / 2, 132);

  if (!person) {
    const img = await loadImage(asset(`personas/${cast.key}.jpg`));
    const size = 620;
    const ix = (W - size) / 2;
    const iy = 236;
    ctx.save();
    roundRectPath(ctx, ix, iy, size, size, 28);
    ctx.clip();
    ctx.drawImage(img, ix, iy, size, size);
    ctx.restore();
    ctx.strokeStyle = "rgba(243, 240, 233, 0.35)";
    ctx.lineWidth = 3;
    roundRectPath(ctx, ix, iy, size, size, 28);
    ctx.stroke();

    ctx.fillStyle = "#c4a574";
    ctx.font = `500 34px ${fontStack}`;
    ctx.fillText(cast.volume, W / 2, 952);

    const title = isSelf ? `我是${cast.name}` : cast.name;
    let titleSize = 96;
    do {
      ctx.font = `700 ${titleSize}px ${fontStack}`;
      if (ctx.measureText(title).width <= 884 || titleSize <= 54) break;
      titleSize -= 4;
    } while (titleSize > 54);
    ctx.fillStyle = "#f3f0e9";
    ctx.fillText(title, W / 2, 1078);

    ctx.fillStyle = "rgba(243, 240, 233, 0.78)";
    ctx.font = `400 40px ${fontStack}`;
    ctx.fillText(cast.role, W / 2, 1150);

    if (selfProfile) {
      ctx.fillStyle = "rgba(243, 240, 233, 0.72)";
      ctx.font = `400 27px ${fontStack}`;
      const [line1, line2] = wrapClaim(ctx, selfProfile.claim, 820);
      ctx.fillText(line1, W / 2, 1210);
      if (line2) ctx.fillText(line2, W / 2, 1248);
    }

    ctx.fillStyle = "rgba(196, 165, 116, 0.9)";
    ctx.font = `600 30px ${fontStack}`;
    ctx.fillText("✦ 每个发光头像，都是一种立场", W / 2, selfProfile ? 1302 : 1252);

    ctx.fillStyle = "rgba(243, 240, 233, 0.55)";
    ctx.font = `400 26px ${fontStack}`;
    const posterQuery = isSelf
      ? selfCardQuery(subject.preset, subject.version)
      : "?peek=1";
    ctx.fillText(`${window.location.host}${import.meta.env.BASE_URL}shelf/${cast.key}${posterQuery}`, W / 2, 1342);
  } else {
    const subjectIndex = subject.kind === "person" ? subject.index : 0;
    const [art, ava] = await Promise.all([
      loadImage(asset(`personas/${cast.key}.jpg`)),
      loadImage(asset(personAvatarFile(person, subjectIndex))),
    ]);

    const cardX = 150;
    const cardW = 780;
    const coverY = 218;
    const coverH = 466;
    const seamY = coverY + coverH;
    const panelH = 470;
    const cx = W / 2;

    ctx.save();
    roundRectPath(ctx, cardX, coverY, cardW, coverH + panelH, 30);
    ctx.clip();
    drawImageCover(ctx, art, cardX, coverY, cardW, coverH);
    const fade = ctx.createLinearGradient(0, seamY - 150, 0, seamY + 6);
    fade.addColorStop(0, "rgba(10, 11, 17, 0)");
    fade.addColorStop(1, "rgba(10, 11, 17, 1)");
    ctx.fillStyle = fade;
    ctx.fillRect(cardX, seamY - 150, cardW, 156);
    const panelBg = ctx.createLinearGradient(0, seamY, 0, seamY + panelH);
    panelBg.addColorStop(0, "#0d0e15");
    panelBg.addColorStop(1, "#08090e");
    ctx.fillStyle = panelBg;
    ctx.fillRect(cardX, seamY, cardW, panelH);
    ctx.restore();
    ctx.strokeStyle = "rgba(243, 240, 233, 0.3)";
    ctx.lineWidth = 3;
    roundRectPath(ctx, cardX, coverY, cardW, coverH + panelH, 30);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, seamY, 108, 0, Math.PI * 2);
    ctx.fillStyle = "#0b0c12";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, seamY, 102, 0, Math.PI * 2);
    ctx.lineWidth = 12;
    ctx.strokeStyle = "#c4a574";
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, seamY, 92, 0, Math.PI * 2);
    ctx.clip();
    drawImageCover(ctx, ava, cx - 92, seamY - 92, 184, 184);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, seamY, 92, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(243, 240, 233, 0.85)";
    ctx.stroke();

    ctx.fillStyle = "#c4a574";
    ctx.font = `500 32px ${fontStack}`;
    ctx.fillText(`${cast.volume} · ${cast.name}`, cx, seamY + 126);

    const title = `@${person.name}`;
    let titleSize = 72;
    do {
      ctx.font = `700 ${titleSize}px ${fontStack}`;
      if (ctx.measureText(title).width <= 680 || titleSize <= 46) break;
      titleSize -= 4;
    } while (titleSize > 46);
    ctx.fillStyle = "#f3f0e9";
    ctx.fillText(title, cx, seamY + 204);

    ctx.fillStyle = "rgba(243, 240, 233, 0.74)";
    ctx.font = `400 36px ${fontStack}`;
    ctx.fillText(cast.role, cx, seamY + 258);

    ctx.beginPath();
    ctx.moveTo(cx - 34, seamY + 296);
    ctx.lineTo(cx + 34, seamY + 296);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(196, 165, 116, 0.65)";
    ctx.stroke();

    ctx.fillStyle = "rgba(243, 240, 233, 0.86)";
    ctx.font = `400 31px ${fontStack}`;
    const [line1, line2] = wrapClaim(ctx, person.claim, 660);
    ctx.fillText(`“${line1}${line2 ? "" : "”"}`, cx, seamY + 346);
    if (line2) ctx.fillText(`${line2}”`, cx, seamY + 392);

    ctx.fillStyle = "rgba(196, 165, 116, 0.9)";
    ctx.font = `600 27px ${fontStack}`;
    ctx.fillText("✦ 来观点星云，找你的人格", cx, 1232);

    ctx.fillStyle = "rgba(243, 240, 233, 0.55)";
    ctx.font = `400 26px ${fontStack}`;
    const galaxyQuery = subject.kind === "person"
      ? `?preset=${encodeURIComponent(subject.preset)}`
      : "";
    ctx.fillText(`${window.location.host}${import.meta.env.BASE_URL}nebula${galaxyQuery}`, W / 2, 1384);
  }

  return canvas.toDataURL("image/jpeg", 0.92);
}

export function CardDraw({ cast, subject, mode, onEnter, onClose, onExit }: {
  cast: Cast;
  subject: CardSubject;
  mode: DrawMode;
  onEnter: () => void;
  onClose: () => void;
  onExit: () => void;
}) {
  const reduceMotion = useMemo(prefersReducedMotion, []);
  const person = subject.kind === "person"
    ? subject.person ?? personByIndex(subject.index)
    : null;
  const isSelf = subject.kind === "self";
  const selfPreset = isSelf ? subject.preset : undefined;
  const selfVersion = isSelf ? subject.version : undefined;
  const selfProfile = isSelf ? subject.profile : undefined;
  const isPeek = subject.kind === "peek";
  const personIndex = subject.kind === "person" ? subject.index : 0;
  const personPreset = subject.kind === "person" ? subject.preset : undefined;
  const resultIndex = Math.max(0, CASTS.findIndex((item) => item.key === cast.key));
  const startsFlipped = !!person || isPeek;
  const initialPhase: Phase = mode === "revisit" || reduceMotion
    ? "reveal"
    : startsFlipped ? "flip" : "shuffle";
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [activeDot, setActiveDot] = useState(initialPhase === "flip" ? resultIndex : 0);
  const [leaving, setLeaving] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [copied, setCopied] = useState(false);
  const [posterState, setPosterState] = useState<"idle" | "working" | "done">("idle");
  const timers = useRef<number[]>([]);

  const personName = person ? `@${person.name}` : cast.name;
  const artSrc = asset(`personas/${cast.key}.jpg`);
  const personAvatarSrc = person ? asset(personAvatarFile(person, personIndex)) : null;
  const personSourceUrl = safeZhihuUrl(person?.sourceUrl);

  const shareUrl = useMemo(() => {
    const base = import.meta.env.BASE_URL;
    if (person) {
      return personSourceUrl ??
        `${window.location.origin}${base}nebula?preset=${encodeURIComponent(
          personPreset ?? DEFAULT_NEBULA_PRESET,
        )}`;
    }
    const suffix = isSelf
        ? selfCardQuery(selfPreset ?? DEFAULT_NEBULA_PRESET, selfVersion)
        : "?peek=1";
    return `${window.location.origin}${base}shelf/${cast.key}${suffix}`;
  }, [
    cast.key,
    person,
    personSourceUrl,
    personPreset,
    isSelf,
    selfPreset,
    selfVersion,
  ]);
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  useEffect(() => {
    if (phase !== "shuffle") return undefined;
    let cancelled = false;
    let timer = 0;
    const started = performance.now();
    const tick = () => {
      if (cancelled) return;
      const elapsed = performance.now() - started;
      if (elapsed >= SHUFFLE_MS) {
        setActiveDot(resultIndex);
        setPhase("reveal");
        return;
      }
      setActiveDot((prev) => (prev + 1) % CASTS.length);
      const speed = elapsed > SHUFFLE_MS * 0.62 ? 175 : 82;
      timer = window.setTimeout(tick, speed);
    };
    timer = window.setTimeout(tick, 82);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [phase, resultIndex]);

  useEffect(() => {
    if (phase !== "flip") return undefined;
    const timer = window.setTimeout(() => setPhase("reveal"), FLIP_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  function handleEnter() {
    if (leaving) return;
    if (reduceMotion) {
      onEnter();
      return;
    }
    setLeaving(true);
    timers.current.push(window.setTimeout(onEnter, ENTER_BOOK_MS));
  }

  function skipShuffle() {
    setActiveDot(resultIndex);
    setPhase("reveal");
  }

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  async function savePoster() {
    if (posterState === "working") return;
    setPosterState("working");
    try {
      const dataUrl = await buildPoster(cast, subject);
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = person
        ? `jiupai-u${String(personIndex + 1).padStart(2, "0")}.jpg`
        : `jiupai-${cast.key}.jpg`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setPosterState("done");
    } catch {
      setPosterState("idle");
    }
  }

  function legacyCopy(text: string): boolean {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }

  async function copyLink() {
    let ok = false;
    try {
      if (window.isSecureContext && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        ok = true;
      } else {
        ok = legacyCopy(shareUrl);
      }
    } catch {
      ok = legacyCopy(shareUrl);
    }
    setCopied(ok);
    if (ok) {
      const t = window.setTimeout(() => setCopied(false), 2200);
      timers.current.push(t);
    }
  }

  async function nativeShare() {
    try {
      const sharePayload = isSelf
        ? {
            title: `我是${cast.name} · 思想银河`,
            text: `我在思想银河抽到了「${cast.name} · ${cast.role}」，来看看你的观点人格`,
            url: shareUrl,
          }
        : person
          ? {
              title: `${personName} 的观点 · 思想银河`,
              text: `我在思想银河发现了 ${personName} 的观点，来看看这场讨论`,
              url: shareUrl,
            }
          : {
              title: `${cast.name} · 思想银河`,
              text: `思想银河「${cast.name} · ${cast.role}」，来观点星云找你的观点人格`,
              url: shareUrl,
            };
      await navigator.share(sharePayload);
    } catch {
      // 用户取消分享，无需处理
    }
  }

  const revealed = phase === "reveal";
  const eyebrow = phase === "shuffle"
    ? "思想银河 · 银河的故事"
    : phase === "flip"
      ? person ? "思想银河 · 观点星云" : "思想银河 · 派别图鉴"
      : mode === "enter" && isSelf
        ? "观点人格抽取结果"
        : "观点人格卡";

  return (
    <div
      className={`draw-overlay${sheet ? " draw-overlay--sheet" : ""}${leaving ? " draw-overlay--leave" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={
        mode === "enter"
          ? isSelf ? "抽取观点人格" : person ? `${person.name} 的人格卡` : `${cast.name}人格卡`
          : isSelf ? "我的人格卡" : person ? `${person.name} 的人格卡` : `${cast.name}人格卡`
      }
    >
      <div className="draw-glow" style={{ ["--draw-color" as string]: cast.color }} />
      <WarmStars count={68} className="draw-stars" />

      {mode === "enter" && phase === "shuffle" && (
        <button type="button" className="draw-skip" onClick={skipShuffle}>跳过</button>
      )}
      {mode === "enter" && revealed && !sheet && !leaving && (
        <button type="button" className="draw-exit" onClick={onExit} aria-label="返回">
          <span aria-hidden="true">×</span>
        </button>
      )}
      <BrandMark className="brand-lockup--draw" />
      {mode === "revisit" && revealed && !sheet && (
        <button type="button" className="draw-skip" onClick={onClose} aria-label="关闭人格卡">×</button>
      )}

      <div className={`draw-stage draw-stage--${phase}`}>
        <p className="draw-eyebrow">{eyebrow}</p>

        <div className={`draw-card${revealed ? " is-revealed" : ""}`}>
          <div className="draw-card__inner">
            <div className="draw-face draw-face--back">
              <span className="draw-face__seal">九</span>
              <span className="draw-face__word">思想银河</span>
              <span className="draw-face__sub">SPECTRUM</span>
            </div>
            <div
              className={`draw-face draw-face--front${person ? " draw-face--person" : ""}`}
              style={{ ["--card-color" as string]: cast.color }}
            >
              <img src={artSrc} alt={`${cast.name}人格立绘`} className="draw-face__img" />
              <div className={`draw-face__veil${person ? " draw-face__veil--person" : ""}`} />
              {person && personAvatarSrc && (
                <figure className="draw-face__chip">
                  <img src={personAvatarSrc} alt={`${person.name}的头像`} className="draw-face__chip-img" />
                </figure>
              )}
              <div className={`draw-face__meta${person ? " draw-face__meta--person" : ""}`}>
                <span className="draw-face__volume">{person ? `${cast.volume} · ${cast.name}` : cast.volume}</span>
                <strong className="draw-face__name">{personName}</strong>
                <span className="draw-face__role">{cast.role}</span>
                {person && <span className="draw-face__claim">“{person.claim}”</span>}
                {selfProfile && <span className="draw-face__claim">{selfProfile.claim}</span>}
              </div>
              <span className="draw-face__spark" aria-hidden="true">✦</span>
            </div>
          </div>
        </div>

        <p className="draw-hint">
          {phase === "shuffle"
            ? "正在抽取观点人格…"
            : phase === "flip"
              ? person ? "正在翻开 TA 的人格…" : "正在翻开这一派的人格…"
              : (
                isSelf
                  ? "你在知乎上的观点人格"
                  : person
                    ? `${personName} 的观点人格`
                    : "思想银河观点人格"
              ) + ` · ${cast.name}`}
        </p>

        <div className={`draw-dots${revealed || phase === "flip" ? " is-settled" : ""}`}>
          {CASTS.map((item, i) => (
            <span
              key={item.key}
              className={`draw-dot${i === activeDot ? " is-active" : ""}${i === resultIndex && revealed ? " is-result" : ""}`}
              style={{ ["--dot-color" as string]: item.color }}
            />
          ))}
        </div>

        <div className="draw-actions">
          {!sheet ? (
            <>
              {mode === "enter" && (
                <button type="button" className="draw-btn draw-btn--primary" onClick={handleEnter} disabled={!revealed}>
                  {isSelf ? "翻开我的书" : person ? "翻开 TA 的书" : "翻开这本书"}
                </button>
              )}
              <button
                type="button"
                className={`draw-btn${mode === "enter" ? " draw-btn--ghost" : " draw-btn--primary"}`}
                onClick={() => setSheet(true)}
                disabled={!revealed}
              >
                {mode === "revisit"
                  ? "分享这张人格卡"
                  : isSelf
                    ? "分享人格卡"
                    : person
                      ? "分享这个观点"
                      : "分享这张人格卡"}
              </button>
            </>
          ) : (
            <div className="share-sheet">
              <p className="share-sheet__title">
                {isSelf
                  ? "把我的人格卡分享出去"
                  : person
                    ? `分享 ${personName} 的观点`
                    : "把这张人格卡分享出去"}
              </p>
              <div className="share-sheet__btns">
                <button type="button" className="draw-btn draw-btn--primary" onClick={savePoster}>
                  {posterState === "working" ? "正在生成海报…" : posterState === "done" ? "海报已保存 ✓" : "保存人格卡海报"}
                </button>
                <button type="button" className="draw-btn draw-btn--ghost" onClick={copyLink}>
                  {copied ? "链接已复制 ✓" : person ? "复制观点链接" : "复制人格卡链接"}
                </button>
                {canNativeShare && (
                  <button type="button" className="draw-btn draw-btn--ghost" onClick={nativeShare}>
                    系统分享
                  </button>
                )}
                <button type="button" className="draw-btn draw-btn--text" onClick={() => setSheet(false)}>
                  返回
                </button>
              </div>
              <p className="share-sheet__url">{shareUrl}</p>
              <p className="share-sheet__tip">
                {isSelf
                  ? "朋友打开链接，会先抽到这张人格卡，再翻开你的书"
                  : person
                    ? personSourceUrl
                      ? `朋友打开链接，会前往知乎查看 ${personName} 的原文`
                      : "朋友打开链接，会进入这个观点所在的星云"
                    : "朋友打开链接，会先看到这一派的人格卡，再翻开这本书"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
