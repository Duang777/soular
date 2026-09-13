import {
  expireOAuthToken,
  type SessionState,
} from "../core/session-state.js";
import type { SessionBackend } from "../core/storage.js";

interface StoredSession {
  state: SessionState;
  expiresAt: number;
}

export interface DurableObjectStorageLike {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  setAlarm(scheduledTime: number): Promise<void>;
  deleteAlarm(): Promise<void>;
}

export interface DurableObjectStateLike {
  storage: DurableObjectStorageLike;
  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>;
}

export interface DurableObjectStubLike {
  fetch(input: string | Request, init?: RequestInit): Promise<Response>;
}

export interface DurableObjectNamespaceLike {
  idFromName(name: string): unknown;
  get(id: unknown): DurableObjectStubLike;
}

const STORAGE_KEY = "session";
const INTERNAL_URL = "https://session.internal/";

function safeEqual(left: string | null, right: string | null): boolean {
  const a = String(left ?? "");
  const b = String(right ?? "");
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

export class SessionDurableObject {
  constructor(private readonly durableState: DurableObjectStateLike) {}

  async fetch(request: Request): Promise<Response> {
    return this.durableState.blockConcurrencyWhile(
      () => this.handleFetch(request),
    );
  }

  private async handleFetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET") {
      const stored = await this.durableState.storage.get<StoredSession>(STORAGE_KEY);
      if (!stored) return new Response(null, { status: 404 });
      if (stored.expiresAt <= Date.now()) {
        await this.durableState.storage.delete(STORAGE_KEY);
        await this.durableState.storage.deleteAlarm().catch(() => undefined);
        return new Response(null, { status: 404 });
      }
      if (expireOAuthToken(stored.state, Date.now())) {
        await this.durableState.storage.put(STORAGE_KEY, stored);
      }
      return Response.json(stored.state);
    }

    if (request.method === "PUT") {
      const payload = await request.json() as StoredSession & {
        expectedOAuthFlowId?: unknown;
      };
      if (
        !payload ||
        typeof payload !== "object" ||
        !payload.state ||
        typeof payload.state.id !== "string" ||
        typeof payload.expiresAt !== "number" ||
        !Number.isFinite(payload.expiresAt)
      ) {
        return new Response(null, { status: 400 });
      }
      const stored: StoredSession = {
        state: payload.state,
        expiresAt: payload.expiresAt,
      };
      if (url.pathname === "/commit") {
        if (typeof payload.expectedOAuthFlowId !== "string") {
          return new Response(null, { status: 400 });
        }
        const current =
          await this.durableState.storage.get<StoredSession>(STORAGE_KEY);
        if (
          !current ||
          current.expiresAt <= Date.now() ||
          !safeEqual(
            current.state.oauthFlowId,
            payload.expectedOAuthFlowId,
          ) ||
          !safeEqual(
            current.state.claimedOAuthFlowId,
            payload.expectedOAuthFlowId,
          )
        ) {
          return new Response(null, { status: 409 });
        }
      }
      await this.durableState.storage.setAlarm(stored.expiresAt);
      await this.durableState.storage.put(STORAGE_KEY, stored);
      return new Response(null, { status: 204 });
    }

    if (request.method === "POST" && url.pathname === "/start") {
      const start = await request.json() as {
        candidateState: string;
        stateExpiresAt: number;
        now: number;
      };
      const stored = await this.durableState.storage.get<StoredSession>(STORAGE_KEY);
      if (!stored || stored.expiresAt <= start.now) {
        return new Response(null, { status: 404 });
      }
      if (
        !stored.state.state ||
        typeof stored.state.stateExpiresAt !== "number" ||
        stored.state.stateExpiresAt <= start.now
      ) {
        expireOAuthToken(stored.state, start.now);
        stored.state.state = start.candidateState;
        stored.state.stateExpiresAt = start.stateExpiresAt;
        stored.state.oauthFlowId = start.candidateState;
        stored.state.claimedOAuthFlowId = null;
        stored.state.error = null;
        stored.expiresAt = Math.max(stored.expiresAt, start.stateExpiresAt);
        await this.durableState.storage.setAlarm(stored.expiresAt);
        await this.durableState.storage.put(STORAGE_KEY, stored);
      }
      return Response.json(stored.state);
    }

    if (request.method === "POST" && url.pathname === "/claim") {
      const claim = await request.json() as {
        returnedState: string | null;
        now: number;
      };
      const stored =
        await this.durableState.storage.get<StoredSession>(STORAGE_KEY);
      const valid =
        stored &&
        stored.expiresAt > claim.now &&
        typeof stored.state.state === "string" &&
        typeof stored.state.stateExpiresAt === "number" &&
        stored.state.stateExpiresAt > claim.now &&
        (
          claim.returnedState === null ||
          safeEqual(claim.returnedState, stored.state.state)
        );
      if (!stored || !valid) return new Response(null, { status: 409 });
      const claimedFlowId =
        stored.state.oauthFlowId ?? stored.state.state;
      stored.state.state = null;
      stored.state.stateExpiresAt = null;
      stored.state.oauthFlowId = claimedFlowId;
      stored.state.claimedOAuthFlowId = claimedFlowId;
      await this.durableState.storage.put(STORAGE_KEY, stored);
      return Response.json(stored.state);
    }

    if (request.method === "DELETE") {
      await this.durableState.storage.delete(STORAGE_KEY);
      await this.durableState.storage.deleteAlarm().catch(() => undefined);
      return new Response(null, { status: 204 });
    }

    return new Response(null, { status: 405 });
  }

  async alarm(): Promise<void> {
    await this.durableState.blockConcurrencyWhile(
      () => this.handleAlarm(),
    );
  }

  private async handleAlarm(): Promise<void> {
    const stored =
      await this.durableState.storage.get<StoredSession>(STORAGE_KEY);
    if (!stored) return;
    if (stored.expiresAt > Date.now()) {
      await this.durableState.storage.setAlarm(stored.expiresAt);
      return;
    }
    await this.durableState.storage.delete(STORAGE_KEY);
    await this.durableState.storage.deleteAlarm().catch(() => undefined);
  }
}

