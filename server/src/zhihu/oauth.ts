import type { ZhihuProfile } from "../types.js";

const OPENAPI_BASE = "https://openapi.zhihu.com";
const REQUEST_TIMEOUT_MS = 20_000;
const PROFILE_REQUEST_TIMEOUT_MS = 6_000;

export class ZhihuOAuthError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ZhihuOAuthError";
    this.code = code;
  }
}

type Loose = Record<string, unknown>;

function asRecord(value: unknown): Loose | null {
  return value && typeof value === "object" ? (value as Loose) : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function deepString(root: unknown, ...keys: string[]): string | null {
  let current: unknown = root;
  for (const key of keys) {
    const record = asRecord(current);
    if (!record) return null;
    current = record[key];
  }
  return asString(current);
}

function assertSafe(value: string, label: string): string {
  if (!value || /[\r\n"\\]/.test(value)) {
    throw new ZhihuOAuthError("INVALID_CREDENTIAL", `${label} 格式无效`);
  }
  return value;
}

function payloadError(payload: unknown, fallback: string): ZhihuOAuthError {
  const record = asRecord(payload);
  const data = record?.data ?? record?.Data;
  const message =
    (typeof data === "string" && data) ||
    deepString(data, "message") ||
    asString(record?.message) ||
    asString(record?.Message) ||
    fallback;
  const code =
    asString(record?.code) ?? asString(record?.Code) ?? "OAUTH_FAILED";
  return new ZhihuOAuthError(code, String(message).slice(0, 200));
}

function shouldRetryWithOAuthBearer(
  response: Response,
  payload: unknown,
): boolean {
  if (response.status === 401 || response.status === 403) return true;
  const record = asRecord(payload);
  const code = String(record?.code ?? record?.Code ?? "");
  return /^40[13]/.test(code);
}

export interface TokenExchangeInput {
  appId: string;
  appKey: string;
  redirectUri: string;
  code: string;
}

export interface TokenResult {
  accessToken: string;
  tokenType: string | null;
  expiresIn: number | null;
}

function profileFromPayload(payload: unknown): ZhihuProfile | null {
  const root = asRecord(payload);
  const data = asRecord(root?.data) ?? asRecord(root?.Data);
  const record =
    asRecord(data?.user) ??
    data ??
    asRecord(root?.user) ??
    root;
  if (!record) return null;

  const profile: ZhihuProfile = {
    name:
      asString(record.name) ??
      asString(record.Fullname) ??
      asString(record.fullname) ??
      asString(record.Name),
    avatarUrl:
      asString(record.avatar_url) ??
      asString(record.avatar_path) ??
      asString(record.AvatarUrl) ??
      asString(record.AvatarPath) ??
      asString(record.avatarPath) ??
      asString(record.avatarUrl),
    headline:
      asString(record.headline) ??
      asString(record.Headline) ??
      asString(record.headline2),
    url: asString(record.url) ?? asString(record.Url) ?? asString(record.profileUrl),
  };
  return profile.name || profile.avatarUrl || profile.url ? profile : null;
}

export function buildAuthorizeUrl(
  appId: string,
  redirectUri: string,
  state: string,
): string {
  const url = new URL("/authorize", OPENAPI_BASE);
  url.searchParams.set("app_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeCodeForToken(
  input: TokenExchangeInput,
): Promise<TokenResult> {
  const code = input.code.trim();
  if (!code) throw new ZhihuOAuthError("CODE_MISSING", "回调缺少 authorization_code");

  const body = new URLSearchParams({
    app_id: assertSafe(input.appId, "app_id"),
    app_key: assertSafe(input.appKey, "app_key"),
    grant_type: "authorization_code",
    redirect_uri: input.redirectUri,
    code: assertSafe(code, "authorization_code"),
  });

  const response = await fetch(`${OPENAPI_BASE}/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!payload) throw new ZhihuOAuthError("BAD_RESPONSE", "token 接口返回了无法解析的响应");

  const accessToken =
    deepString(payload, "access_token") ??
    deepString(payload, "data", "access_token") ??
    deepString(payload, "Data", "access_token");

  if (!accessToken) throw payloadError(payload, "未获得 OAuth access token");

  const expiresRaw =
    deepString(payload, "expires_in") ??
    deepString(payload, "data", "expires_in") ??
    deepString(payload, "Data", "expires_in");
  const expiresInNumber = expiresRaw ? Number(expiresRaw) : NaN;

  return {
    accessToken,
    tokenType:
      deepString(payload, "token_type") ??
      deepString(payload, "data", "token_type") ??
      deepString(payload, "Data", "token_type"),
    expiresIn: Number.isFinite(expiresInNumber) ? expiresInNumber : null,
  };
}

export async function fetchProfile(
  accessSecret: string,
  oauthToken: string,
): Promise<ZhihuProfile | null> {
  const safeAccessSecret = assertSafe(accessSecret, "Access Secret");
  const safeOAuthToken = assertSafe(oauthToken, "OAuth token");
  const signal = AbortSignal.timeout(PROFILE_REQUEST_TIMEOUT_MS);
  const primaryResponse = await fetch(`${OPENAPI_BASE}/user`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${safeAccessSecret}`,
      "X-OAuth-Token": safeOAuthToken,
      "X-Request-Timestamp": String(Math.floor(Date.now() / 1000)),
      "Content-Type": "application/json",
    },
    signal,
  });
  const primaryPayload: unknown =
    await primaryResponse.json().catch(() => null);
  const primaryProfile = profileFromPayload(primaryPayload);
  if (primaryProfile) return primaryProfile;
  if (!shouldRetryWithOAuthBearer(primaryResponse, primaryPayload)) {
    if (!primaryResponse.ok) {
      throw payloadError(primaryPayload, "用户资料接口请求失败");
    }
    return null;
  }

  const oauthResponse = await fetch(`${OPENAPI_BASE}/user`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${safeOAuthToken}`,
      "Content-Type": "application/json",
    },
    signal,
  });
  const oauthPayload: unknown = await oauthResponse.json().catch(() => null);
  return profileFromPayload(oauthPayload);
}
