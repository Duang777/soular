import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getNebulaPreset,
  listNebulaPresets,
} from "../public/nebula-scene/presets.js";

const sceneRoot = resolve(fileURLToPath(new URL("../public/nebula-scene/", import.meta.url)));
const placeholderName = /^知乎(?:回答|答主)\s*\d+$/;
const violations = [];

for (const summary of listNebulaPresets()) {
  if (summary.kind !== "real") continue;
  const preset = getNebulaPreset(summary.id);
  preset.people.forEach((person, index) => {
    const label = `${preset.id}#${index + 1}`;
    const name = typeof person[0] === "string" ? person[0].trim() : "";
    if (!name || placeholderName.test(name)) {
      violations.push(`${label} 使用占位用户名 ${JSON.stringify(name)}`);
    }

    const declaredAvatar = typeof person[7] === "string" ? person[7] : "";
    const avatarPath = declaredAvatar ||
      (preset.avatarBase
        ? `${preset.avatarBase}/u${String(index + 1).padStart(2, "0")}.jpg`
        : "");
    if (!avatarPath || avatarPath.startsWith("../personas/")) {
      violations.push(`${label} 未绑定真实作者头像`);
      return;
    }
    if (/^https?:\/\//i.test(avatarPath)) {
      try {
        const avatarUrl = new URL(avatarPath);
        if (
          avatarUrl.protocol !== "https:" ||
          !/(^|\.)zhimg\.com$/i.test(avatarUrl.hostname)
        ) {
          violations.push(`${label} 远程头像不属于 HTTPS zhimg 域名`);
        }
      } catch {
        violations.push(`${label} 远程头像 URL 无效`);
      }
      return;
    }

    const absoluteAvatar = resolve(sceneRoot, avatarPath);
    if (!absoluteAvatar.startsWith(`${sceneRoot}${sep}`)) {
      violations.push(`${label} 头像路径越界 ${avatarPath}`);
      return;
    }
    try {
      if (statSync(absoluteAvatar).size === 0) {
        violations.push(`${label} 头像文件为空 ${avatarPath}`);
      }
    } catch {
      violations.push(`${label} 缺少头像文件 ${avatarPath}`);
    }
  });
}

if (violations.length) {
  assert.fail(`真实星云作者完整性检查失败：\n${violations.join("\n")}`);
}

const builderSource = readFileSync(
  new URL("../server/scripts/build-preset.ts", import.meta.url),
  "utf8",
);
assert.doesNotMatch(
  builderSource,
  /知乎答主 \$\{String\(index \+ 1\)|\.\.\/personas\/\$\{answer\.cast\}/,
  "正式快照构建器不得生成编号名或人格占位头像",
);
assert.match(
  builderSource,
  /缺少真实作者姓名或头像，拒绝生成带占位身份的正式快照/,
  "正式快照构建器必须在作者身份不完整时失败",
);

console.log("preset author checks passed");
