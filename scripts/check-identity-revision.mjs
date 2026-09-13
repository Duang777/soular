import assert from "node:assert/strict";
import { resolveIdentityRevision } from "../src/identityRevision.ts";
import {
  countMatchingNebulaLikes,
  selfProfileFromValue,
} from "../src/people.ts";

const STORAGE_KEY = "identity-revisions";

function memoryStorage(initial = "[]", failWrite = false) {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_key, nextValue) => {
      if (failWrite) throw new DOMException("quota exceeded", "QuotaExceededError");
      value = nextValue;
    },
    value: () => value,
  };
}

const storage = memoryStorage();
const memory = new Map();
assert.equal(resolveIdentityRevision("account-a", storage, memory, STORAGE_KEY), 1);
assert.equal(resolveIdentityRevision("account-b", storage, memory, STORAGE_KEY), 2);
assert.equal(resolveIdentityRevision("account-a", storage, memory, STORAGE_KEY), 1);

const writeDenied = memoryStorage('[["account-a",7]]', true);
const fallbackMemory = new Map();
assert.equal(
  resolveIdentityRevision("account-b", writeDenied, fallbackMemory, STORAGE_KEY),
  8,
  "写入失败时必须避开持久化记录中的现有修订号",
);
assert.equal(
  resolveIdentityRevision("account-a", writeDenied, fallbackMemory, STORAGE_KEY),
  7,
  "写入失败后仍须恢复已知账号的原修订号",
);

const unavailableMemory = new Map();
assert.equal(
  resolveIdentityRevision("account-a", null, unavailableMemory, STORAGE_KEY),
  1,
);
assert.equal(
  resolveIdentityRevision("account-b", null, unavailableMemory, STORAGE_KEY),
  2,
);
assert.equal(
  resolveIdentityRevision("account-a", null, unavailableMemory, STORAGE_KEY),
  1,
);

const corruptedStorage = memoryStorage(
  '[["account-a",1],["account-b",1],["poison",9007199254740991]]',
);
const repairedMemory = new Map();
assert.equal(
  resolveIdentityRevision("account-a", corruptedStorage, repairedMemory, STORAGE_KEY),
  1,
);
assert.equal(
  resolveIdentityRevision("account-b", corruptedStorage, repairedMemory, STORAGE_KEY),
  2,
  "重复或极端修订号不得让两个账号共享作用域",
);

const boundedStorage = memoryStorage();
let boundedMemory = new Map();
for (let index = 1; index <= 9; index += 1) {
  assert.equal(
    resolveIdentityRevision(
      `account-${index}`,
      boundedStorage,
      boundedMemory,
      STORAGE_KEY,
      8,
    ),
    index,
  );
}
boundedMemory = new Map();
assert.equal(
  resolveIdentityRevision(
    "account-10",
    boundedStorage,
    boundedMemory,
    STORAGE_KEY,
    8,
  ),
  10,
  "淘汰旧映射后不得重用可能仍绑定同频轮次的修订号",
);
boundedMemory = new Map();
assert.equal(
  resolveIdentityRevision(
    "account-1",
    boundedStorage,
    boundedMemory,
    STORAGE_KEY,
    8,
  ),
  11,
  "重新出现的已淘汰账号必须获得新的唯一修订号",
);

assert.equal(
  countMatchingNebulaLikes([0, 1, 2], [0, 1, 2], "ai-math"),
  3,
);
assert.equal(
  countMatchingNebulaLikes(
    [100, 101, 102],
    [100, 101, 102],
    "ai-math",
  ),
  0,
  "Local Storage 与画像中的同源越界索引不得解锁同频入口",
);
assert.equal(
  selfProfileFromValue(
    {
      preset: "ai-math",
      version: "20260912",
      cast: "fox",
      stance: 0,
      likedCount: 3,
      likedIndexes: [100, 101, 102],
      claim: "invalid indexes",
    },
    "ai-math",
    "20260912",
    "fox",
  ),
  null,
  "自我画像必须拒绝超出当前快照人数的点赞索引",
);

console.log("identity revision checks passed");
