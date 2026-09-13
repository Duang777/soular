import type { ZhihuProfile } from "../types.js";

export interface SessionError {
  code: string;
  message: string;
}

export interface SessionState {
  id: string;
  state: string | null;
  stateExpiresAt: number | null;
  oauthFlowId: string | null;
  claimedOAuthFlowId: string | null;
  token: string | null;
  expiresAt: number | null;
  profile: ZhihuProfile | null;
  stateVerified: boolean | null;
  error: SessionError | null;
}

export function expireOAuthToken(
  session: SessionState,
  now: number,
): boolean {
  if (!session.expiresAt || session.expiresAt > now) return false;
  session.token = null;
  session.expiresAt = null;
  session.profile = null;
  session.error = {
    code: "TOKEN_EXPIRED",
    message: "授权已过期，请重新登录。",
  };
  return true;
}
