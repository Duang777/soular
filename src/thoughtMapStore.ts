import { CASTS } from "./cast";
import {
  NEBULA_PRESET_VERSIONS,
  nebulaPresetVersion,
  type SelfProfile,
} from "./people";
import type { ShareMatchEntry } from "./shareMatch";

type ThoughtMapStorage = Pick<Storage, "getItem" | "setItem">;

const STORAGE_PREFIX = "jiupai:thought-map:v1:";
const MAX_POSITIONS = 6;
const CAST_KEYS = new Set(CASTS.map(({ key }) => key));
const PRESET_ORDER = new Map(
  Object.keys(NEBULA_PRESET_VERSIONS).map((preset, index) => [preset, index]),
);
const volatilePositions = new Map<string, ShareMatchEntry[]>();

function storageScope(accountVersion: string | null | undefined): string {
  return accountVersion && /^[a-f0-9]{16}$/.test(accountVersion)
    ? accountVersion
    : "anonymous";
}

function storageKey(accountVersion: string | null | undefined): string {
  return `${STORAGE_PREFIX}${storageScope(accountVersion)}`;
}

function validPosition(value: unknown): ShareMatchEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.preset !== "string" ||
    typeof record.version !== "string" ||
    nebulaPresetVersion(record.preset) !== record.version ||
    typeof record.cast !== "string" ||
    !CAST_KEYS.has(record.cast) ||
    typeof record.stance !== "number" ||
    !Number.isFinite(record.stance)
  ) {
    return null;
  }
  return {
    preset: record.preset,
    version: record.version,
    cast: record.cast as ShareMatchEntry["cast"],
    stance: Math.max(-1, Math.min(1, record.stance)),
  };
}

function normalizedPositions(value: unknown): ShareMatchEntry[] {
  if (!Array.isArray(value)) return [];
  const positions = new Map<string, ShareMatchEntry>();
  value.slice(-MAX_POSITIONS * 2).forEach((item) => {
    const position = validPosition(item);
    if (position) positions.set(position.preset, position);
  });
  return [...positions.values()]
    .sort((a, b) =>
      (PRESET_ORDER.get(a.preset) ?? Number.MAX_SAFE_INTEGER) -
      (PRESET_ORDER.get(b.preset) ?? Number.MAX_SAFE_INTEGER)
    )
    .slice(0, MAX_POSITIONS);
}

export function readThoughtMapPositions(
  storage: ThoughtMapStorage | null,
  accountVersion: string | null | undefined,
): ShareMatchEntry[] {
  const key = storageKey(accountVersion);
  if (storage) {
    try {
      const positions = normalizedPositions(
        JSON.parse(storage.getItem(key) || "[]"),
      );
      volatilePositions.set(key, positions);
      return positions;
    } catch {
      // Fall through to the page-local copy.
    }
  }
  return [...(volatilePositions.get(key) ?? [])];
}

export function rememberThoughtMapPosition(
  storage: ThoughtMapStorage | null,
  accountVersion: string | null | undefined,
  profile: SelfProfile,
): ShareMatchEntry[] {
  const key = storageKey(accountVersion);
  const positions = readThoughtMapPositions(storage, accountVersion)
    .filter(({ preset }) => preset !== profile.preset);
  if (
    profile.likedCount >= 3 &&
    nebulaPresetVersion(profile.preset) === profile.version &&
    CAST_KEYS.has(profile.cast)
  ) {
    positions.push({
      preset: profile.preset,
      version: profile.version,
      cast: profile.cast,
      stance: Math.max(-1, Math.min(1, profile.stance)),
    });
  }
  const next = normalizedPositions(positions);
  volatilePositions.set(key, next);
  if (storage) {
    try {
      storage.setItem(key, JSON.stringify(next));
    } catch {
      // The page-local copy keeps the current sharing flow available.
    }
  }
  return next;
}