export class DurableSessionBackend implements SessionBackend {
  constructor(private readonly namespace: DurableObjectNamespaceLike) {}

  private stub(id: string): DurableObjectStubLike {
    return this.namespace.get(this.namespace.idFromName(id));
  }

  async load(id: string): Promise<SessionState | null> {
    const response = await this.stub(id).fetch(INTERNAL_URL);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("Durable Session 读取失败");
    const state = await response.json() as SessionState;
    return state?.id === id ? state : null;
  }

  async save(state: SessionState, ttlSeconds: number): Promise<void> {
    const response = await this.stub(state.id).fetch(INTERNAL_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        state,
        expiresAt: Date.now() + ttlSeconds * 1000,
      } satisfies StoredSession),
    });
    if (!response.ok) throw new Error("Durable Session 写入失败");
  }

  async delete(id: string): Promise<void> {
    const response = await this.stub(id).fetch(INTERNAL_URL, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Durable Session 删除失败");
  }

  async saveIfPresent(
    state: SessionState,
    ttlSeconds: number,
    expectedOAuthFlowId: string,
  ): Promise<boolean> {
    const response = await this.stub(state.id).fetch(`${INTERNAL_URL}commit`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        state,
        expiresAt: Date.now() + ttlSeconds * 1000,
        expectedOAuthFlowId,
      } satisfies StoredSession & { expectedOAuthFlowId: string }),
    });
    if (response.status === 409) return false;
    if (!response.ok) throw new Error("Durable Session 条件写入失败");
    return true;
  }

  async startOAuthState(
    id: string,
    candidateState: string,
    stateExpiresAt: number,
    now: number,
  ): Promise<SessionState | null> {
    const response = await this.stub(id).fetch(`${INTERNAL_URL}start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidateState,
        stateExpiresAt,
        now,
      }),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("Durable Session 授权初始化失败");
    return response.json() as Promise<SessionState>;
  }

  async claimOAuthState(
    id: string,
    returnedState: string | null,
    now: number,
  ): Promise<SessionState | null> {
    const response = await this.stub(id).fetch(`${INTERNAL_URL}claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnedState, now }),
    });
    if (response.status === 409 || response.status === 404) return null;
    if (!response.ok) throw new Error("Durable Session 状态校验失败");
    return response.json() as Promise<SessionState>;
  }
}
