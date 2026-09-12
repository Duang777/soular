import { buildRuntimeConfig, type Environment } from "./core/config.js";
import { createHandler } from "./core/app.js";
import { corsPreflight, withCors } from "./core/cors.js";
import { SessionStore } from "./core/session.js";
import { KvContentCache, KvSessionBackend, type KVNamespaceLike } from "./adapters/cloudflare-kv.js";

interface AssetBinding {
  fetch(request: Request): Promise<Response>;
}

export interface Env {
  ZHIHU_APP_ID?: string;
  ZHIHU_OAUTH_APP_KEY?: string;
  ZHIHU_ACCESS_SECRET?: string;
  ZHIHU_REDIRECT_URI?: string;
  FRONTEND_ORIGIN?: string;
  ASSETS: AssetBinding;
  KV: KVNamespaceLike;
  [key: string]: unknown;
}

type FetchHandler = (request: Request) => Promise<Response>;

interface CachedHandler {
  fingerprint: string;
  handle: FetchHandler;
}

let cached: CachedHandler | null = null;

function resolveHandler(env: Env): FetchHandler {
  if (!env.KV || typeof env.KV.getWithMetadata !== "function") {
    throw new Error("缺少 KV 绑定：请在 wrangler.toml 配置 [[kv_namespaces]] binding = \"KV\"");
  }

  const config = buildRuntimeConfig(env as unknown as Environment);
  const fingerprint = [
    config.appId,
    config.redirectUri ?? "",
    config.frontendUrl,
    config.appKey ? "app-key:set" : "app-key:missing",
    config.accessSecret ? "access-secret:set" : "access-secret:missing",
  ].join("|");

  if (!cached || cached.fingerprint !== fingerprint) {
    const sessions = new SessionStore(new KvSessionBackend(env.KV), true);
    const contentCache = new KvContentCache(env.KV);
    cached = {
      fingerprint,
      handle: createHandler({
        config,
        sessions,
        contentCache,
      }),
    };
  }
  return cached.handle;
}

function errorResponse(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ ok: false, error: { code, message } }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function isBackendPath(pathname: string): boolean {
  return pathname.startsWith("/api/") ||
    pathname === "/login" ||
    pathname === "/auth/callback";
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (!isBackendPath(url.pathname)) {
        return env.ASSETS.fetch(request);
      }
      const preflight = corsPreflight(request, env.FRONTEND_ORIGIN);
      if (preflight) return preflight;
      const response = await resolveHandler(env)(request);
      return withCors(request, response, env.FRONTEND_ORIGIN);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Worker 启动失败";
      const code = message.includes("KV") ? "KV_BINDING_MISSING" : "BOOTSTRAP_ERROR";
      return withCors(
        request,
        errorResponse(500, code, message),
        env.FRONTEND_ORIGIN,
      );
    }
  },
};
