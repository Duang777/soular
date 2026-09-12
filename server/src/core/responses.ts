const BASE_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

export function jsonResponse(
  status: number,
  payload: unknown,
  setCookie?: string | null,
): Response {
  const headers = new Headers(BASE_HEADERS);
  headers.set("Content-Type", "application/json; charset=utf-8");
  if (setCookie) headers.append("Set-Cookie", setCookie);
  return new Response(JSON.stringify(payload), { status, headers });
}

export function redirectResponse(location: string, setCookie?: string | null): Response {
  const headers = new Headers(BASE_HEADERS);
  headers.set("Location", location);
  if (setCookie) headers.append("Set-Cookie", setCookie);
  return new Response(null, { status: 302, headers });
}

export function withCookie(response: Response, setCookie: string | null): Response {
  if (!setCookie) return response;
  const headers = new Headers(response.headers);
  headers.append("Set-Cookie", setCookie);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
