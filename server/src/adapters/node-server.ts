import http from "node:http";
import { existsSync, readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { RuntimeConfig } from "../core/config.js";
import { createHandler } from "../core/app.js";
import { corsPreflight, withCors } from "../core/cors.js";
import { SessionStore } from "../core/session.js";
import { InMemoryCache, InMemorySessionBackend } from "../core/storage.js";

export function loadDotEnv(): void {
  const file = `${process.cwd()}/.env`;
  if (!existsSync(file)) return;
  const text = readFileSync(file, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const equals = line.indexOf("=");
    if (equals === -1) continue;
    const key = line.slice(0, equals).trim();
    let value = line.slice(equals + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function toWebRequest(request: IncomingMessage): Request {
  const host = request.headers.host ?? "localhost";
  const target = `http://${host}${request.url ?? "/"}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else if (value !== undefined) {
      headers.set(key, value);
    }
  }

  const init: RequestInit & { duplex?: string } = {
    method: request.method,
    headers,
  };
  const hasBody =
    request.headers["content-length"] !== undefined ||
    request.headers["transfer-encoding"] !== undefined;
  if (request.method && !["GET", "HEAD"].includes(request.method) && hasBody) {
    init.body = request as unknown as BodyInit;
    init.duplex = "half";
  }
  return new Request(target, init);
}

async function writeWebResponse(
  response: ServerResponse,
  webResponse: Response,
): Promise<void> {
  response.statusCode = webResponse.status;
  const setCookies = webResponse.headers.getSetCookie?.() ?? [];
  webResponse.headers.forEach((value, key) => {
    if (key !== "set-cookie") response.setHeader(key, value);
  });
  if (setCookies.length > 0) response.setHeader("Set-Cookie", setCookies);
  const buffer = Buffer.from(await webResponse.arrayBuffer());
  response.end(buffer);
}

export function startNodeServer(
  config: RuntimeConfig,
  listen: { host: string; port: number },
): http.Server {
  const sessionBackend = new InMemorySessionBackend();
  const contentCache = new InMemoryCache();
  const sessions = new SessionStore(sessionBackend, config.cookieSecure);
  const handler = createHandler({
    config,
    sessions,
    contentCache,
  });

  const server = http.createServer((request, response) => {
    void (async () => {
      try {
        const webRequest = toWebRequest(request);
        const preflight = corsPreflight(webRequest, process.env.FRONTEND_ORIGIN);
        const webResponse =
          preflight ??
          withCors(webRequest, await handler(webRequest), process.env.FRONTEND_ORIGIN);
        await writeWebResponse(response, webResponse);
      } catch {
        if (!response.headersSent) {
          response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        }
        response.end(
          JSON.stringify({
            ok: false,
            error: {
              code: "FATAL",
              message: "服务器内部错误",
            },
          }),
        );
      }
    })();
  });

  server.listen(listen.port, listen.host, () => {
    const displayHost = listen.host === "0.0.0.0" ? "127.0.0.1" : listen.host;
    process.stdout.write(`soul-match-server: http://${displayHost}:${listen.port}/\n`);
    if (!config.oauthConfigured) {
      process.stdout.write(
        "[提示] OAuth 尚未配置：本地可预览页面，真实知乎登录需配置公网 HTTPS 回调与凭证后再进行。\n",
      );
    }
  });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => server.close(() => process.exit(0)));
  }

  return server;
}
