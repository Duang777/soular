import type { SessionState } from "../core/session-state.js";
import type { AsyncCache, SessionBackend } from "../core/storage.js";

export interface KVNamespaceLike {
  getWithMetadata(
    key: string,
    options: { type: "json" },
  ): Promise<{ value: unknown; metadata: { cachedAt?: number } | null } | null>;
  put(
    key: string,
    value: string,
    options: { expirationTtl: number; metadata?: unknown },
  ): Promise<void>;
  delete(key: string): Promise<void>;
}

const SESSION_PREFIX = "sess:";
const CACHE_PREFIX = "cache:";
const STALE_TTL_FACTOR = 6;
const MAX_STORAGE_TTL_SECONDS = 24 * 60 * 60;

function encodeCacheKey(raw: string): string {
  return CACHE_PREFIX + encodeURIComponent(raw);
}

export class KvSessionBackend implements SessionBackend {
  private readonly l1 = new Map<string, { state: SessionState; expiresAt: number }>();

  constructor(private readonly kv: KVNamespaceLike) {}

  async load(id: string): Promise<SessionState | null> {
    const l1Hit = this.l1.get(id);
    if (l1Hit && l1Hit.expiresAt > Date.now()) return l1Hit.state;
    if (l1Hit) this.l1.delete(id);

    const result = await this.kv.getWithMetadata(SESSION_PREFIX + id, { type: "json" });
    const state = (result?.value as SessionState | null) ?? null;
    if (state && state.id === id) {
      this.l1.set(id, { state, expiresAt: Date.now() + 60 * 1000 });
      return state;
    }
    return null;
  }

  async save(state: SessionState, ttlSeconds: number): Promise<void> {
    this.l1.set(state.id, {
      state,
      expiresAt: Date.now() + Math.min(ttlSeconds, 10 * 60) * 1000,
    });
    if (this.l1.size > 500) {
      const firstKey = this.l1.keys().next().value;
      if (firstKey) this.l1.delete(firstKey);
    }
    await this.kv.put(SESSION_PREFIX + state.id, JSON.stringify(state), {
      expirationTtl: ttlSeconds,
    });
  }
}

export class KvContentCache implements AsyncCache {
  private readonly l1 = new Map<string, { value: unknown; storedAt: number; ttlMs: number }>();

  constructor(private readonly kv: KVNamespaceLike) {}

  async get<T>(key: string): Promise<{ value: T; ageMs: number } | null> {
    const l1Hit = this.l1.get(key);
    if (l1Hit && l1Hit.storedAt + l1Hit.ttlMs > Date.now()) {
      return { value: l1Hit.value as T, ageMs: Date.now() - l1Hit.storedAt };
    }

    const result = await this.kv.getWithMetadata(encodeCacheKey(key), { type: "json" });
    if (!result || result.value === null || result.value === undefined) return null;
    const cachedAt = result.metadata?.cachedAt;
    if (!cachedAt) return null;
    return { value: result.value as T, ageMs: Math.max(0, Date.now() / 1000 - cachedAt) * 1000 };
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const now = Date.now();
    this.l1.set(key, { value, storedAt: now, ttlMs: ttlSeconds * 1000 });
    if (this.l1.size > 500) {
      const firstKey = this.l1.keys().next().value;
      if (firstKey) this.l1.delete(firstKey);
    }
    const storageTtl = Math.min(
      Math.max(ttlSeconds * STALE_TTL_FACTOR, 60),
      MAX_STORAGE_TTL_SECONDS,
    );
    await this.kv.put(encodeCacheKey(key), JSON.stringify(value), {
      expirationTtl: storageTtl,
      metadata: { cachedAt: Math.floor(now / 1000) },
    });
  }
}
