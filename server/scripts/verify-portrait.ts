import { ZhihuClient } from "../src/zhihu/client.js";
import { buildPortrait } from "../src/core/portrait.js";

const secret = process.env.ZHIHU_ACCESS_SECRET?.trim();
if (!secret) {
  console.error("missing ZHIHU_ACCESS_SECRET");
  process.exit(1);
}

const client = new ZhihuClient(secret, null);
const portrait = await buildPortrait(client, "");

console.log("== stats ==");
console.log(JSON.stringify(portrait.stats, null, 2));
console.log("== keywords ==");
console.log(portrait.keywords.map((k) => `${k.word}(${k.score})`).join("  "));
console.log("== topContents ==");
for (const item of portrait.topContents) {
  console.log(`[${item.ContentType}] ${item.Title} 赞${item.LikeCount}`);
}
console.log("== favlists ==");
for (const fav of portrait.favlists) console.log(`- ${fav.title}｜${fav.description}`);
console.log("== followees(top) ==");
for (const f of portrait.followees.slice(0, 6)) {
  console.log(`- ${f.name}：${f.headline}（粉${f.followerCount}）`);
}
console.log("== recentCollections ==");
for (const item of portrait.recentCollections.slice(0, 6)) {
  console.log(`[${item.ContentType}] ${item.Title}`);
}
console.log("== warnings ==");
console.log(portrait.warnings.length ? portrait.warnings.join("\n") : "(none)");
