import assert from "node:assert/strict";
import {
  DurableSessionBackend,
  SessionDurableObject,
  type DurableObjectStateLike,
} from "../src/adapters/durable-session.js";
import { createHandler } from "../src/core/app.js";
import { buildRuntimeConfig } from "../src/core/config.js";
import type { SessionState } from "../src/core/session-state.js";
import { SessionStore } from "../src/core/session.js";
import {
  InMemoryCache,
  InMemorySessionBackend,
} from "../src/core/storage.js";
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  fetchProfile,
} from "../src/zhihu/oauth.js";

const config = buildRuntimeConfig({
  ZHIHU_APP_ID: "422",
  ZHIHU_OAUTH_APP_KEY: "test-app-key",
  ZHIHU_ACCESS_SECRET: "test-access-secret",
  ZHIHU_REDIRECT_URI: "https://soular.top/auth/callback",
  FRONTEND_URL: "https://soular.top/",
});

assert.equal(config.oauthConfigured, true);
assert.equal(config.dataApiConfigured, true);

const authorizeUrl = new URL(
  buildAuthorizeUrl(config.appId, config.redirectUri!, "test-state"),
);
assert.equal(authorizeUrl.origin, "https://openapi.zhihu.com");
assert.equal(authorizeUrl.pathname, "/authorize");
assert.equal(authorizeUrl.searchParams.get("app_id"), "422");
assert.equal(authorizeUrl.searchParams.get("redirect_uri"), config.redirectUri);
assert.equal(authorizeUrl.searchParams.get("response_type"), "code");
assert.equal(authorizeUrl.searchParams.get("state"), "test-state");

const originalFetch = globalThis.fetch;
const requests: Array<{
  url: string;
  headers: Headers;
  body: string;
  signal: AbortSignal | null;
}> = [];
let profileResponseMode: "full" | "avatar-only" | "empty" | "server-error" = "full";

async function expectedAccountVersion(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("").slice(0, 16);
}

