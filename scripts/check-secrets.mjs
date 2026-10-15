#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { root, libraries } from "./submodules.mjs";

const repositories = [root, ...Object.keys(libraries).map((name) => path.join(root, "packages", name))];

const version = "8.30.1";
const distributions = {
  "darwin-arm64": ["darwin_arm64", "b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5"],
  "darwin-x64": ["darwin_x64", "dfe101a4db2255fc85120ac7f3d25e4342c3c20cf749f2c20a18081af1952709"],
  "linux-arm64": ["linux_arm64", "e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080"],
  "linux-x64": ["linux_x64", "551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb"],
};
const distribution = distributions[`${process.platform}-${process.arch}`];
if (!distribution) throw new Error("Unsupported secret-scanner platform");
const [platform, checksum] = distribution;

// The download is cached in the user's cache directory (never a shared
// temporary one) and only reused while its checksum still matches.
const cacheHome = process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache");
const archive = path.join(cacheHome, `animu-gitleaks-${version}-${platform}.tar.gz`);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function cachedArchive() {
  try {
    return fs.readFileSync(archive);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function verifiedArchive() {
  const cached = cachedArchive();
  if (cached && sha256(cached) === checksum) return cached;
  const url = `https://github.com/gitleaks/gitleaks/releases/download/v${version}/gitleaks_${version}_${platform}.tar.gz`;
  const response = await fetch(url, { signal: AbortSignal.timeout(45_000) });
  if (!response.ok) throw new Error(`Gitleaks download failed (${response.status})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (sha256(bytes) !== checksum) throw new Error("Gitleaks archive checksum mismatch");
  fs.mkdirSync(cacheHome, { recursive: true, mode: 0o700 });
  fs.writeFileSync(archive, bytes, { mode: 0o600 });
  return bytes;
}

/** Scans all history, then the working tree's tracked and unignored files. */
function scan(scanner, dir) {
  const shallow = execFileSync("git", ["rev-parse", "--is-shallow-repository"], { cwd: dir, encoding: "utf8" }).trim();
  if (shallow !== "false") throw new Error(`Full Git history required for secret scanning: ${path.basename(dir)}`);
  console.log(`Secret scan: ${path.basename(dir)} (all history and current tracked files)`);
  const config = path.join(dir, ".gitleaks.toml");
  const flags = ["--no-banner", "--redact", "--ignore-gitleaks-allow", ...(fs.existsSync(config) ? ["--config", config] : [])];
  execFileSync(scanner, ["git", dir, "--log-opts=--all", ...flags], { stdio: "inherit" });
  const snapshot = fs.mkdtempSync(path.join(os.tmpdir(), "animu-secret-snapshot-"));
  try {
    const files = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: dir, encoding: "utf8" }).split("\0").filter(Boolean);
    for (const file of new Set(files)) {
      const source = path.join(dir, file);
      if (!fs.existsSync(source) || !fs.statSync(source).isFile()) continue;
      const target = path.join(snapshot, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, target);
    }
    execFileSync(scanner, ["dir", snapshot, ...flags], { stdio: "inherit" });
  } finally {
    fs.rmSync(snapshot, { recursive: true, force: true });
  }
}

// Extract the verified bytes themselves (not the cache file, which could be
// swapped after the check) into a private directory, and run that binary.
const work = fs.mkdtempSync(path.join(os.tmpdir(), "animu-gitleaks-"));
try {
  execFileSync("tar", ["-xzf", "-", "gitleaks"], { cwd: work, input: await verifiedArchive() });
  for (const dir of repositories) scan(path.join(work, "gitleaks"), dir);
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
