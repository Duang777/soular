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

let personaLibraryPromise: Promise<PersonaLibraryModule> | null = null;

function loadPersonaLibrary(): Promise<PersonaLibraryModule> {
  personaLibraryPromise ??= import(
    /* @vite-ignore */ withVersion(asset("persona-library.js"))
  ) as Promise<PersonaLibraryModule>;
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
): readonly Cast[] {
  const [casts, setCasts] = useState<readonly Cast[]>(CASTS);

  useEffect(() => {
    let active = true;
    setCasts(CASTS);
    if (!presetId) return () => {
      active = false;
    };

    void loadPersonaCasts(presetId).then((next) => {
      if (active) setCasts(next);
    });
    return () => {
      active = false;
    };
  }, [presetId]);

  return casts;
}
