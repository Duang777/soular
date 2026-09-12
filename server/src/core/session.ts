import type { SessionState } from "./session-state.js";
import type { SessionBackend } from "./storage.js";

const SESSION_COOKIE = "zhihu_oauth_session";
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

export interface TouchResult {
  session: SessionState;
  setCookie: string | null;
}

function newToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function safeEqual(left: string | null, right: string | null): boolean {
  const a = String(left ?? "");
  const b = String(right ?? "");
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
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
        return decodeURIComponent(item.slice(SESSION_COOKIE.length + 1));
      }
    }
    return null;
  }

  ttlSeconds(session: SessionState): number {
    if (!session.expiresAt) return SESSION_TTL_SECONDS;
    const remaining = Math.ceil((session.expiresAt - Date.now()) / 1000);
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

  private blankSession(): SessionState {
    return {
      id: newToken(),
      state: null,
      token: null,
      expiresAt: null,
      profile: null,
      stateVerified: null,
      error: null,
    };
  }

  async touch(request: Request): Promise<TouchResult> {
    const sid = this.readSid(request);
    if (sid) {
      const loaded = await this.backend.load(sid);
      if (loaded) return { session: loaded, setCookie: null };
    }
    const session = this.blankSession();
    await this.backend.save(session, SESSION_TTL_SECONDS);
    return { session, setCookie: this.buildCookie(session) };
  }

  async save(session: SessionState): Promise<void> {
    await this.backend.save(session, this.ttlSeconds(session));
  }

  reset(session: SessionState): void {
    session.state = null;
    session.token = null;
    session.expiresAt = null;
    session.profile = null;
    session.stateVerified = null;
    session.error = null;
  }

  expireIfNeeded(session: SessionState): boolean {
    if (session.expiresAt && session.expiresAt <= Date.now()) {
      session.token = null;
      session.expiresAt = null;
      session.profile = null;
      session.error = { code: "TOKEN_EXPIRED", message: "授权已过期，请重新登录。" };
      return true;
    }
    return false;
  }

  verifyState(session: SessionState, returnedState: string | null): boolean {
    if (!returnedState) {
      session.stateVerified = false;
      return true;
    }
    const matched = safeEqual(returnedState, session.state);
    session.stateVerified = matched;
    return matched;
  }
}
