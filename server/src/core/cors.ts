const ALLOWED_METHODS = "GET, POST, OPTIONS";
const ALLOWED_HEADERS = "Content-Type, Authorization";

function corsHeaders(origin: string): Headers {
  const headers = new Headers({
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": ALLOWED_METHODS,
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Max-Age": "86400",
  });
  headers.append("Vary", "Origin");
  return headers;
}

export function corsPreflight(
  request: Request,
  allowedOrigin: string | undefined,
): Response | null {
  if (request.method !== "OPTIONS" || !new URL(request.url).pathname.startsWith("/api/")) {
    return null;
  }

  const origin = request.headers.get("Origin");
  if (!origin || origin !== allowedOrigin) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export function withCors(
  request: Request,
  response: Response,
  allowedOrigin: string | undefined,
): Response {
  const origin = request.headers.get("Origin");
  if (!origin || origin !== allowedOrigin || !new URL(request.url).pathname.startsWith("/api/")) {
    return response;
  }

  const headers = new Headers(response.headers);
  corsHeaders(origin).forEach((value, key) => headers.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
