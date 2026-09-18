import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "soular:ambient-audio:v1";
const TARGET_GAIN = 0.035;

type AmbientEngine = {
  context: AudioContext;
  master: GainNode;
  chimeTimer: number;
  chimeIndex: number;
};

function initialPreference() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

function playChime(engine: AmbientEngine) {
  if (engine.context.state !== "running") return;
  const notes = [293.66, 329.63, 392, 493.88];
  const now = engine.context.currentTime;
  const oscillator = engine.context.createOscillator();
  const gain = engine.context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = notes[engine.chimeIndex % notes.length];
  engine.chimeIndex += 1;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.06, now + 0.12);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 4.8);
  oscillator.connect(gain).connect(engine.master);
  oscillator.start(now);
  oscillator.stop(now + 5);
}

function createEngine(): AmbientEngine {
  const context = new AudioContext();
  const master = context.createGain();
  const filter = context.createBiquadFilter();

  master.gain.value = 0;
  master.connect(context.destination);
  filter.type = "lowpass";
  filter.frequency.value = 880;
  filter.Q.value = 0.55;
  filter.connect(master);

  ([
    [110, 0.12],
    [164.81, 0.08],
    [220, 0.05],
  ] as const).forEach(([frequency, level], index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = index === 1 ? "triangle" : "sine";
    oscillator.frequency.value = frequency;
    oscillator.detune.value = index * 3 - 3;
    gain.gain.value = level;
    oscillator.connect(gain).connect(filter);
    oscillator.start();
  });

  const drift = context.createOscillator();
  const driftDepth = context.createGain();
  drift.frequency.value = 0.035;
  driftDepth.gain.value = 150;
  drift.connect(driftDepth).connect(filter.frequency);
  drift.start();

  const engine: AmbientEngine = {
    context,
    master,
    chimeTimer: 0,
    chimeIndex: 0,
  };
  engine.chimeTimer = window.setInterval(() => playChime(engine), 7_600);
  return engine;
}

function fade(engine: AmbientEngine, value: number, duration: number) {
  const now = engine.context.currentTime;
  engine.master.gain.cancelScheduledValues(now);
  engine.master.gain.setValueAtTime(engine.master.gain.value, now);
  engine.master.gain.linearRampToValueAtTime(value, now + duration);
}

export function AmbientAudio() {
  const [playing, setPlaying] = useState(false);
  const enabledRef = useRef(initialPreference());
  const engineRef = useRef<AmbientEngine | null>(null);

  const silence = useCallback(() => {
    const engine = engineRef.current;
    setPlaying(false);
    if (!engine) return;
    fade(engine, 0, 0.22);
  }, []);

  const activate = useCallback(async () => {
    if (!enabledRef.current || document.hidden) return;
    try {
      const engine = engineRef.current ?? createEngine();
      engineRef.current = engine;
      await engine.context.resume();
      fade(engine, TARGET_GAIN, 1.4);
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  }, []);

  useEffect(() => {
    const onFirstInteraction = (event: PointerEvent | KeyboardEvent) => {
      if (event.target instanceof Element && event.target.closest(".ambient-audio-control")) return;
      void activate();
    };
    const onVisibilityChange = () => {
      if (document.hidden) silence();
      else void activate();
    };
    window.addEventListener("pointerdown", onFirstInteraction);
    window.addEventListener("keydown", onFirstInteraction);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pointerdown", onFirstInteraction);
      window.removeEventListener("keydown", onFirstInteraction);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      const engine = engineRef.current;
      if (!engine) return;
      window.clearInterval(engine.chimeTimer);
      void engine.context.close();
      engineRef.current = null;
    };
  }, [activate, silence]);

  function toggle() {
    if (playing) {
      enabledRef.current = false;
      try {
        window.localStorage.setItem(STORAGE_KEY, "off");
      } catch {
        // 存储不可用时仍允许本次静音。
      }
      silence();
      return;
    }

    enabledRef.current = true;
    try {
      window.localStorage.setItem(STORAGE_KEY, "on");
    } catch {
      // 存储不可用时仍允许本次播放。
    }
    void activate();
  }

  return (
    <button
      type="button"
      className="ambient-audio-control"
      aria-label={playing ? "关闭背景音乐" : "开启背景音乐"}
      aria-pressed={playing}
      onClick={toggle}
    >
      <span className="ambient-audio-control__icon" aria-hidden="true">♪</span>
      <span>{playing ? "音乐 开" : "开启音乐"}</span>
    </button>
  );
}
