import { useEffect, useRef, type CSSProperties, type MutableRefObject, type RefObject } from "react";
import { useNavigate } from "react-router-dom";
import { CASTS, castCardVars } from "./cast";
import { CastFace } from "./ui";

type WaveState = {
  phase: number;
  targetPhase: number;
  basePhase: number;
  orientation: number;
  targetOrientation: number;
  pointerX: number;
  pointerY: number;
  tiltX: number;
  tiltY: number;
  active: boolean;
  manualOrientation: boolean;
  lastInput: number;
};

function shelfPath(key: string) {
  return `/shelf/${key}`;
}

export function CardWave({
  stageRef,
  flipRef,
  onOrient,
}: {
  stageRef: RefObject<HTMLElement | null>;
  flipRef?: MutableRefObject<() => void>;
  onOrient?: (vertical: boolean) => void;
}) {
  const navigate = useNavigate();
  const deckRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    let cancelled = false;
    let wait = 0;
    let dispose: (() => void) | undefined;

    const boot = () => {
      if (cancelled) return;
      const stage = stageRef.current;
      const deck = deckRef.current;
      const cards = cardRefs.current.filter((el): el is HTMLButtonElement => Boolean(el));
      if (!stage || !deck || cards.length !== CASTS.length) {
        wait = requestAnimationFrame(boot);
        return;
      }
      dispose = startWave(stage, cards);
    };

    function startWave(stage: HTMLElement, cards: HTMLButtonElement[]) {
      const host: HTMLElement = stage;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const count = cards.length;
      const state: WaveState = {
        phase: 2,
        targetPhase: 2,
        basePhase: 2,
        orientation: window.innerWidth < 680 ? 1 : 0,
        targetOrientation: window.innerWidth < 680 ? 1 : 0,
        pointerX: 0,
        pointerY: 0,
        tiltX: 0,
        tiltY: 0,
        active: false,
        manualOrientation: false,
        lastInput: performance.now(),
      };

      function wrappedDelta(index: number, phase: number) {
        let delta = index - phase;
        while (delta > count / 2) delta -= count;
        while (delta < -count / 2) delta += count;
        return delta;
      }

      function nearestIndex() {
        return (((Math.round(state.phase) % count) + count) % count);
      }

      function select(index: number) {
        const current = nearestIndex();
        let delta = index - current;
        if (delta > count / 2) delta -= count;
        if (delta < -count / 2) delta += count;
        state.basePhase += delta;
        state.targetPhase = state.basePhase;
        state.lastInput = performance.now();
      }

      function toggleOrientation() {
        state.manualOrientation = true;
        state.targetOrientation = state.targetOrientation > 0.5 ? 0 : 1;
        state.targetPhase = state.basePhase;
        state.lastInput = performance.now();
        onOrient?.(state.targetOrientation > 0.5);
      }

      function isHudTarget(target: EventTarget | null) {
        return target instanceof Element && Boolean(target.closest(".hud, a.btn, .hot-ticker, .wave-orient, .shelf-nav"));
      }

      function setPointer(event: PointerEvent) {
        if (isHudTarget(event.target)) return;
        const rect = host.getBoundingClientRect();
        const nx = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - 0.5) * 2));
        const ny = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - 0.5) * 2));
        state.pointerX = nx;
        state.pointerY = ny;
        state.tiltX = nx;
        state.tiltY = ny;
        state.active = true;
        state.lastInput = performance.now();
        const axis = state.targetOrientation > 0.5 ? ny : nx;
        state.targetPhase = state.basePhase + axis * (window.innerWidth < 680 ? 1.55 : 2.45);
        host.style.setProperty("--pointer-x", `${((nx + 1) / 2) * 100}%`);
        host.style.setProperty("--pointer-y", `${((ny + 1) / 2) * 100}%`);
      }

      if (flipRef) flipRef.current = toggleOrientation;
      onOrient?.(state.targetOrientation > 0.5);

      const onLeave = () => {
        state.active = false;
        state.targetPhase = state.basePhase;
        state.pointerX = 0;
        state.pointerY = 0;
        host.style.setProperty("--pointer-x", "50%");
        host.style.setProperty("--pointer-y", "50%");
      };

      const onWheel = (event: WheelEvent) => {
        if (isHudTarget(event.target)) return;
        event.preventDefault();
        const direction = Math.sign(Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX);
        if (!direction) return;
        state.basePhase += direction;
        state.targetPhase = state.basePhase;
        state.active = false;
        state.lastInput = performance.now();
      };

      const onKey = (event: KeyboardEvent) => {
        if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", " ", "Enter"].includes(event.key)) return;
        if (isHudTarget(event.target)) return;
        event.preventDefault();
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          state.basePhase += 1;
          state.targetPhase = state.basePhase;
          state.lastInput = performance.now();
        }
        if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          state.basePhase -= 1;
          state.targetPhase = state.basePhase;
          state.lastInput = performance.now();
        }
        if (event.key === " ") toggleOrientation();
        if (event.key === "Enter") navigate(shelfPath(CASTS[nearestIndex()].key));
      };

      const onResize = () => {
        if (!state.manualOrientation) {
          state.targetOrientation = window.innerWidth < 680 ? 1 : 0;
        }
      };

      const unsubs = cards.map((card, index) => {
        const onClick = () => navigate(shelfPath(CASTS[index].key));
        const onFocus = () => select(index);
        card.addEventListener("click", onClick);
        card.addEventListener("focus", onFocus);
        return () => {
          card.removeEventListener("click", onClick);
          card.removeEventListener("focus", onFocus);
        };
      });

      host.addEventListener("pointermove", setPointer);
      host.addEventListener("pointerdown", setPointer);
      host.addEventListener("pointerleave", onLeave);
      host.addEventListener("dblclick", toggleOrientation);
      host.addEventListener("wheel", onWheel, { passive: false });
      window.addEventListener("keydown", onKey);
      window.addEventListener("resize", onResize);

      let previousTime = performance.now();
      let frame = 0;

      function render(time: number) {
        const deltaTime = Math.min(32, time - previousTime);
        previousTime = time;
        const ease = reducedMotion ? 1 : 1 - Math.pow(0.0007, deltaTime / 1000);

        if (!state.active && !state.manualOrientation && time - state.lastInput > 4200) {
          const idle = time - state.lastInput - 4200;
          state.targetPhase = state.basePhase + Math.sin(idle * 0.00034) * 1.9;
          state.targetOrientation = (Math.sin(idle * 0.00019 - Math.PI / 2) + 1) / 2;
        }

        state.phase += (state.targetPhase - state.phase) * ease;
        state.orientation += (state.targetOrientation - state.orientation) * ease * 0.72;
        state.tiltX += ((state.active ? state.pointerX : 0) - state.tiltX) * ease * 0.72;
        state.tiltY += ((state.active ? state.pointerY : 0) - state.tiltY) * ease * 0.72;

        const horizontalSpacing = Math.min(150, Math.max(102, window.innerWidth * 0.096));
        const verticalSpacing = Math.min(136, Math.max(99, window.innerHeight * 0.148));
        const activeIndex = nearestIndex();

        cards.forEach((card, index) => {
          const delta = wrappedDelta(index, state.phase);
          const distance = Math.abs(delta);
          const focus = Math.exp(-Math.pow(distance, 2) * 1.05);
          const side = Math.max(0, 1 - distance / 5);
          const direction = Math.sign(delta) || 1;
          const horizontalX = delta * horizontalSpacing;
          const horizontalY = -Math.pow(distance, 1.45) * 6 + Math.sin(delta * 0.8) * 5;
          const verticalX =
            Math.sin(delta * 0.82) * Math.min(78, window.innerWidth * 0.06) + direction * Math.pow(distance, 1.25) * 8;
          const verticalY = delta * verticalSpacing;
          const bob = CASTS[index]?.idle.bob ?? 3;
          const liveY = reducedMotion ? 0 : Math.sin(time * 0.0017 + index * 0.91) * (bob + focus * 2.6);
          const liveTilt = reducedMotion ? 0 : Math.sin(time * 0.00115 + index * 1.17) * (1.05 + focus * 1.5);
          const x = horizontalX * (1 - state.orientation) + verticalX * state.orientation;
          const y = horizontalY * (1 - state.orientation) + verticalY * state.orientation + liveY;
          const z = focus * 95 - distance * 78;
          const scale = 0.57 + side * 0.16 + focus * 0.38;
          const rotateX = -state.tiltY * focus * 5 + delta * 2.2 * state.orientation + liveTilt * 0.35;
          const rotateY = state.tiltX * focus * 7 - delta * 8.5 * (1 - state.orientation) + liveTilt;
          const rotateZ = delta * 2.25 * (1 - state.orientation) - delta * 1.4 * state.orientation + liveTilt * 0.45;

          card.style.setProperty("--focus", focus.toFixed(4));
          card.style.setProperty("--cover-open", reducedMotion ? "0" : (7 + focus * 26).toFixed(2));
          card.style.pointerEvents = distance > 1.45 ? "none" : "auto";
          card.style.zIndex = String(Math.round(1000 - distance * 100));
          card.style.opacity = String(Math.max(0.14, side * 0.82 + focus * 0.18));
          card.style.filter = `blur(${Math.max(0, distance - 1.35) * 0.45}px) saturate(${0.72 + focus * 0.28})`;
          card.style.transform = [
            "translate(-50%, -50%)",
            `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${z.toFixed(2)}px)`,
            `rotateX(${rotateX.toFixed(2)}deg)`,
            `rotateY(${rotateY.toFixed(2)}deg)`,
            `rotateZ(${rotateZ.toFixed(2)}deg)`,
            `scale(${scale.toFixed(4)})`,
          ].join(" ");
          card.setAttribute("aria-current", index === activeIndex ? "true" : "false");
        });

        frame = requestAnimationFrame(render);
      }

      frame = requestAnimationFrame(render);

      const onVisibility = () => {
        if (document.hidden) {
          cancelAnimationFrame(frame);
          frame = 0;
          return;
        }
        previousTime = performance.now();
        if (!frame) frame = requestAnimationFrame(render);
      };
      document.addEventListener("visibilitychange", onVisibility);

      return () => {
        cancelAnimationFrame(frame);
        unsubs.forEach((off) => off());
        host.removeEventListener("pointermove", setPointer);
        host.removeEventListener("pointerdown", setPointer);
        host.removeEventListener("pointerleave", onLeave);
        host.removeEventListener("dblclick", toggleOrientation);
        host.removeEventListener("wheel", onWheel);
        window.removeEventListener("keydown", onKey);
        window.removeEventListener("resize", onResize);
        document.removeEventListener("visibilitychange", onVisibility);
      };
    }

    boot();
    return () => {
      cancelled = true;
      cancelAnimationFrame(wait);
      dispose?.();
    };
  }, [stageRef, navigate, flipRef, onOrient]);

  return (
    <div ref={deckRef} className="card-wave" aria-hidden="false">
      {CASTS.map((cast, i) => (
        <button
          key={cast.key}
          type="button"
          className="persona-card persona-card-cast persona-card-float"
          data-cast={cast.key}
          style={castCardVars(cast) as CSSProperties}
          aria-label={`${cast.name}，${cast.volume}，${cast.role}`}
          onClick={() => navigate(shelfPath(cast.key))}
          ref={(el) => {
            cardRefs.current[i] = el;
          }}
        >
          <CastFace name={cast.name} role={cast.role} portrait={cast.key} cta="看书" />
        </button>
      ))}
    </div>
  );
}
