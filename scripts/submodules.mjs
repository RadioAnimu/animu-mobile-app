import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const libraries = {
  "animu-api": {
    repository: "RadioAnimu/animu-api", output: "dist", entry: "esm/index.js", types: "esm/index.d.ts",
    job: "Animu/animu-api", artifact: "animu-api-dist.tar.gz", prefix: "dist/",
  },
  "react-native-anything-player": {
    repository: "rmotafreitas/react-native-anything-player", output: "lib", entry: "module/index.js", types: "typescript/src/index.d.ts",
    job: "Animu/react-native-anything-player", artifact: "react-native-anything-player.tgz", prefix: "package/lib/",
  },
};
export function run(command, args, cwd) {
  return execFileSync(command, args, { cwd, stdio: "inherit", env: { ...process.env, COREPACK_ENABLE_DOWNLOAD_PROMPT: "0" } });
}
export function revision(dir) {
  if (!fs.existsSync(path.join(dir, ".git"))) return null;
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, encoding: "utf8" }).trim();
}
export function clean(dir) {
  if (!fs.existsSync(path.join(dir, ".git"))) return false;
  return execFileSync("git", ["status", "--porcelain", "--untracked-files=normal"], { cwd: dir, encoding: "utf8" }).trim() === "";
}
// Build/test from the actual worktree, including local edits, with an isolated
// toolchain. Never delete a developer's node_modules or expose a second React
// Native installation to the application's Metro/autolinker.
export function isolated(name, action) {
  const source = path.join(root, "packages", name);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
  try {
    const files = fs.existsSync(path.join(source, ".git"))
      ? execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: source, encoding: "utf8" }).split("\0").filter(Boolean)
      : exportedFiles(source);

    for (const file of new Set(files)) {
      if (!fs.existsSync(path.join(source, file))) continue;
      fs.mkdirSync(path.dirname(path.join(temp, file)), { recursive: true });
      fs.copyFileSync(path.join(source, file), path.join(temp, file));
    }
    const manager = name === "animu-api" ? "pnpm" : "yarn";
    run("corepack", [manager, "install", manager === "pnpm" ? "--frozen-lockfile" : "--immutable"], temp);
    action(temp, (script, ...args) => run("corepack", [manager, "run", script, ...args], temp));
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

// EAS source archives omit Git metadata. Retain the library's build inputs,
// including Yarn's example workspace, while leaving generated caches behind.
function exportedFiles(dir, prefix = "") {
  return fs.readdirSync(path.join(dir, prefix), { withFileTypes: true }).flatMap(entry => {
    if (["node_modules", ".git", "dist", "lib", "build", ".build", "coverage", ".gradle", ".turbo", "cache"].includes(entry.name)) return [];
    const file = path.join(prefix, entry.name);
    if (entry.isDirectory()) return exportedFiles(dir, file);
    return entry.isFile() ? [file] : [];
  });
}
