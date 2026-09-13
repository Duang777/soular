import {
  expireOAuthToken,
  type SessionState,
} from "./session-state.js";

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
  saveIfPresent(
    state: SessionState,
    ttlSeconds: number,
    expectedOAuthFlowId: string,
  ): Promise<boolean>;
  delete(id: string): Promise<void>;
  startOAuthState(
    id: string,
    candidateState: string,
    stateExpiresAt: number,
    now: number,
  ): Promise<SessionState | null>;
  claimOAuthState(
    id: string,
    returnedState: string | null,
    now: number,
  ): Promise<SessionState | null>;
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
    const state = structuredClone(hit.state);
    if (expireOAuthToken(state, Date.now())) {
      this.store.set(id, {
        ...hit,
        state: structuredClone(state),
      });
    }
    return state;
  }

  async save(state: SessionState, ttlSeconds: number): Promise<void> {
    this.store.set(state.id, {
      state: structuredClone(state),
      storedAt: Date.now(),
      ttlMs: ttlSeconds * 1000,
    });
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async saveIfPresent(
    state: SessionState,
    ttlSeconds: number,
    expectedOAuthFlowId: string,
  ): Promise<boolean> {
    const current = this.store.get(state.id);
    if (
      !current ||
      current.storedAt + current.ttlMs <= Date.now() ||
      current.state.oauthFlowId !== expectedOAuthFlowId ||
      current.state.claimedOAuthFlowId !== expectedOAuthFlowId
    ) {
      return false;
    }
    this.store.set(state.id, {
      state: structuredClone(state),
      storedAt: Date.now(),
      ttlMs: ttlSeconds * 1000,
    });
    return true;
  }

  async startOAuthState(
    id: string,
    candidateState: string,
    stateExpiresAt: number,
    now: number,
  ): Promise<SessionState | null> {
    const hit = this.store.get(id);
    if (!hit || hit.storedAt + hit.ttlMs <= now) return null;
    const session = structuredClone(hit.state);
    if (
      session.state &&
      typeof session.stateExpiresAt === "number" &&
      session.stateExpiresAt > now
    ) {
      return session;
    }
    expireOAuthToken(session, now);
    session.state = candidateState;
    session.stateExpiresAt = stateExpiresAt;
    session.oauthFlowId = candidateState;
    session.claimedOAuthFlowId = null;
    session.error = null;
    this.store.set(id, {
      state: structuredClone(session),
      storedAt: now,
      ttlMs: Math.max(
        60_000,
        hit.storedAt + hit.ttlMs - now,
        stateExpiresAt - now,
      ),
    });
    return session;
  }

  async claimOAuthState(
    id: string,
    returnedState: string | null,
    now: number,
  ): Promise<SessionState | null> {
    const hit = this.store.get(id);
    if (!hit || hit.storedAt + hit.ttlMs <= now) return null;
    const session = structuredClone(hit.state);
    const valid =
      session?.state &&
      typeof session.stateExpiresAt === "number" &&
      session.stateExpiresAt > now &&
      (returnedState === null || returnedState === session.state);
    if (!valid) return null;
    const claimedFlowId = session.oauthFlowId ?? session.state;
    session.state = null;
    session.stateExpiresAt = null;
    session.oauthFlowId = claimedFlowId;
    session.claimedOAuthFlowId = claimedFlowId;
    this.store.set(id, {
      ...hit,
      state: structuredClone(session),
    });
    return session;
  }
}
