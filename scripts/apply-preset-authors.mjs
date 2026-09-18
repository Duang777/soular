import {
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(import.meta.dirname, "..");
const SCENE_ROOT = resolve(ROOT, "public/nebula-scene");
const PRESET_FILE = /^preset-[a-z0-9-]+\.js$/;
const ANSWER_ID = /\/answer\/(\d+)/;
const ZHIMG_HOST = /(^|\.)zhimg\.com$/i;
const MODULE_SOURCE = /^export const ([A-Z][A-Z0-9_]*) = ([\s\S]+);\s*$/;

function argument(name) {
  const prefix = `--${name}=`;
  const value = process.argv.find((entry) => entry.startsWith(prefix))
    ?.slice(prefix.length)
    .trim();
  if (!value) throw new Error(`缺少 --${name}`);
  return value;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseMetadata(value) {
  if (!isRecord(value) || !Array.isArray(value.rows)) {
    throw new Error("作者元数据必须包含 rows 数组");
  }
  return value.rows.map((row, position) => {
    if (!isRecord(row)) throw new Error(`rows[${position}] 不是对象`);
    const file = typeof row.file === "string" ? basename(row.file) : "";
    const index = Number(row.index);
    const id = typeof row.id === "string" ? row.id : "";
    const status = Number(row.status);
    const name = typeof row.name === "string" ? row.name.trim() : "";
    const avatarUrl = typeof row.avatarUrl === "string" ? row.avatarUrl : "";
    const voteupCount = Number(row.voteupCount);
    if (
      !PRESET_FILE.test(file) ||
      !Number.isInteger(index) ||
      index < 0 ||
      !/^\d+$/.test(id) ||
      !Number.isInteger(status)
    ) {
      throw new Error(`rows[${position}] 的文件、索引、回答 ID 或状态无效`);
    }
    return {
      file,
      index,
      id,
      status,
      name,
      avatarUrl,
      voteupCount: Number.isFinite(voteupCount) ? Math.max(0, voteupCount) : 0,
    };
  });
}

async function parsePreset(source, file, presetPath) {
  const match = MODULE_SOURCE.exec(source);
  if (!match) throw new Error(`${file} 不是可识别的静态预设模块`);
  const moduleUrl = pathToFileURL(presetPath);
  moduleUrl.searchParams.set("apply", String(process.pid));
  const preset = (await import(moduleUrl.href))[match[1]];
  if (
    !isRecord(preset) ||
    typeof preset.id !== "string" ||
    !Array.isArray(preset.people)
  ) {
    throw new Error(`${file} 缺少合法的 id 或 people`);
  }
  return { exportName: match[1], preset };
}

function safeAvatarUrl(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} 的头像 URL 无效`);
  }
  if (url.protocol !== "https:" || !ZHIMG_HOST.test(url.hostname)) {
    throw new Error(`${label} 的头像不属于 HTTPS zhimg 域名`);
  }
  return url;
}

function answerId(person, label) {
  const url = typeof person?.[4] === "string" ? person[4] : "";
  const id = ANSWER_ID.exec(url)?.[1];
  if (!id) throw new Error(`${label} 缺少知乎回答链接`);
  return id;
}

function remapIndices(indices, oldToNew) {
  if (!Array.isArray(indices)) return [];
  return indices
    .map((index) => oldToNew.get(index))
    .filter((index) => index !== undefined);
}

function serializePreset(exportName, preset) {
  const people = preset.people;
  const peopleLines = people
    .map((row) => `    ${JSON.stringify(row)},`)
    .join("\n");
  const body = JSON.stringify({ ...preset, people: "__PEOPLE__" }, null, 2)
    .replace('"__PEOPLE__"', `[\n${peopleLines}\n  ]`);
  return `export const ${exportName} = ${body};\n`;
}

function imageExtension(contentType) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/gif") return "gif";
  return "jpg";
}

async function downloadAvatar(url, basePath) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Referer: "https://www.zhihu.com/",
          "User-Agent": "Mozilla/5.0",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = (response.headers.get("content-type") ?? "")
        .split(";")[0]
        .trim()
        .toLowerCase();
      if (!contentType.startsWith("image/")) {
        throw new Error(`响应不是图片：${contentType || "unknown"}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 256 || bytes.length > 5 * 1024 * 1024) {
        throw new Error(`图片大小异常：${bytes.length} bytes`);
      }
      const output = `${basePath}.${imageExtension(contentType)}`;
      await writeFile(output, bytes);
      return output;
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await new Promise((done) => setTimeout(done, 500 * 2 ** attempt));
      }
    }
  }
  throw lastError;
}

