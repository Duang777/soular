export interface IdentityRevisionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

type RevisionEntry = [scope: string, revision: number];
type StoredRevisionState = {
  entries: RevisionEntry[];
  nextRevision: number;
};

const MAX_IDENTITY_REVISION = 0x7fffffff;

function validEntries(value: unknown): RevisionEntry[] {
  if (!Array.isArray(value)) return [];
  const scopes = new Set<string>();
  const revisions = new Set<number>();
  const entries: RevisionEntry[] = [];
  value.forEach((entry) => {
    if (
      !Array.isArray(entry) ||
      typeof entry[0] !== "string" ||
      !Number.isSafeInteger(entry[1]) ||
      entry[1] <= 0 ||
      entry[1] > MAX_IDENTITY_REVISION ||
      scopes.has(entry[0]) ||
      revisions.has(entry[1])
    ) return;
    scopes.add(entry[0]);
    revisions.add(entry[1]);
    entries.push([entry[0], entry[1]]);
  });
  return entries;
}

function storedRevisionState(value: unknown): StoredRevisionState {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  const entries = validEntries(record?.entries ?? value);
  const highestRevision = entries.reduce(
    (highest, [, revision]) => Math.max(highest, revision),
    0,
  );
  const persistedNext = record?.nextRevision;
  const nextRevision =
    Number.isSafeInteger(persistedNext) &&
    Number(persistedNext) > highestRevision &&
    Number(persistedNext) <= MAX_IDENTITY_REVISION
      ? Number(persistedNext)
      : Math.min(MAX_IDENTITY_REVISION, highestRevision + 1);
  return { entries, nextRevision };
}

function nextAvailableRevision(
  memory: Map<string, number>,
  highWaterMark: number,
): number {
  const used = new Set(
    [...memory.values()].filter((revision) =>
      Number.isSafeInteger(revision) &&
      revision > 0 &&
      revision <= MAX_IDENTITY_REVISION
    ),
  );
  for (
    let revision = Math.max(1, highWaterMark);
    revision <= MAX_IDENTITY_REVISION;
    revision += 1
  ) {
    if (!used.has(revision)) return revision;
  }
  for (let revision = 1; revision < highWaterMark; revision += 1) {
    if (!used.has(revision)) return revision;
  }
  throw new RangeError("identity revision space exhausted");
}

export function resolveIdentityRevision(
  accountVersion: string | null,
  storage: IdentityRevisionStorage | null,
  memory: Map<string, number>,
  storageKey: string,
  maxEntries = 8,
): number {
  const scope = accountVersion ?? "anonymous";
  let persisted: StoredRevisionState = {
    entries: [],
    nextRevision: 1,
  };
  if (storage) {
    try {
      persisted = storedRevisionState(
        JSON.parse(storage.getItem(storageKey) || "[]"),
      );
    } catch {
      persisted = { entries: [], nextRevision: 1 };
    }
  }
  persisted.entries.forEach(([key, revision]) => {
    if (!memory.has(key)) memory.set(key, revision);
  });

  const existing = memory.get(scope);
  if (existing && Number.isSafeInteger(existing) && existing > 0) {
    return existing;
  }
  memory.delete(scope);

  const nextRevision = nextAvailableRevision(
    memory,
    persisted.nextRevision,
  );
  memory.set(scope, nextRevision);
  if (storage) {
    const nextEntries = [
      ...persisted.entries.filter(([key]) => key !== scope),
      [scope, nextRevision] as RevisionEntry,
    ].slice(-Math.max(1, maxEntries));
    try {
      storage.setItem(storageKey, JSON.stringify({
        entries: nextEntries,
        nextRevision: nextRevision < MAX_IDENTITY_REVISION
          ? nextRevision + 1
          : MAX_IDENTITY_REVISION,
      }));
    } catch {
      // The in-memory map preserves uniqueness for the rest of this page load.
    }
  }
  return nextRevision;
}
