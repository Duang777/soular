export interface RuntimeConfig {
  appId: string;
  appKey: string;
  accessSecret: string;
  redirectUri: string | null;
  frontendUrl: string;
  cookieSecure: boolean;
  oauthConfigured: boolean;
  dataApiConfigured: boolean;
}

export type Environment = Record<string, string | undefined>;

export function parseRedirectUri(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("ZHIHU_REDIRECT_URI 不是合法 URL，需为公网 HTTPS 且以 /auth/callback 结尾");
  }
  if (url.protocol !== "https:") {
    throw new Error("ZHIHU_REDIRECT_URI 必须是 https 公网地址（localhost 无法完成知乎登录）");
  }
  if (!url.pathname.endsWith("/auth/callback")) {
    throw new Error("ZHIHU_REDIRECT_URI 必须以 /auth/callback 结尾");
  }
  return url.toString();
}

export function buildRuntimeConfig(env: Environment): RuntimeConfig {
  const appId = (env.ZHIHU_APP_ID ?? "").trim();
  const appKey = (env.ZHIHU_OAUTH_APP_KEY ?? "").trim();
  const accessSecret = (env.ZHIHU_ACCESS_SECRET ?? "").trim();
  const redirectUri = parseRedirectUri(env.ZHIHU_REDIRECT_URI);
  const frontendUrl = (env.FRONTEND_URL ?? "http://localhost:4325/").trim();
  try {
    new URL(frontendUrl);
  } catch {
    throw new Error("FRONTEND_URL 必须是合法的绝对 URL");
  }

  return {
    appId,
    appKey,
    accessSecret,
    redirectUri,
    frontendUrl,
    cookieSecure: redirectUri?.startsWith("https:") ?? false,
    oauthConfigured: Boolean(appId && appKey && redirectUri),
    dataApiConfigured: Boolean(accessSecret),
  };
}
