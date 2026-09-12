import type { RuntimeConfig } from "./config.js";
import { SessionStore } from "./session.js";
import { jsonResponse, redirectResponse, withCookie } from "./responses.js";
import type { AsyncCache } from "./storage.js";
import { ZhihuClient, ZhihuApiError } from "../zhihu/client.js";
import { buildPortrait, PORTRAIT_TTL_SECONDS } from "./portrait.js";
import type { Portrait } from "./portrait.js";
import {
  buildGalaxy,
  GALAXY_FALLBACK_TTL_SECONDS,
  GALAXY_TTL_SECONDS,
} from "./galaxy.js";
import type { Galaxy } from "./galaxy.js";
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  fetchProfile,
  ZhihuOAuthError,
} from "../zhihu/oauth.js";

export interface HandlerDeps {
  config: RuntimeConfig;
  sessions: SessionStore;
  contentCache?: AsyncCache | null;
}

const GALAXY_ERROR_BACKOFF_SECONDS = 10 * 60;

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
  let galaxyInflight: Promise<Galaxy> | null = null;

  return async function handler(request: Request): Promise<Response> {
    const url = new URL(request.url);

    try {
      if (request.method === "GET" && url.pathname === "/api/health") {
        return jsonResponse(200, { ok: true, ...publicStatus(config) });
      }

      if (request.method === "GET" && url.pathname === "/api/oauth/status") {
        const { session, setCookie } = await sessions.touch(request);
        if (sessions.expireIfNeeded(session)) await sessions.save(session);
        return withCookie(
          jsonResponse(200, {
            ok: true,
            ...publicStatus(config),
            authorized: Boolean(session.token),
            profile: session.profile,
            stateVerified: session.stateVerified,
            expiresAt: session.expiresAt ? new Date(session.expiresAt).toISOString() : null,
            error: session.error,
          }),
          setCookie,
        );
      }

      if (request.method === "GET" && (url.pathname === "/login" || url.pathname === "/api/oauth/start")) {
        const { session, setCookie } = await sessions.touch(request);
        if (!config.oauthConfigured) {
          return redirectResponse(frontendRedirect(config, "error", "not_configured"), setCookie);
        }
        session.state = crypto.randomUUID();
        session.error = null;
        await sessions.save(session);
        return redirectResponse(
          buildAuthorizeUrl(config.appId, config.redirectUri!, session.state),
          setCookie,
        );
      }

      if (request.method === "GET" && url.pathname === "/auth/callback") {
        const { session, setCookie } = await sessions.touch(request);
        try {
          if (!config.oauthConfigured) {
            throw new ZhihuOAuthError("NOT_CONFIGURED", "后端 OAuth 凭证或回调地址未配置");
          }
          const code =
            url.searchParams.get("authorization_code") ?? url.searchParams.get("code");
          const returnedState = url.searchParams.get("state");

          if (!code) throw new ZhihuOAuthError("CODE_MISSING", "回调缺少 authorization_code");
          if (!sessions.verifyState(session, returnedState)) {
            throw new ZhihuOAuthError("STATE_MISMATCH", "state 校验失败");
          }

          const token = await exchangeCodeForToken({
            appId: config.appId,
            appKey: config.appKey,
            redirectUri: config.redirectUri!,
            code,
          });

          session.token = token.accessToken;
          session.expiresAt = token.expiresIn !== null ? Date.now() + token.expiresIn * 1000 : null;
          session.state = null;
          session.stateVerified = returnedState ? true : false;
          session.error = null;

          try {
            session.profile = await fetchProfile(config.accessSecret, token.accessToken);
          } catch {
            session.profile = null;
          }

          await sessions.save(session);
          return redirectResponse(frontendRedirect(config, "success"), setCookie);
        } catch (error) {
          const oauthError =
            error instanceof ZhihuOAuthError
              ? error
              : new ZhihuOAuthError(
                  "OAUTH_FAILED",
                  error instanceof Error ? error.message : "登录失败",
                );
          session.error = {
            code: oauthError.code,
            message: oauthError.message.slice(0, 200),
          };
          session.state = null;
          await sessions.save(session);
          return redirectResponse(frontendRedirect(config, "error"), setCookie);
        }
      }

      if (request.method === "POST" && url.pathname === "/api/oauth/logout") {
        const { session, setCookie } = await sessions.touch(request);
        sessions.reset(session);
        await sessions.save(session);
        return jsonResponse(200, { ok: true }, setCookie);
      }

      if (request.method === "GET" && url.pathname === "/api/me/portrait") {
        const { session, setCookie } = await sessions.touch(request);
        if (sessions.expireIfNeeded(session)) {
          await sessions.save(session);
          return withCookie(
            jsonResponse(401, {
              ok: false,
              error: { code: "TOKEN_EXPIRED", message: "授权已过期，请重新登录" },
            }),
            setCookie,
          );
        }
        if (!session.token) {
          return withCookie(
            jsonResponse(401, {
              ok: false,
              error: { code: "NOT_AUTHORIZED", message: "请先完成知乎登录" },
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

        const cacheKey = `portrait:${session.id}`;
        const forceRefresh = url.searchParams.get("refresh") === "1";
        if (contentCache && !forceRefresh) {
          const cached = await contentCache.get<Portrait>(cacheKey);
          if (cached && cached.ageMs <= PORTRAIT_TTL_SECONDS * 1000) {
            return withCookie(
              jsonResponse(200, { ok: true, cached: true, data: cached.value }),
              setCookie,
            );
          }
        }

        const portrait = await buildPortrait(client, session.token);
        await contentCache?.set(cacheKey, portrait, PORTRAIT_TTL_SECONDS);
        return withCookie(
          jsonResponse(200, { ok: true, cached: false, data: portrait }),
          setCookie,
        );
      }

      if (request.method === "GET" && url.pathname === "/api/galaxy") {
        if (!client) {
          return jsonResponse(503, {
            ok: false,
            error: { code: "NOT_CONFIGURED", message: "未配置 ZHIHU_ACCESS_SECRET" },
          });
        }

        const cacheKey = "galaxy:current";
        const errorKey = "galaxy:error-backoff";
        let staleGalaxy: Galaxy | null = null;
        if (contentCache) {
          const cached = await contentCache.get<Galaxy>(cacheKey);
          if (cached) {
            staleGalaxy = cached.value;
            const ttl = cached.value.source === "ai"
              ? GALAXY_TTL_SECONDS
              : GALAXY_FALLBACK_TTL_SECONDS;
            if (cached.ageMs <= ttl * 1000) {
              return jsonResponse(200, { ok: true, cached: true, data: cached.value });
            }
          }
          const blocked = await contentCache.get<{ code: number | string; message: string }>(
            errorKey,
          );
          if (blocked && blocked.ageMs <= GALAXY_ERROR_BACKOFF_SECONDS * 1000) {
            if (staleGalaxy) {
              return jsonResponse(200, {
                ok: true,
                cached: true,
                stale: true,
                data: staleGalaxy,
              });
            }
            throw new ZhihuApiError(blocked.value.code, blocked.value.message);
          }
        }

        const load = (): Promise<Galaxy> => {
          if (!galaxyInflight) {
            galaxyInflight = buildGalaxy(client).finally(() => {
              galaxyInflight = null;
            });
          }
          return galaxyInflight;
        };

        let galaxy: Galaxy;
        try {
          galaxy = await load();
        } catch (error) {
          if (contentCache && error instanceof ZhihuApiError) {
            await contentCache.set(
              errorKey,
              { code: error.code, message: error.message },
              GALAXY_ERROR_BACKOFF_SECONDS,
            );
          }
          if (staleGalaxy) {
            return jsonResponse(200, {
              ok: true,
              cached: true,
              stale: true,
              data: staleGalaxy,
            });
          }
          throw error;
        }
        if (galaxy.source === "fallback" && contentCache) {
          const previous = await contentCache.get<Galaxy>(cacheKey);
          if (
            previous &&
            previous.value.source === "ai" &&
            previous.ageMs <= GALAXY_TTL_SECONDS * 1000
          ) {
            return jsonResponse(200, { ok: true, cached: true, data: previous.value });
          }
        }
        await contentCache?.set(
          cacheKey,
          galaxy,
          galaxy.source === "ai" ? GALAXY_TTL_SECONDS : GALAXY_FALLBACK_TTL_SECONDS,
        );
        return jsonResponse(200, { ok: true, cached: false, data: galaxy });
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

      if (request.method === "GET" && url.pathname === "/api/zhihu/search") {
        if (!client) {
          return jsonResponse(503, {
            ok: false,
            error: { code: "NOT_CONFIGURED", message: "未配置 ZHIHU_ACCESS_SECRET" },
          });
        }
        const query = url.searchParams.get("q") ?? "";
        const count = Number(url.searchParams.get("count") ?? 10);
        return jsonResponse(200, { ok: true, data: await client.zhihuSearch(query, count) });
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
