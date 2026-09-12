import type { SessionState } from "./session-state.js";

export interface CacheEntry<T> {
  value: T;
  ageMs: number;
}

export interface AsyncCache {
  get<T>(key: string): Promise<CacheEntry<T> | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
}

export interface SessionBackend {
  load(id: string): Promise<SessionState | null>;
  save(state: SessionState, ttlSeconds: number): Promise<void>;
}

export class InMemoryCache implements AsyncCache {
  private readonly store = new Map<string, { value: unknown; storedAt: number; ttlMs: number }>();

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const hit = this.store.get(key);
    if (!hit) return null;
    if (hit.storedAt + hit.ttlMs <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return { value: hit.value as T, ageMs: Date.now() - hit.storedAt };
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.store.set(key, {
      value,
      storedAt: Date.now(),
      ttlMs: ttlSeconds * 1000,
    });
  }
}

export class InMemorySessionBackend implements SessionBackend {
  private readonly store = new Map<string, { state: SessionState; storedAt: number; ttlMs: number }>();

  async load(id: string): Promise<SessionState | null> {
    const hit = this.store.get(id);
    if (!hit) return null;
    if (hit.storedAt + hit.ttlMs <= Date.now()) {
      this.store.delete(id);
      return null;
    }
    return hit.state;
  }

  async save(state: SessionState, ttlSeconds: number): Promise<void> {
    this.store.set(state.id, {
      state,
      storedAt: Date.now(),
      ttlMs: ttlSeconds * 1000,
    });
  }
}
