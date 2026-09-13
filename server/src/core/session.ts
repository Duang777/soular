import type { SessionState } from "./session-state.js";
import type { SessionBackend } from "./storage.js";

const SESSION_COOKIE = "zhihu_oauth_session";
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

export interface TouchResult {
  session: SessionState;
  setCookie: string | null;
}

export interface ClearResult {
  setCookie: string | null;
  storageCleared: boolean;
}

function newToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export class SessionStore {
  constructor(
    private readonly backend: SessionBackend,
    private readonly cookieSecure: boolean,
  ) {}

  private readSid(request: Request): string | null {
    const cookie = request.headers.get("cookie");
    if (!cookie) return null;
    for (const part of cookie.split(";")) {
      const item = part.trim();
      if (item.startsWith(`${SESSION_COOKIE}=`)) {
        try {
          const value = decodeURIComponent(item.slice(SESSION_COOKIE.length + 1));
          return /^[A-Za-z0-9_-]{32}$/.test(value) ? value : null;
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  ttlSeconds(session: SessionState): number {
    const expiresAt = Math.max(
      session.expiresAt ?? 0,
      session.stateExpiresAt ?? 0,
    );
    if (!expiresAt) return SESSION_TTL_SECONDS;
    const remaining = Math.ceil((expiresAt - Date.now()) / 1000);
    return Math.min(SESSION_TTL_SECONDS, Math.max(60, remaining));
  }

  private buildCookie(session: SessionState): string {
    const cookie = [
      `${SESSION_COOKIE}=${encodeURIComponent(session.id)}`,
      "HttpOnly",
      "SameSite=Lax",
      "Path=/",
      `Max-Age=${SESSION_TTL_SECONDS}`,
    ];
    if (this.cookieSecure) cookie.push("Secure");
    return cookie.join("; ");
  }

  private buildExpiredCookie(): string {
    const cookie = [
      `${SESSION_COOKIE}=`,
      "HttpOnly",
      "SameSite=Lax",
      "Path=/",
      "Max-Age=0",
      "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    ];
    if (this.cookieSecure) cookie.push("Secure");
    return cookie.join("; ");
  }

  private blankSession(): SessionState {
    return {
      id: newToken(),
      state: null,
      stateExpiresAt: null,
      oauthFlowId: null,
      claimedOAuthFlowId: null,
      token: null,
      expiresAt: null,
      profile: null,
      stateVerified: null,
      error: null,
    };
  }

  async load(request: Request): Promise<SessionState | null> {
    const sid = this.readSid(request);
    return sid ? this.backend.load(sid) : null;
  }

  async touch(request: Request): Promise<TouchResult> {
    const loaded = await this.load(request);
    if (loaded) return { session: loaded, setCookie: null };
    const session = this.blankSession();
    await this.backend.save(session, SESSION_TTL_SECONDS);
    return { session, setCookie: this.buildCookie(session) };
  }

  async begin(
    request: Request,
    state: string,
    stateExpiresAt: number,
  ): Promise<TouchResult> {
    const sid = this.readSid(request);
    if (sid) {
      const current = await this.backend.startOAuthState(
        sid,
        state,
        stateExpiresAt,
        Date.now(),
      );
      if (current) return { session: current, setCookie: null };
    }

    const session = this.blankSession();
    session.state = state;
    session.stateExpiresAt = stateExpiresAt;
    session.oauthFlowId = state;
    await this.backend.save(session, SESSION_TTL_SECONDS);
    return { session, setCookie: this.buildCookie(session) };
  }

  async clear(request: Request): Promise<ClearResult> {
    const sid = this.readSid(request);
    let storageCleared = true;
    if (sid) {
      try {
        await this.backend.delete(sid);
      } catch {
        storageCleared = false;
      }
    }
    return {
      setCookie: storageCleared ? this.buildExpiredCookie() : null,
      storageCleared,
    };
  }

  async claimOAuthCallback(
    request: Request,
    returnedState: string | null,
  ): Promise<SessionState | null> {
    const sid = this.readSid(request);
    return sid
      ? this.backend.claimOAuthState(sid, returnedState, Date.now())
      : null;
  }

  async save(session: SessionState): Promise<void> {
    await this.backend.save(session, this.ttlSeconds(session));
  }

  async saveIfPresent(
    session: SessionState,
    expectedOAuthFlowId: string,
  ): Promise<boolean> {
    return this.backend.saveIfPresent(
      session,
      this.ttlSeconds(session),
      expectedOAuthFlowId,
    );
  }

}
