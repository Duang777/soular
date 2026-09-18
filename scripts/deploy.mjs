import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repoRoot = realpathSync(fileURLToPath(new URL("..", import.meta.url)));
const serverRoot = realpathSync(fileURLToPath(new URL("../server", import.meta.url)));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const mode = process.argv[2] ?? "check";

function capture(command, args) {
  return execFileSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function run(command, args, cwd = repoRoot) {
  execFileSync(command, args, {
    cwd,
    stdio: "inherit",
  });
}

function repositoryRevision() {
  let branch;
  try {
    branch = capture("git", ["symbolic-ref", "--quiet", "--short", "HEAD"]);
  } catch {
    throw new Error("Deployment requires the main branch, not a detached HEAD.");
  }
  if (branch !== "main") {
    throw new Error(`Deployment requires branch main; current branch is ${branch}.`);
  }

  const status = capture("git", ["status", "--porcelain=v1", "--untracked-files=normal"]);
  if (status) {
    throw new Error(`Deployment requires a clean worktree:\n${status}`);
  }

  return {
    sha: capture("git", ["rev-parse", "HEAD"]),
    shortSha: capture("git", ["rev-parse", "--short=12", "HEAD"]),
  };
}

function main() {
  if (mode !== "check" && mode !== "deploy") {
    throw new Error("Usage: node scripts/deploy.mjs <check|deploy>");
  }

  const revision = repositoryRevision();
  console.log(`[deploy] validating main@${revision.shortSha}`);
  run(npm, ["run", "build"]);
  run(npm, ["run", "server:check"]);

  const verifiedRevision = repositoryRevision();
  if (verifiedRevision.sha !== revision.sha) {
    throw new Error("HEAD changed during deployment validation; run the command again.");
  }

  const wranglerArgs = [
    "exec",
    "wrangler",
    "--",
    "deploy",
    "--message",
    `git:${revision.sha}`,
    "--tag",
    revision.shortSha,
  ];

  if (mode === "check") {
    console.log(`[deploy] running Wrangler dry-run for git:${revision.sha}`);
    run(npm, [...wranglerArgs, "--dry-run"], serverRoot);
  } else {
    console.log(`[deploy] deploying git:${revision.sha}`);
    run(npm, wranglerArgs, serverRoot);
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[deploy] blocked: ${message}`);
  process.exitCode = 1;
}