const metadataPath = resolve(argument("metadata"));
const dropUnavailable = process.argv.includes("--drop-unavailable");
const metadata = parseMetadata(JSON.parse(await readFile(metadataPath, "utf8")));
const rowsByFile = Map.groupBy(metadata, (row) => row.file);
const plans = [];

for (const [file, rows] of rowsByFile) {
  const presetPath = resolve(SCENE_ROOT, file);
  const source = await readFile(presetPath, "utf8");
  const { exportName, preset } = await parsePreset(source, file, presetPath);
  const rowById = new Map(rows.map((row) => [row.id, row]));
  if (rowById.size !== rows.length) {
    throw new Error(`${file} 的作者元数据包含重复回答 ID`);
  }

  const kept = [];
  const dropped = [];
  const oldToNew = new Map();
  for (let index = 0; index < preset.people.length; index += 1) {
    const person = preset.people[index];
    const label = `${preset.id}#${index + 1}`;
    const id = answerId(person, label);
    const metadataRow = rowById.get(id);
    if (!metadataRow) throw new Error(`${label} 缺少作者元数据`);
    const complete =
      metadataRow.status === 200 &&
      metadataRow.name &&
      metadataRow.avatarUrl;
    if (!complete) {
      if (!dropUnavailable) {
        throw new Error(`${label} 无法取得真实作者，使用 --drop-unavailable 明确移除`);
      }
      dropped.push(metadataRow.id);
      continue;
    }
    const avatarUrl = safeAvatarUrl(metadataRow.avatarUrl, label);
    oldToNew.set(index, kept.length);
    kept.push({ person, metadata: metadataRow, avatarUrl });
  }
  if (!kept.length) throw new Error(`${preset.id} 没有可发布的真实作者回答`);

  preset.followed = remapIndices(preset.followed, oldToNew);
  if (Array.isArray(preset.circles)) {
    preset.circles = preset.circles
      .map((circle) => ({
        ...circle,
        members: remapIndices(circle?.members, oldToNew),
      }))
      .filter((circle) => circle.members.length >= 2);
  }
  plans.push({ file, presetPath, exportName, preset, kept, dropped });
}

for (const plan of plans) {
  const targetDirectory = resolve(SCENE_ROOT, `avatars/${plan.preset.id}`);
  const temporaryDirectory = `${targetDirectory}.tmp-${process.pid}`;
  await rm(temporaryDirectory, { recursive: true, force: true });
  await mkdir(temporaryDirectory, { recursive: true });
  try {
    for (let start = 0; start < plan.kept.length; start += 8) {
      const batch = plan.kept.slice(start, start + 8);
      await Promise.all(batch.map(async (item, offset) => {
        const index = start + offset;
        const stem = `u${String(index + 1).padStart(2, "0")}`;
        const downloaded = await downloadAvatar(
          item.avatarUrl,
          resolve(temporaryDirectory, stem),
        );
        item.avatarPath = `avatars/${plan.preset.id}/${basename(downloaded)}`;
      }));
    }

    plan.preset.people = plan.kept.map(({ person, metadata: row, avatarPath }) => {
      const next = [...person];
      next[0] = row.name;
      next[6] = row.voteupCount;
      next[7] = avatarPath;
      return next;
    });
    plan.preset.avatarBase = `avatars/${plan.preset.id}`;

    const temporaryPreset = `${plan.presetPath}.${process.pid}.tmp`;
    await writeFile(
      temporaryPreset,
      serializePreset(plan.exportName, plan.preset),
      "utf8",
    );
    await rm(targetDirectory, { recursive: true, force: true });
    await rename(temporaryDirectory, targetDirectory);
    await rename(temporaryPreset, plan.presetPath);
  } catch (error) {
    await rm(temporaryDirectory, { recursive: true, force: true });
    throw error;
  }

  const avatarFiles = await Promise.all(
    plan.preset.people.map((person) => stat(resolve(SCENE_ROOT, person[7]))),
  );
  console.log(
    `${plan.preset.id}: 写入 ${plan.kept.length} 位真实作者和 ${avatarFiles.length} 张头像` +
      (plan.dropped.length ? `，移除 ${plan.dropped.length} 条失效回答` : ""),
  );
}
