import { CASTS, type Cast } from "./cast";
import { nebulaPresetVersion } from "./people";

export type ShareMatchEntry = {
  preset: string;
  version: string;
  cast: Cast["key"];
  stance: number;
};

export type ShareMatchPayload = ShareMatchEntry & {
  entries: ShareMatchEntry[];
};

export type ShareMatchInput = ShareMatchEntry & {
  entries?: readonly ShareMatchEntry[];
};

export type ThoughtMapResult = {
  preset: string;
  hostStance: number;
  guestStance: number;
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
export const MAX_SHARE_MATCH_ENTRIES = 6;

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
  payload: ShareMatchInput,
): string {
  const base = basePath.endsWith("/") ? basePath : `${basePath}/`;
  const s = encodeStance(payload.stance);
  const entries = uniqueEntries([payload, ...(payload.entries ?? [])]);
  const additionalEntries = entries.filter(({ preset }) =>
    preset !== payload.preset
  );
  const mapQuery = additionalEntries.length
    ? `&m=${encodeURIComponent(additionalEntries.map(encodeMapEntry).join(","))}`
    : "";
  return `${origin}${base}match?preset=${encodeURIComponent(payload.preset)}` +
    `&version=${encodeURIComponent(payload.version)}` +
    `&cast=${encodeURIComponent(payload.cast)}` +
    `&s=${s}${mapQuery}`;
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

  const primary: ShareMatchEntry = {
    preset,
    version,
    cast: cast as Cast["key"],
    stance,
  };
  const encodedMap = params.get("m");
  const mapEntries = encodedMap && encodedMap.length <= 768
    ? encodedMap
        .split(",")
        .slice(0, MAX_SHARE_MATCH_ENTRIES)
        .map(parseMapEntry)
        .filter((entry): entry is ShareMatchEntry => entry !== null)
    : [];
  return {
    ...primary,
    entries: uniqueEntries([primary, ...mapEntries]),
  };
}

function validEntry(value: unknown): ShareMatchEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.preset !== "string" ||
    !nebulaPresetVersion(record.preset) ||
    typeof record.version !== "string" ||
    !/^[a-z0-9-]{1,15}$/.test(record.version) ||
    typeof record.cast !== "string" ||
    !CAST_KEYS.has(record.cast as Cast["key"]) ||
    typeof record.stance !== "number" ||
    !Number.isFinite(record.stance)
  ) {
    return null;
  }
  return {
    preset: record.preset,
    version: record.version,
    cast: record.cast as Cast["key"],
    stance: Math.max(-1, Math.min(1, record.stance)),
  };
}

function uniqueEntries(values: readonly unknown[]): ShareMatchEntry[] {
  const presets = new Set<string>();
  const entries: ShareMatchEntry[] = [];
  values.forEach((value) => {
    const entry = validEntry(value);
    if (!entry || presets.has(entry.preset)) return;
    presets.add(entry.preset);
    entries.push(entry);
  });
  return entries.slice(0, MAX_SHARE_MATCH_ENTRIES);
}

function encodeMapEntry(entry: ShareMatchEntry): string {
  return [
    entry.preset,
    entry.version,
    entry.cast,
    encodeStance(entry.stance),
  ].join("~");
}

function parseMapEntry(value: string): ShareMatchEntry | null {
  const [preset, version, cast, stanceValue, ...rest] = value.split("~");
  if (rest.length || !/^-?\d{1,3}$/.test(stanceValue ?? "")) return null;
  const stance = decodeStance(Number(stanceValue));
  return stance === null
    ? null
    : validEntry({ preset, version, cast, stance });
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

export function summarizeThoughtMap(results: readonly ThoughtMapResult[]): {
  averageGap: number;
  alignedCount: number;
  contrastedCount: number;
  headline: string;
  body: string;
} {
  const gaps = results.map(({ hostStance, guestStance }) =>
    Math.abs(hostStance - guestStance)
  );
  const averageGap = gaps.length
    ? gaps.reduce((total, gap) => total + gap, 0) / gaps.length
    : 0;
  const alignedCount = gaps.filter((gap) => gap < 0.35).length;
  const contrastedCount = gaps.filter((gap) => gap >= 0.8).length;
  let headline = "第一颗共同坐标已点亮";
  if (results.length > 1 && averageGap < 0.25) {
    headline = "你们常落在同一片星域";
  } else if (results.length > 1 && averageGap < 0.55) {
    headline = "相近中保留各自方向";
  } else if (results.length > 1) {
    headline = "差异让这张地图更完整";
  }
  return {
    averageGap,
    alignedCount,
    contrastedCount,
    headline,
    body: `已完成 ${results.length} 道共同问题，其中 ${alignedCount} 道坐标接近、${contrastedCount} 道差异明显。`,
  };
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
