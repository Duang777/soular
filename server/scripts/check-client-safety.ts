import assert from "node:assert/strict";
import { KvContentCache, type KVNamespaceLike } from "../src/adapters/cloudflare-kv.js";
import { ZhihuApiError, ZhihuClient } from "../src/zhihu/client.js";

const originalFetch = globalThis.fetch;

try {
  let requests = 0;
  const hotListResponse = () => new Response(JSON.stringify({
    Code: 0,
    Data: {
      Total: 1000,
      Items: Array.from({ length: 1000 }, (_, index) => ({
        Title: `热榜 ${index}`,
        Url: `https://www.zhihu.com/question/${index + 1}`,
        ThumbnailUrl: "",
        Summary: "",
      })),
    },
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
  globalThis.fetch = async () => {
    requests += 1;
    return hotListResponse();
  };

  const client = new ZhihuClient("test-secret");
  const hotLists = await Promise.all([
    client.hotList(8),
    client.hotList(12),
  ]);
  assert.equal(requests, 1, "不同展示条数必须复用同一份热榜请求");
  assert.deepEqual(hotLists.map((value) => value.Items.length), [8, 12]);

  let cacheReads = 0;
  requests = 0;
  const cachedClient = new ZhihuClient("test-secret", {
    async get() {
      cacheReads += 1;
      await Promise.resolve();
      return null;
    },
    async set() {},
  });
  await Promise.all(Array.from({ length: 1000 }, () => cachedClient.hotList(8)));
  assert.equal(cacheReads, 1, "同键并发请求必须合并缓存读取");
  assert.equal(requests, 1, "同键并发请求必须只访问一次上游");

  requests = 0;
  const cacheReadFailureClient = new ZhihuClient("test-secret", {
    async get() {
      throw new Error("cache read unavailable");
    },
    async set() {},
  });
  const readFailureResult = await cacheReadFailureClient.hotList(8);
  assert.equal(readFailureResult.Items.length, 8);
  assert.equal(requests, 1, "缓存读取失败时必须继续请求上游");

  requests = 0;
  const cacheWriteFailureClient = new ZhihuClient("test-secret", {
    async get() {
      return null;
    },
    async set() {
      throw new Error("cache write unavailable");
    },
  });
  const writeFailureResult = await cacheWriteFailureClient.hotList(8);
  assert.equal(writeFailureResult.Items.length, 8);
  assert.equal(requests, 1, "缓存写入失败不得覆盖成功的上游结果");

  requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    return new Response(JSON.stringify({
      Code: 30002,
      Message: "rate limit exceeded",
    }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  };
  await assert.rejects(
    () => new ZhihuClient("test-secret").hotList(8),
    (error: unknown) => error instanceof ZhihuApiError && error.code === 30002,
  );
  assert.equal(requests, 1, "长窗口或日级限流不得重试");

  requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    return new Response("x".repeat(5 * 1024 * 1024 + 1), { status: 200 });
  };
  await assert.rejects(
    () => new ZhihuClient("test-secret").hotList(8),
    (error: unknown) => error instanceof ZhihuApiError && error.code === 90001,
  );
  assert.equal(requests, 1, "超大响应必须在解析前停止");

  let storedKey = "";
  const kv: KVNamespaceLike = {
    async getWithMetadata() {
      return null;
    },
    async put(key) {
      storedKey = key;
    },
    async delete() {},
  };
  await new KvContentCache(kv).set("问".repeat(200), { ok: true }, 300);
  assert.match(storedKey, /^cache:[0-9a-f]{64}$/);
  assert.ok(new TextEncoder().encode(storedKey).length <= 512);

  const legacyRawKey = "/api/v1/content/hot_list?Limit=30";
  const legacyStoredKey = `cache:${encodeURIComponent(legacyRawKey)}`;
  const reads: string[] = [];
  const migrationKv: KVNamespaceLike = {
    async getWithMetadata(key) {
      reads.push(key);
      return key === legacyStoredKey
        ? { value: { Items: [] }, metadata: { cachedAt: Math.floor(Date.now() / 1000) } }
        : { value: null, metadata: null };
    },
    async put() {
      throw new Error("旧缓存回读不得续期");
    },
    async delete() {},
  };
  const migrated = await new KvContentCache(migrationKv).get(legacyRawKey);
  assert.deepEqual(migrated?.value, { Items: [] });
  assert.equal(reads[1], legacyStoredKey);
} finally {
  globalThis.fetch = originalFetch;
}

console.log("client safety checks passed");
