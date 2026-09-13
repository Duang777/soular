import type { RuntimeConfig } from "./config.js";
import { SessionStore } from "./session.js";
import { jsonResponse, redirectResponse, withCookie } from "./responses.js";
import type { AsyncCache } from "./storage.js";
import { ZhihuClient, ZhihuApiError } from "../zhihu/client.js";
import {
  buildPortrait,
  PARTIAL_PORTRAIT_TTL_SECONDS,
  PORTRAIT_TTL_SECONDS,
  PortraitUnavailableError,
} from "./portrait.js";
import type { Portrait } from "./portrait.js";
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  fetchProfile,
  ZhihuOAuthError,
} from "../zhihu/oauth.js";

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

export interface HandlerDeps {
  config: RuntimeConfig;
  sessions: SessionStore;
  contentCache?: AsyncCache | null;
}

function publicStatus(config: RuntimeConfig) {
  return {
    configured: config.oauthConfigured,
    dataApiConfigured: config.dataApiConfigured,
    appId: config.appId || null,
    redirectUri: config.redirectUri,
  };
}

function frontendRedirect(config: RuntimeConfig, status: "success" | "error", reason?: string): string {
  const target = new URL(config.frontendUrl);
  target.searchParams.set("oauth", status);
  if (reason) target.searchParams.set("reason", reason);
  return target.toString();
}

function zhihuErrorStatus(error: ZhihuApiError): number {
  if (error.code === 10001) return 400;
  if (error.code === 30001 || error.code === 30002) return 429;
  return 502;
}

