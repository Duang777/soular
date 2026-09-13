import { CASTS, type Cast } from "./cast";
import { nebulaPresetVersion } from "./people";

export type ShareMatchPayload = {
  preset: string;
  version: string;
  cast: Cast["key"];
  stance: number;
};

export type PresetAxis = {
  left: string;
  center: string;
  right: string;
  leftChoice?: string;
  rightChoice?: string;
  leftTendency?: string;
  rightTendency?: string;
};

export type QuizChoice = { label: string; stance: number };
export type QuizQuestion = { question: string; choices: QuizChoice[] };

const CAST_KEYS = new Set(CASTS.map((item) => item.key));

export function encodeStance(stance: number): number {
  return Math.round(Math.max(-1, Math.min(1, stance)) * 100);
}

export function decodeStance(code: number): number | null {
  if (!Number.isInteger(code) || code < -100 || code > 100) return null;
  return code / 100;
}

export function buildShareMatchUrl(
  origin: string,
  basePath: string,
  payload: ShareMatchPayload,
): string {
  const base = basePath.endsWith("/") ? basePath : `${basePath}/`;
  const s = encodeStance(payload.stance);
  return `${origin}${base}match?preset=${encodeURIComponent(payload.preset)}` +
    `&version=${encodeURIComponent(payload.version)}` +
    `&cast=${encodeURIComponent(payload.cast)}` +
    `&s=${s}`;
}

export function parseShareMatchQuery(params: URLSearchParams): ShareMatchPayload | null {
  const preset = params.get("preset");
  const version = params.get("version") ?? "";
  const cast = params.get("cast") ?? "";
  const stanceValue = params.get("s");

  if (!preset || !nebulaPresetVersion(preset)) return null;
  if (!/^[a-z0-9-]{1,15}$/.test(version)) return null;
  if (!CAST_KEYS.has(cast as Cast["key"])) return null;
  if (stanceValue === null || !/^-?\d{1,3}$/.test(stanceValue)) return null;
  const stanceCode = Number(stanceValue);
  const stance = decodeStance(stanceCode);
  if (stance === null) return null;

  return { preset, version, cast: cast as Cast["key"], stance };
}

export function stanceLabel(stance: number, axis: PresetAxis): string {
  if (stance < -0.2) return axis.left;
  if (stance > 0.2) return axis.right;
  return axis.center;
}

export function buildMatchQuizQuestions(axis: PresetAxis): QuizQuestion[] {
  return [
    {
      question: "你更认同哪一侧？",
      choices: [
        { label: axis.leftTendency ?? axis.left, stance: -0.75 },
        { label: axis.center, stance: 0 },
        { label: axis.rightTendency ?? axis.right, stance: 0.75 },
      ],
    },
    {
      question: "如果只能选一种态度？",
      choices: [
        { label: axis.leftChoice ?? axis.left, stance: -0.85 },
        { label: "两者都有道理", stance: 0 },
        { label: axis.rightChoice ?? axis.right, stance: 0.85 },
      ],
    },
    {
      question: "你更接近光谱哪一端？",
      choices: [
        { label: axis.left, stance: -0.65 },
        { label: axis.center, stance: 0 },
        { label: axis.right, stance: 0.65 },
      ],
    },
  ];
}

export function averageStance(values: number[]): number {
  if (!values.length) return 0;
  const sum = values.reduce((total, value) => total + value, 0);
  return Math.max(-1, Math.min(1, sum / values.length));
}

export function describeMatchRelationship(
  axis: PresetAxis,
  hostCast: Cast,
  hostStance: number,
  guestStance: number,
): { headline: string; body: string } {
  const gap = Math.abs(hostStance - guestStance);
  const hostSide = stanceLabel(hostStance, axis);
  const guestSide = stanceLabel(guestStance, axis);
  const side = (stance: number) => stance < -0.2 ? -1 : stance > 0.2 ? 1 : 0;
  const hostDirection = side(hostStance);
  const guestDirection = side(guestStance);
  const sameDirection =
    hostDirection !== 0 && hostDirection === guestDirection;
  const oppositeDirection = hostDirection * guestDirection === -1;

  let headline = "你们在光谱上相遇了";
  if (gap < 0.15) {
    headline = "立场几乎重合";
  } else if (gap < 0.4 && sameDirection) {
    headline = "同侧观察，细节不同";
  } else if (oppositeDirection) {
    headline = "站在争议两侧";
  } else if (hostDirection === 0 || guestDirection === 0) {
    headline = "一方仍在中间观察";
  } else if (gap >= 0.7) {
    headline = "相距较远，对照鲜明";
  }

  const body = [
    `朋友落在「${hostSide}」一侧，人格呈现为「${hostCast.name}」；`,
    `你完成三次表态后落在「${guestSide}」一侧。`,
    gap < 0.2
      ? "双方坐标接近，说明你们对这道题的第一反应相当一致。"
      : sameDirection
        ? "你们仍处在同一侧，但对议题的轻重判断并不完全相同。"
        : oppositeDirection
          ? `本题主轴是「${axis.left}」与「${axis.right}」，你们分别靠近不同一端。`
          : "其中一方仍在中间观察，暂时没有落到争议的任一端。",
    "以上只基于本题公开立场与分享者人格，不构成心理判断。",
  ].join("");

  return { headline, body };
}