try {
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    const body = String(init?.body ?? "");
    requests.push({
      url,
      headers,
      body,
      signal: init?.signal instanceof AbortSignal ? init.signal : null,
    });

    if (url.endsWith("/access_token")) {
      return Response.json({
        code: 20000,
        access_token: "test-oauth-token",
        token_type: "Bearer",
        expires_in: "3600",
      });
    }

    if (url.endsWith("/user")) {
      const oauthToken = headers.get("X-OAuth-Token");
      if (profileResponseMode === "server-error" && oauthToken) {
        return Response.json(
          { code: 50001, message: "upstream unavailable" },
          { status: 503 },
        );
      }
      if (
        headers.get("Authorization") === "Bearer test-access-secret" &&
        oauthToken
      ) {
        return Response.json(
          { code: 40100, message: "OAuth bearer required" },
          { status: 401 },
        );
      }
      assert.match(
        headers.get("Authorization") ?? "",
        /^Bearer test-oauth-token/,
      );
      assert.equal(headers.get("X-OAuth-Token"), null);
      if (profileResponseMode === "empty") {
        return Response.json({ code: 20000, data: {} });
      }
      if (profileResponseMode === "avatar-only") {
        return Response.json({
          code: 20000,
          avatar_path: "https://picx.zhimg.com/test-avatar.png",
        });
      }
      return Response.json({
        code: 20000,
        fullname: "测试用户",
        avatar_path: "https://picx.zhimg.com/test-avatar.png",
        headline: "测试简介",
        url: "https://www.zhihu.com/people/test-user",
      });
    }

    throw new Error(`Unexpected request: ${url}`);
  };

  const token = await exchangeCodeForToken({
    appId: config.appId,
    appKey: config.appKey,
    redirectUri: config.redirectUri!,
    code: "test-authorization-code",
  });
  assert.equal(token.accessToken, "test-oauth-token");
  assert.match(requests[0]?.body ?? "", /app_id=422/);
  assert.match(requests[0]?.body ?? "", /code=test-authorization-code/);

  const profile = await fetchProfile(config.accessSecret, token.accessToken);
  assert.equal(profile?.name, "测试用户");
  assert.equal(
    profile?.avatarUrl,
    "https://picx.zhimg.com/test-avatar.png",
  );
  assert.equal(
    requests[1]?.headers.get("Authorization"),
    "Bearer test-access-secret",
  );
  assert.equal(requests[1]?.headers.get("X-OAuth-Token"), "test-oauth-token");
  assert.equal(
    requests[2]?.headers.get("Authorization"),
    "Bearer test-oauth-token",
  );
  assert.equal(requests[2]?.headers.get("X-OAuth-Token"), null);
  assert.equal(
    requests[1]?.signal,
    requests[2]?.signal,
    "profile fallback must share one total timeout budget",
  );
  profileResponseMode = "server-error";
  requests.length = 0;
  await assert.rejects(
    fetchProfile(config.accessSecret, token.accessToken),
  );
  assert.equal(
    requests.filter(({ url }) => url.endsWith("/user")).length,
    1,
    "profile server errors must not trigger an OAuth bearer retry",
  );
  profileResponseMode = "full";

  requests.length = 0;
  const sessions = new SessionStore(new InMemorySessionBackend(), true);
  const contentCache = new InMemoryCache();
  const handler = createHandler({
    config,
    sessions,
    contentCache,
  });

  const anonymousStatusResponse = await handler(
    new Request("https://soular.top/api/oauth/status"),
  );
  assert.equal(anonymousStatusResponse.status, 200);
  assert.equal(anonymousStatusResponse.headers.get("set-cookie"), null);
  assert.equal(
    ((await anonymousStatusResponse.json()) as { authorized: boolean }).authorized,
    false,
  );

  const failingSessions = new SessionStore(new InMemorySessionBackend(), true);
  failingSessions.load = async () => {
    throw new Error("sensitive storage detail");
  };
  const internalErrorResponse = await createHandler({
    config,
    sessions: failingSessions,
  })(new Request("https://soular.top/api/oauth/status"));
  assert.deepEqual(await internalErrorResponse.json(), {
    ok: false,
    error: { code: "INTERNAL", message: "服务器内部错误" },
  });

  const unsolicitedCallback = await handler(
    new Request(
      "https://soular.top/auth/callback?authorization_code=unsolicited-code",
    ),
  );
  assert.equal(unsolicitedCallback.status, 302);
  assert.equal(
    new URL(unsolicitedCallback.headers.get("location")!).searchParams.get("oauth"),
    "error",
  );

  const startResponse = await handler(
    new Request("https://soular.top/api/oauth/start"),
  );
  assert.equal(startResponse.status, 302);

  const callbackCookie = startResponse.headers.get("set-cookie");
  const redirectLocation = startResponse.headers.get("location");
  if (!callbackCookie || !redirectLocation) {
    throw new Error("OAuth start response is missing redirect headers");
  }

  const state = new URL(redirectLocation).searchParams.get("state");
  if (!state) throw new Error("OAuth authorize URL is missing state");

  const repeatedStartResponse = await handler(
    new Request("https://soular.top/api/oauth/start", {
      headers: { Cookie: callbackCookie },
    }),
  );
  assert.equal(repeatedStartResponse.headers.get("set-cookie"), null);
  assert.equal(
    new URL(repeatedStartResponse.headers.get("location")!)
      .searchParams.get("state"),
    state,
  );

  const callbackResponses = await Promise.all([
    handler(
      new Request(
        `https://soular.top/auth/callback?authorization_code=test-authorization-code&state=${encodeURIComponent(state)}`,
        { headers: { Cookie: callbackCookie } },
      ),
    ),
    handler(
      new Request(
        `https://soular.top/auth/callback?authorization_code=test-authorization-code&state=${encodeURIComponent(state)}`,
        { headers: { Cookie: callbackCookie } },
      ),
    ),
  ]);
  assert.deepEqual(
    callbackResponses
      .map((response) =>
        new URL(response.headers.get("location")!).searchParams.get("oauth")
      )
      .sort(),
    ["error", "success"],
  );

  const statusResponse = await handler(
    new Request("https://soular.top/api/oauth/status", {
      headers: { Cookie: callbackCookie },
    }),
  );
  const status = await statusResponse.json() as {
    authorized: boolean;
    accountVersion: string | null;
    stateVerified: boolean;
    profile: { name: string } | null;
  };
  assert.equal(status.authorized, true);
  assert.equal(
    status.accountVersion,
    await expectedAccountVersion("test-oauth-token"),
  );
  assert.equal(status.stateVerified, true);
  assert.equal(status.profile?.name, "测试用户");

  const sessionWithoutProfile = await sessions.load(
    new Request("https://soular.top/", {
      headers: { Cookie: callbackCookie },
    }),
  );
  if (!sessionWithoutProfile) {
    throw new Error("Expected an OAuth session for profile recovery");
  }
  sessionWithoutProfile.profile = {
    name: "测试用户",
    avatarUrl: null,
    headline: "保留的简介",
    url: "https://www.zhihu.com/people/stored-user",
  };
  await sessions.save(sessionWithoutProfile);
  profileResponseMode = "avatar-only";
  requests.length = 0;

  const recoveredStatusResponse = await handler(
    new Request("https://soular.top/api/oauth/status", {
      headers: { Cookie: callbackCookie },
    }),
  );
  const recoveredStatus = await recoveredStatusResponse.json() as {
    profile: { name: string; avatarUrl: string | null } | null;
  };
  assert.equal(recoveredStatus.profile?.name, "测试用户");
  assert.equal(recoveredStatus.profile?.avatarUrl, null);
  assert.equal(
    requests.filter(({ url }) => url.endsWith("/user")).length,
    0,
    "status must not block on profile recovery",
  );

  const recoveredProfileResponse = await handler(
    new Request("https://soular.top/api/oauth/profile", {
      headers: { Cookie: callbackCookie },
    }),
  );
  const recoveredProfile = await recoveredProfileResponse.json() as {
    accountVersion: string;
    profile: {
      name: string;
      avatarUrl: string;
      headline: string;
      url: string;
    } | null;
  };
  assert.equal(
    recoveredProfile.accountVersion,
    await expectedAccountVersion("test-oauth-token"),
  );
  assert.equal(recoveredProfile.profile?.name, "测试用户");
  assert.equal(
    recoveredProfile.profile?.avatarUrl,
    "https://picx.zhimg.com/test-avatar.png",
  );
  assert.equal(recoveredProfile.profile?.headline, "保留的简介");
  assert.equal(
    recoveredProfile.profile?.url,
    "https://www.zhihu.com/people/stored-user",
  );
  assert.equal(
    requests.filter(({ url }) => url.endsWith("/user")).length,
    2,
  );
  requests.length = 0;

  const cachedRecoveredProfileResponse = await handler(
    new Request("https://soular.top/api/oauth/profile", {
      headers: { Cookie: callbackCookie },
    }),
  );
  assert.equal(
    (
      (await cachedRecoveredProfileResponse.json()) as {
        profile: { avatarUrl: string } | null;
      }
    ).profile?.avatarUrl,
    "https://picx.zhimg.com/test-avatar.png",
  );
  assert.equal(
    requests.filter(({ url }) => url.endsWith("/user")).length,
    0,
  );

  sessionWithoutProfile.token = "test-oauth-token-empty";
  sessionWithoutProfile.profile = {
    name: "保留用户",
    avatarUrl: null,
    headline: "保留简介",
    url: null,
  };
  await sessions.save(sessionWithoutProfile);
  profileResponseMode = "empty";
  requests.length = 0;
  const emptyProfileResponse = await handler(
    new Request("https://soular.top/api/oauth/profile", {
      headers: { Cookie: callbackCookie },
    }),
  );
  assert.equal(
    (
      (await emptyProfileResponse.json()) as {
        profile: { name: string } | null;
      }
    ).profile?.name,
    "保留用户",
  );
  assert.equal(
    requests.filter(({ url }) => url.endsWith("/user")).length,
    2,
  );
  requests.length = 0;
  await handler(
    new Request("https://soular.top/api/oauth/profile", {
      headers: { Cookie: callbackCookie },
    }),
  );
  assert.equal(
    requests.filter(({ url }) => url.endsWith("/user")).length,
    0,
    "empty profile recovery must use the failure cooldown",
  );

  profileResponseMode = "full";
  sessionWithoutProfile.token = "test-oauth-token";
  sessionWithoutProfile.profile = {
    name: "测试用户",
    avatarUrl: "https://picx.zhimg.com/test-avatar.png",
    headline: "测试简介",
    url: "https://www.zhihu.com/people/test-user",
  };
  await sessions.save(sessionWithoutProfile);

  const failedReloginStart = await handler(
    new Request("https://soular.top/api/oauth/start", {
      headers: { Cookie: callbackCookie },
    }),
  );
  const failedReloginState = new URL(
    failedReloginStart.headers.get("location")!,
  ).searchParams.get("state");
  const failedReloginCallback = await handler(
    new Request(
      `https://soular.top/auth/callback?state=${encodeURIComponent(failedReloginState!)}`,
      { headers: { Cookie: callbackCookie } },
    ),
  );
  assert.equal(
    new URL(failedReloginCallback.headers.get("location")!)
      .searchParams.get("oauth"),
    "error",
  );
  const preservedStatusResponse = await handler(
    new Request("https://soular.top/api/oauth/status", {
      headers: { Cookie: callbackCookie },
    }),
  );
  const preservedStatus = await preservedStatusResponse.json() as {
    authorized: boolean;
    stateVerified: boolean;
    error: { code: string } | null;
  };
  assert.equal(preservedStatus.authorized, true);
  assert.equal(preservedStatus.stateVerified, true);
  assert.equal(preservedStatus.error?.code, "CODE_MISSING");

  const fallbackStartResponses = await Promise.all([
    handler(
      new Request("https://soular.top/api/oauth/start", {
        headers: { Cookie: callbackCookie },
      }),
    ),
    handler(
      new Request("https://soular.top/api/oauth/start", {
        headers: { Cookie: callbackCookie },
      }),
    ),
  ]);
  assert.ok(fallbackStartResponses.every((response) => response.status === 302));
  assert.ok(
    fallbackStartResponses.every(
      (response) => response.headers.get("set-cookie") === null,
    ),
  );
  assert.equal(
    new URL(fallbackStartResponses[0]!.headers.get("location")!)
      .searchParams.get("state"),
    new URL(fallbackStartResponses[1]!.headers.get("location")!)
      .searchParams.get("state"),
  );
  const fallbackCookie = callbackCookie;
  assert.notEqual(
    await sessions.load(
      new Request("https://soular.top/", {
        headers: { Cookie: callbackCookie },
      }),
    ),
    null,
  );
  const pendingSwitchStatusResponse = await handler(
    new Request("https://soular.top/api/oauth/status", {
      headers: { Cookie: fallbackCookie },
    }),
  );
  const pendingSwitchStatus = await pendingSwitchStatusResponse.json() as {
    authorized: boolean;
    profile: { name: string } | null;
  };
  assert.equal(pendingSwitchStatus.authorized, true);
  assert.equal(pendingSwitchStatus.profile?.name, "测试用户");
  const fallbackCallbackResponse = await handler(
    new Request(
      "https://soular.top/auth/callback?authorization_code=test-authorization-code",
      { headers: { Cookie: fallbackCookie } },
    ),
  );
  assert.equal(fallbackCallbackResponse.status, 302);
  assert.equal(
    new URL(fallbackCallbackResponse.headers.get("location")!).searchParams.get("oauth"),
    "success",
  );
  const fallbackStatusResponse = await handler(
    new Request("https://soular.top/api/oauth/status", {
      headers: { Cookie: fallbackCookie },
    }),
  );
  assert.equal(
    ((await fallbackStatusResponse.json()) as { stateVerified: boolean }).stateVerified,
    false,
  );

  const userApiPaths = new Set<string>();
  let userApiRequestCount = 0;
  let invalidFavlistContent = false;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    userApiPaths.add(url.pathname);
    userApiRequestCount += 1;
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("Authorization"), "Bearer test-access-secret");
    assert.match(
      headers.get("X-OAuth-Token") ?? "",
      /^test-oauth-token(?:-[bcd])?$/,
    );

    const content = {
      ContentType: "article",
      Url: "https://zhuanlan.zhihu.com/p/1",
      CreatedAt: 1,
      LikeCount: 2,
      CommentCount: 3,
      FavoriteCount: 4,
      Title: "收藏夹中的模型文章",
      Summary: "用于验证收藏夹内容采样",
    };
    const paging = { IsEnd: true, Totals: 1 };
    const dataByPath: Record<string, unknown> = {
      "/api/v1/user/contents": { Items: [content], Paging: paging },
      "/api/v1/user/followees": {
        Items: [{
          Fullname: "测试关注",
          UrlToken: "test-followee",
          Url: "https://www.zhihu.com/people/test-followee",
          AvatarUrl: "https://picx.zhimg.com/test.png",
          Headline: "模型研究",
          Gender: 0,
          FollowerCount: 1,
        }],
        Paging: paging,
      },
      "/api/v1/user/favlists": {
        Items: [{
          UrlToken: 7,
          Url: "https://www.zhihu.com/collection/7",
          Title: "模型资料",
          Description: "收藏夹描述",
          IsPublic: true,
        }],
      },
      "/api/v1/user/favlist_contents": {
        Items: invalidFavlistContent ? [null] : [content],
        Paging: paging,
      },
      "/api/v1/user/collections": { Items: [content] },
    };
    const data = dataByPath[url.pathname];
    if (!data) throw new Error(`Unexpected user API request: ${url.pathname}`);
    return Response.json({ Code: 0, Message: "success", Data: data });
  };

  const portraitResponse = await handler(
    new Request("https://soular.top/api/me/portrait", {
      headers: { Cookie: fallbackCookie },
    }),
  );
  assert.equal(portraitResponse.status, 200);
  const portraitPayload = await portraitResponse.json() as {
    accountVersion: string;
    data: { warnings: string[] };
  };
  assert.equal(
    portraitPayload.accountVersion,
    await expectedAccountVersion("test-oauth-token"),
  );
  assert.equal(portraitPayload.data.warnings.length, 0);
  assert.deepEqual(
    [...userApiPaths].sort(),
    [
      "/api/v1/user/collections",
      "/api/v1/user/contents",
      "/api/v1/user/favlist_contents",
      "/api/v1/user/favlists",
      "/api/v1/user/followees",
    ],
  );
  userApiRequestCount = 0;
  const cachedPortraitResponse = await handler(
    new Request("https://soular.top/api/me/portrait", {
      headers: { Cookie: fallbackCookie },
    }),
  );
  assert.equal(cachedPortraitResponse.status, 200);
  assert.equal(
    ((await cachedPortraitResponse.json()) as { cached: boolean }).cached,
    true,
  );
  assert.equal(userApiRequestCount, 0);

  const stableCacheStart = await sessions.begin(
    new Request("https://soular.top/", {
      headers: { Cookie: fallbackCookie },
    }),
    "next-state",
    Date.now() + 10 * 60 * 1000,
  );
  assert.equal(stableCacheStart.setCookie, null);
  const activeCookie = fallbackCookie;
  const rotatedPortraitResponse = await handler(
    new Request("https://soular.top/api/me/portrait", {
      headers: { Cookie: activeCookie },
    }),
  );
  assert.equal(rotatedPortraitResponse.status, 200);
  assert.equal(
    ((await rotatedPortraitResponse.json()) as { cached: boolean }).cached,
    true,
  );
  assert.equal(userApiRequestCount, 0);

  const accountBSession = await sessions.load(
    new Request("https://soular.top/", {
      headers: { Cookie: activeCookie },
    }),
  );
  if (!accountBSession) throw new Error("Expected an OAuth session for account B");
  accountBSession.token = "test-oauth-token-b";
  await sessions.save(accountBSession);
  userApiPaths.clear();
  userApiRequestCount = 0;

  const accountBPortraitResponse = await handler(
    new Request("https://soular.top/api/me/portrait", {
      headers: { Cookie: activeCookie },
    }),
  );
  assert.equal(accountBPortraitResponse.status, 200);
  assert.equal(
    ((await accountBPortraitResponse.json()) as { cached: boolean }).cached,
    false,
  );
  assert.equal(userApiPaths.size, 5);
  assert.equal(userApiRequestCount, 5);

  accountBSession.token = "test-oauth-token-c";
  await sessions.save(accountBSession);
  userApiPaths.clear();
  userApiRequestCount = 0;
  const concurrentPortraitResponses = await Promise.all([
    handler(
      new Request("https://soular.top/api/me/portrait", {
        headers: { Cookie: activeCookie },
      }),
    ),
    handler(
      new Request("https://soular.top/api/me/portrait", {
        headers: { Cookie: activeCookie },
      }),
    ),
  ]);
  assert.ok(concurrentPortraitResponses.every((response) => response.status === 200));
  assert.equal(userApiPaths.size, 5);
  assert.equal(userApiRequestCount, 5);

  accountBSession.token = "test-oauth-token-d";
  await sessions.save(accountBSession);
  invalidFavlistContent = true;
  const degradedPortraitResponse = await handler(
    new Request("https://soular.top/api/me/portrait", {
      headers: { Cookie: activeCookie },
    }),
  );
  assert.equal(degradedPortraitResponse.status, 200);
  assert.match(
    (
      (await degradedPortraitResponse.json()) as {
        data: { warnings: string[] };
      }
    ).data.warnings.join("\n"),
    /收藏夹内容获取失败/,
  );
  const originalDateNow = Date.now;
  try {
    const afterPartialTtl = originalDateNow() + 61_000;
    Date.now = () => afterPartialTtl;
    invalidFavlistContent = false;
    userApiPaths.clear();
    userApiRequestCount = 0;
    const refreshedPartialResponse = await handler(
      new Request("https://soular.top/api/me/portrait", {
        headers: { Cookie: activeCookie },
      }),
    );
    assert.equal(refreshedPartialResponse.status, 200);
    assert.equal(
      ((await refreshedPartialResponse.json()) as { cached: boolean }).cached,
      false,
    );
    assert.equal(userApiPaths.size, 5);
    assert.equal(userApiRequestCount, 5);
  } finally {
    Date.now = originalDateNow;
  }

  accountBSession.token = "test-oauth-token-e";
  await sessions.save(accountBSession);
  let failedUserApiRequests = 0;
  globalThis.fetch = async () => {
    failedUserApiRequests += 1;
    return Response.json({ Code: 0, Message: "success", Data: null });
  };
  const unavailablePortraitResponse = await handler(
    new Request("https://soular.top/api/me/portrait", {
      headers: { Cookie: activeCookie },
    }),
  );
  assert.equal(unavailablePortraitResponse.status, 503);
  assert.equal(
    (
      (await unavailablePortraitResponse.json()) as {
        error: { code: string };
      }
    ).error.code,
    "PORTRAIT_UNAVAILABLE",
  );
  assert.equal(failedUserApiRequests, 4);
  const negativeCachedResponse = await handler(
    new Request("https://soular.top/api/me/portrait", {
      headers: { Cookie: activeCookie },
    }),
  );
  assert.equal(negativeCachedResponse.status, 503);
  assert.equal(failedUserApiRequests, 4);
  const tokenEDigest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode("test-oauth-token-e"),
  );
  const tokenEFingerprint = Array.from(
    new Uint8Array(tokenEDigest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  await contentCache.set(
    `portrait:${tokenEFingerprint}`,
    portraitPayload.data,
    600,
  );
  const preferredPositiveResponse = await handler(
    new Request("https://soular.top/api/me/portrait", {
      headers: { Cookie: activeCookie },
    }),
  );
  assert.equal(preferredPositiveResponse.status, 200);
  assert.equal(
    ((await preferredPositiveResponse.json()) as { cached: boolean }).cached,
    true,
  );

  const logoutResponse = await handler(
    new Request("https://soular.top/api/oauth/logout", {
      method: "POST",
      headers: { Cookie: activeCookie },
    }),
  );
  assert.equal(logoutResponse.status, 200);
  assert.match(logoutResponse.headers.get("set-cookie") ?? "", /Max-Age=0/);
  assert.equal(
    await sessions.load(
      new Request("https://soular.top/", {
        headers: { Cookie: activeCookie },
      }),
    ),
    null,
  );

  const failingClear = await new SessionStore({
    async load() {
      return null;
    },
    async save() {},
    async saveIfPresent() {
      return false;
    },
    async delete() {
      throw new Error("storage unavailable");
    },
    async startOAuthState() {
      return null;
    },
    async claimOAuthState() {
      return null;
    },
  }, true).clear(
    new Request("https://soular.top/", {
      headers: { Cookie: `zhihu_oauth_session=${"s".repeat(32)}` },
    }),
  );
  assert.equal(failingClear.storageCleared, false);
  assert.equal(failingClear.setCookie, null);

  const existingSession: SessionState = {
    id: "e".repeat(32),
    state: null,
    stateExpiresAt: null,
    oauthFlowId: null,
    claimedOAuthFlowId: null,
    token: "existing-token",
    expiresAt: Date.now() + 60_000,
    profile: null,
    stateVerified: true,
    error: null,
  };

  const durableRecords = new Map<string, unknown>();
  let durableAlarm: number | null = null;
  let failDurableAlarm = false;
  let durableQueue: Promise<void> = Promise.resolve();
  const durableObject = new SessionDurableObject({
    blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T> {
      const result = durableQueue.then(callback);
      durableQueue = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
    storage: {
      async get<T>(key: string) {
        return durableRecords.get(key) as T | undefined;
      },
      async put<T>(key: string, value: T) {
        durableRecords.set(key, value);
      },
      async delete(key: string) {
        return durableRecords.delete(key);
      },
      async setAlarm(scheduledTime: number) {
        if (failDurableAlarm) throw new Error("alarm unavailable");
        durableAlarm = scheduledTime;
      },
      async deleteAlarm() {
        durableAlarm = null;
      },
    },
  } satisfies DurableObjectStateLike);
  const durableBackend = new DurableSessionBackend({
    idFromName(name: string) {
      return name;
    },
    get() {
      return {
        async fetch(input, init) {
          return durableObject.fetch(
            input instanceof Request ? input : new Request(input, init),
          );
        },
      };
    },
  });
  await durableBackend.save(existingSession, 60);
  assert.ok(durableAlarm && durableAlarm > Date.now());
  assert.deepEqual(await durableBackend.load(existingSession.id), existingSession);
  const durableStarts = await Promise.all([
    durableBackend.startOAuthState(
      existingSession.id,
      "durable-state-a",
      Date.now() + 60_000,
      Date.now(),
    ),
    durableBackend.startOAuthState(
      existingSession.id,
      "durable-state-b",
      Date.now() + 60_000,
      Date.now(),
    ),
  ]);
  assert.ok(durableStarts[0]?.state);
  assert.equal(durableStarts[0]?.state, durableStarts[1]?.state);
  const durableClaims = await Promise.all([
    durableBackend.claimOAuthState(
      existingSession.id,
      durableStarts[0]!.state,
      Date.now(),
    ),
    durableBackend.claimOAuthState(
      existingSession.id,
      durableStarts[0]!.state,
      Date.now(),
    ),
  ]);
  assert.equal(durableClaims.filter(Boolean).length, 1);
  const claimedDurableSession = durableClaims.find(
    (session): session is SessionState => Boolean(session),
  );
  if (!claimedDurableSession?.claimedOAuthFlowId) {
    throw new Error("Expected a claimed Durable Object OAuth flow");
  }
  const completedDurableSession = {
    ...claimedDurableSession,
    oauthFlowId: null,
    claimedOAuthFlowId: null,
    token: "completed-token",
  };
  assert.equal(
    await durableBackend.saveIfPresent(
      completedDurableSession,
      60,
      claimedDurableSession.claimedOAuthFlowId,
    ),
    true,
  );
  assert.equal(
    (await durableBackend.load(existingSession.id))?.token,
    "completed-token",
  );

  const staleFlow = await durableBackend.startOAuthState(
    existingSession.id,
    "stale-flow",
    Date.now() + 60_000,
    Date.now(),
  );
  const claimedStaleFlow = await durableBackend.claimOAuthState(
    existingSession.id,
    staleFlow?.state ?? null,
    Date.now(),
  );
  if (!claimedStaleFlow?.claimedOAuthFlowId) {
    throw new Error("Expected the stale flow to be claimed");
  }
  const replacementFlow = await durableBackend.startOAuthState(
    existingSession.id,
    "replacement-flow",
    Date.now() + 60_000,
    Date.now(),
  );
  assert.equal(replacementFlow?.state, "replacement-flow");
  assert.equal(
    await durableBackend.saveIfPresent(
      {
        ...claimedStaleFlow,
        oauthFlowId: null,
        claimedOAuthFlowId: null,
        token: "stale-token",
      },
      60,
      claimedStaleFlow.claimedOAuthFlowId,
    ),
    false,
  );
  const preservedReplacement = await durableBackend.load(existingSession.id);
  assert.equal(preservedReplacement?.state, "replacement-flow");
  assert.equal(preservedReplacement?.token, "completed-token");

  await durableBackend.delete(existingSession.id);
  assert.equal(durableAlarm, null);
  assert.equal(await durableBackend.load(existingSession.id), null);
  assert.equal(
    await durableBackend.saveIfPresent(existingSession, 60, "missing-flow"),
    false,
  );

  const realDateNow = Date.now;
  try {
    let now = realDateNow();
    Date.now = () => now;
    const alarmSession = {
      ...existingSession,
      expiresAt: now + 10 * 60_000,
    };
    await durableBackend.save(alarmSession, 60);
    const firstAlarm = durableAlarm;
    if (firstAlarm === null) {
      throw new Error("Expected the first Durable Object alarm");
    }

    now += 30_000;
    await durableBackend.save(alarmSession, 120);
    const renewedAlarm = durableAlarm;
    if (renewedAlarm === null || renewedAlarm <= firstAlarm) {
      throw new Error("Expected the Durable Object alarm to be renewed");
    }

    now = firstAlarm + 1;
    await durableObject.alarm();
    assert.equal(durableAlarm, renewedAlarm);
    assert.deepEqual(
      await durableBackend.load(existingSession.id),
      alarmSession,
    );

    now = renewedAlarm + 1;
    await durableObject.alarm();
    assert.equal(durableAlarm, null);
    assert.equal(await durableBackend.load(existingSession.id), null);
  } finally {
    Date.now = realDateNow;
  }

  failDurableAlarm = true;
  await assert.rejects(
    durableBackend.save(existingSession, 60),
    /alarm unavailable/,
  );
  assert.equal(durableRecords.size, 0);
} finally {
  globalThis.fetch = originalFetch;
}

console.log("oauth checks passed");
