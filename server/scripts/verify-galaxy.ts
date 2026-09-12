import { readFileSync } from "node:fs";
import { ZhihuClient } from "../src/zhihu/client.js";
import { buildGalaxy, buildGalaxyFromItems } from "../src/core/galaxy.js";
import type { HotListItem } from "../src/types.js";

const secret = process.env.ZHIHU_ACCESS_SECRET?.trim();
if (!secret) {
  console.error("missing ZHIHU_ACCESS_SECRET");
  process.exit(1);
}

const client = new ZhihuClient(secret, null);

const fixturePath = process.env.HOT_FIXTURE?.trim();
const galaxy = fixturePath
  ? await buildGalaxyFromItems(client, readFixture(fixturePath))
  : await buildGalaxy(client);

function readFixture(path: string): HotListItem[] {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const items = raw?.data?.Items ?? raw?.Items ?? [];
  if (!Array.isArray(items) || !items.length) throw new Error("fixture 中没有热榜条目");
  return items as HotListItem[];
}

console.log(`== meta == source=${galaxy.source} clusters=${galaxy.clusters.length} posts=${galaxy.posts.length}`);
console.log("== clusters ==");
console.log(galaxy.clusters.map((c) => c.name).join(" / "));
console.log("== posts ==");
for (const post of galaxy.posts) {
  const clusterName = galaxy.clusters[post.cluster]?.name ?? "?";
  console.log(
    `#${String(post.id).padStart(2, " ")} [${clusterName}] d=${post.debate.toFixed(2)} ${post.title}`,
  );
  console.log(`     take: ${post.take}`);
  if (post.campA || post.campB) console.log(`     A: ${post.campA} ｜ B: ${post.campB}`);
}
console.log("== warnings ==");
console.log(galaxy.warnings.length ? galaxy.warnings.join("\n") : "(none)");
