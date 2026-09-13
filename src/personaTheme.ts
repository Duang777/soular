import { useEffect, useState } from "react";
import { asset, CASTS, withVersion, type Cast } from "./cast";

type PersonaCastValue = {
  key?: unknown;
  name?: unknown;
  role?: unknown;
  portrait?: unknown;
  description?: unknown;
  personaId?: unknown;
  themeId?: unknown;
  themeName?: unknown;
};

type PersonaLibraryModule = {
  resolvePersonaCastsForPreset?: (presetId: string) => unknown;
};

export type PersonaCastState = {
  casts: readonly Cast[];
  status: "idle" | "loading" | "ready" | "fallback";
  loadAttempt: number;
};

const PERSONA_LIBRARY_TIMEOUT_MS = 4_000;
const PERSONA_LIBRARY_RETRY_TIMEOUT_MS = 8_000;
let personaLibraryPromise: Promise<PersonaLibraryModule> | null = null;
let personaLibraryAttempt = 0;

function loadPersonaLibrary(): Promise<PersonaLibraryModule> {
  if (personaLibraryPromise) return personaLibraryPromise;

  const attempt = personaLibraryAttempt;
  const libraryUrl = new URL(
    withVersion(asset("persona-library.js")),
    window.location.href,
  );
  if (attempt > 0) {
    libraryUrl.searchParams.set("retry", String(attempt));
  }
  const importPromise = import(
    /* @vite-ignore */ libraryUrl.href
  ) as Promise<PersonaLibraryModule>;
  let timeoutId = 0;
  const timeoutPromise = new Promise<PersonaLibraryModule>((_, reject) => {
    timeoutId = window.setTimeout(
      () => reject(new Error("persona library load timed out")),
      attempt > 0
        ? PERSONA_LIBRARY_RETRY_TIMEOUT_MS
        : PERSONA_LIBRARY_TIMEOUT_MS,
    );
  });
  const load = Promise.race([importPromise, timeoutPromise])
    .finally(() => window.clearTimeout(timeoutId))
    .catch((error: unknown) => {
      if (personaLibraryPromise === load) {
        personaLibraryPromise = null;
        personaLibraryAttempt = attempt + 1;
      }
      throw error;
    });
  personaLibraryPromise = load;
  return personaLibraryPromise;
}

function themedCastsFromValue(value: unknown): readonly Cast[] {
  if (!Array.isArray(value) || value.length !== CASTS.length) return CASTS;
  const records = value as PersonaCastValue[];
  if (!records.every((record, index) => record?.key === CASTS[index].key)) {
    return CASTS;
  }

  return records.map((record, index) => {
    const fallback = CASTS[index];
    const portrait = typeof record.portrait === "string" &&
        /^personas\/[a-z0-9-]+\.jpg$/.test(record.portrait)
      ? record.portrait
      : undefined;
    const themeId = typeof record.themeId === "string" &&
        /^[a-z0-9-]+$/.test(record.themeId)
      ? record.themeId
      : undefined;
    const personaId = typeof record.personaId === "string" &&
        /^[a-z0-9-]+$/.test(record.personaId)
      ? record.personaId
      : undefined;

    return {
      ...fallback,
      name: typeof record.name === "string" && record.name.trim()
        ? record.name.trim()
        : fallback.name,
      role: typeof record.role === "string" && record.role.trim()
        ? record.role.trim()
        : fallback.role,
      portrait,
      description: typeof record.description === "string"
        ? record.description.trim()
        : undefined,
      personaId,
      themeId,
      themeName: typeof record.themeName === "string"
        ? record.themeName.trim()
        : undefined,
    };
  });
}

export async function loadPersonaCasts(
  presetId: string,
): Promise<readonly Cast[]> {
  try {
    const library = await loadPersonaLibrary();
    if (typeof library.resolvePersonaCastsForPreset !== "function") return CASTS;
    return themedCastsFromValue(
      library.resolvePersonaCastsForPreset(presetId),
    );
  } catch {
    return CASTS;
  }
}

export function usePersonaCasts(
  presetId: string | null | undefined,
): PersonaCastState {
  const [state, setState] = useState<PersonaCastState>(() => ({
    casts: CASTS,
    status: presetId ? "loading" : "idle",
    loadAttempt: personaLibraryAttempt,
  }));

  useEffect(() => {
    let active = true;
    const loadAttempt = personaLibraryAttempt;
    setState({
      casts: CASTS,
      status: presetId ? "loading" : "idle",
      loadAttempt,
    });
    if (!presetId) return () => {
      active = false;
    };

    void loadPersonaCasts(presetId).then((next) => {
      if (active) {
        setState({
          casts: next,
          status: next === CASTS ? "fallback" : "ready",
          loadAttempt,
        });
      }
    });
    return () => {
      active = false;
    };
  }, [presetId]);

  return state;
}
