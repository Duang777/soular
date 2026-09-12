import type { ZhihuProfile } from "../types.js";

export interface SessionError {
  code: string;
  message: string;
}

export interface SessionState {
  id: string;
  state: string | null;
  token: string | null;
  expiresAt: number | null;
  profile: ZhihuProfile | null;
  stateVerified: boolean | null;
  error: SessionError | null;
}