export function createHandler(deps: HandlerDeps): (request: Request) => Promise<Response> {
  const { config, sessions, contentCache = null } = deps;
  const client = config.dataApiConfigured
    ? new ZhihuClient(config.accessSecret, contentCache)
    : null;
  const portraitInflight = new Map<string, Promise<Portrait>>();

  return async function handler(request: Request): Promise<Response> {
    const url = new URL(request.url);

    try {
      if (request.method === "GET" && url.pathname === "/api/health") {
        return jsonResponse(200, { ok: true, ...publicStatus(config) });
      }

      if (request.method === "GET" && url.pathname === "/api/oauth/status") {
        const session = await sessions.load(request);
        if (!session) {
          return jsonResponse(200, {
            ok: true,
            ...publicStatus(config),
            authorized: false,
            profile: null,
            stateVerified: null,
            expiresAt: null,
            error: null,
          });
        }
        return jsonResponse(200, {
          ok: true,
          ...publicStatus(config),
          authorized: Boolean(session.token),
          profile: session.profile,
          stateVerified: session.stateVerified,
          expiresAt: session.expiresAt ? new Date(session.expiresAt).toISOString() : null,
          error: session.error,
        });
      }

      if (request.method === "GET" && (url.pathname === "/login" || url.pathname === "/api/oauth/start")) {
        if (!config.oauthConfigured) {
          return redirectResponse(frontendRedirect(config, "error", "not_configured"));
        }
        const state = crypto.randomUUID();
        const { session, setCookie } = await sessions.begin(
          request,
          state,
          Date.now() + OAUTH_STATE_TTL_MS,
        );
        return redirectResponse(
          buildAuthorizeUrl(config.appId, config.redirectUri!, session.state!),
          setCookie,
        );
      }

      if (request.method === "GET" && url.pathname === "/auth/callback") {
        let session = null as Awaited<
          ReturnType<SessionStore["claimOAuthCallback"]>
        >;
        let claimedFlowId: string | null = null;
        try {
          if (!config.oauthConfigured) {
            throw new ZhihuOAuthError("NOT_CONFIGURED", "后端 OAuth 凭证或回调地址未配置");
          }
          const code =
            url.searchParams.get("authorization_code") ?? url.searchParams.get("code");
          const returnedState = url.searchParams.get("state");

          session = await sessions.claimOAuthCallback(request, returnedState);
          if (!session) {
            throw new ZhihuOAuthError("STATE_MISMATCH", "state 校验失败");
          }
          claimedFlowId = session.claimedOAuthFlowId;
          if (!claimedFlowId) {
            throw new ZhihuOAuthError("STATE_MISMATCH", "授权流程标识无效");
          }
          if (!code) {
            throw new ZhihuOAuthError(
              "CODE_MISSING",
              "回调缺少 authorization_code",
            );
          }

          const token = await exchangeCodeForToken({
            appId: config.appId,
            appKey: config.appKey,
            redirectUri: config.redirectUri!,
            code,
          });

          session.token = token.accessToken;
          session.expiresAt = token.expiresIn !== null ? Date.now() + token.expiresIn * 1000 : null;
          session.oauthFlowId = null;
          session.claimedOAuthFlowId = null;
          session.stateVerified = returnedState !== null;
          session.error = null;

          try {
            session.profile = await fetchProfile(config.accessSecret, token.accessToken);
          } catch {
            session.profile = null;
          }

          if (!await sessions.saveIfPresent(session, claimedFlowId)) {
            throw new ZhihuOAuthError(
              "FLOW_SUPERSEDED",
              "授权流程已失效，请重新登录",
            );
          }
          return redirectResponse(frontendRedirect(config, "success"));
        } catch (error) {
          const oauthError =
            error instanceof ZhihuOAuthError
              ? error
              : new ZhihuOAuthError(
                  "OAUTH_FAILED",
                  error instanceof Error ? error.message : "登录失败",
                );
          if (session && claimedFlowId) {
            session.error = {
              code: oauthError.code,
              message: oauthError.message.slice(0, 200),
            };
            session.oauthFlowId = null;
            session.claimedOAuthFlowId = null;
            try {
              await sessions.saveIfPresent(session, claimedFlowId);
            } catch {
              // The redirect remains usable even if error persistence is unavailable.
            }
          }
          return redirectResponse(frontendRedirect(config, "error"));
        }
      }

      if (request.method === "POST" && url.pathname === "/api/oauth/logout") {
        const cleared = await sessions.clear(request);
        if (!cleared.storageCleared) {
          return jsonResponse(503, {
            ok: false,
            error: {
              code: "SESSION_DELETE_FAILED",
              message: "退出暂时失败，请重试",
            },
          }, cleared.setCookie);
        }
        return jsonResponse(200, { ok: true }, cleared.setCookie);
      }

      if (request.method === "GET" && url.pathname === "/api/me/portrait") {
        const { session, setCookie } = await sessions.touch(request);
        const oauthToken = session.token;
        if (!oauthToken) {
          const tokenExpired = session.error?.code === "TOKEN_EXPIRED";
          return withCookie(
            jsonResponse(401, {
              ok: false,
              error: {
                code: tokenExpired ? "TOKEN_EXPIRED" : "NOT_AUTHORIZED",
                message: tokenExpired
                  ? "授权已过期，请重新登录"
                  : "请先完成知乎登录",
              },
            }),
            setCookie,
          );
        }
        if (!client) {
          return jsonResponse(503, {
            ok: false,
            error: { code: "NOT_CONFIGURED", message: "未配置 ZHIHU_ACCESS_SECRET" },
          });
        }

        const accountFingerprint = await sha256Hex(oauthToken);
        const cacheKey = `portrait:${accountFingerprint}`;
        const failureCacheKey = `portrait-failure:${accountFingerprint}`;
        if (contentCache) {
          try {
            const cached = await contentCache.get<Portrait>(cacheKey);
            const cacheTtl =
              cached &&
                Array.isArray(cached.value.warnings) &&
                cached.value.warnings.length > 0
                ? PARTIAL_PORTRAIT_TTL_SECONDS
                : PORTRAIT_TTL_SECONDS;
            if (cached && cached.ageMs <= cacheTtl * 1000) {
              return withCookie(
                jsonResponse(200, {
                  ok: true,
                  cached: true,
                  data: cached.value,
                }),
                setCookie,
              );
            }
          } catch {
            // Cache outages must not block fresh user-data reads.
          }

          try {
            const recentFailure =
              await contentCache.get<boolean>(failureCacheKey);
            if (
              recentFailure?.value === true &&
              recentFailure.ageMs < PARTIAL_PORTRAIT_TTL_SECONDS * 1000
            ) {
              throw new PortraitUnavailableError();
            }
          } catch (error) {
            if (error instanceof PortraitUnavailableError) throw error;
            // Cache outages must not replace the upstream result.
          }
        }

        let portraitPromise = portraitInflight.get(cacheKey);
        if (!portraitPromise) {
          portraitPromise = buildPortrait(client, oauthToken).finally(() => {
            portraitInflight.delete(cacheKey);
          });
          portraitInflight.set(cacheKey, portraitPromise);
        }
        let portrait: Portrait;
        try {
          portrait = await portraitPromise;
        } catch (error) {
          if (error instanceof PortraitUnavailableError) {
            try {
              await contentCache?.set(
                failureCacheKey,
                true,
                PARTIAL_PORTRAIT_TTL_SECONDS,
              );
            } catch {
              // Preserve the original upstream error when cache storage fails.
            }
          }
          throw error;
        }
        if (contentCache) {
          await Promise.allSettled([
            contentCache.set(
              cacheKey,
              portrait,
              portrait.warnings.length
                ? PARTIAL_PORTRAIT_TTL_SECONDS
                : PORTRAIT_TTL_SECONDS,
            ),
            contentCache.set(
              failureCacheKey,
              false,
              PARTIAL_PORTRAIT_TTL_SECONDS,
            ),
          ]);
        }
        return withCookie(
          jsonResponse(200, { ok: true, cached: false, data: portrait }),
          setCookie,
        );
      }

      if (request.method === "GET" && url.pathname === "/api/zhihu/hot") {
        if (!client) {
          return jsonResponse(503, {
            ok: false,
            error: { code: "NOT_CONFIGURED", message: "未配置 ZHIHU_ACCESS_SECRET" },
          });
        }
        const limit = Number(url.searchParams.get("limit") ?? 30);
        return jsonResponse(200, { ok: true, data: await client.hotList(limit) });
      }

      if (url.pathname.startsWith("/api/")) {
        return jsonResponse(404, {
          ok: false,
          error: { code: "NOT_FOUND", message: "接口不存在" },
        });
      }

      return jsonResponse(404, {
        ok: false,
        error: { code: "NOT_FOUND", message: "后端仅提供 API 与 OAuth 接口" },
      });
    } catch (error) {
      if (error instanceof PortraitUnavailableError) {
        return jsonResponse(503, {
          ok: false,
          error: {
            code: "PORTRAIT_UNAVAILABLE",
            message: error.message,
          },
        });
      }
      if (error instanceof ZhihuApiError) {
        return jsonResponse(zhihuErrorStatus(error), {
          ok: false,
          error: { code: error.code, message: error.message },
        });
      }
      return jsonResponse(500, {
        ok: false,
        error: {
          code: "INTERNAL",
          message: error instanceof Error ? error.message : "服务器内部错误",
        },
      });
    }
  };
}
