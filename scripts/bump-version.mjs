#!/usr/bin/env node
/**
 * Resolves the release version for app.json and, optionally, bumps it.
 *
 * usage: node scripts/bump-version.mjs [--bump none|versionCode|patch|minor|major]
 *                                     [--version X.Y.Z] [--code N] [--json]
 *
 * Resolution order:
 *   1. --version / --code override anything from the bump.
 *   2. --bump increments the value already in app.json.
 *   3. Otherwise app.json is left as-is.
 *
 * Prints the resulting { version, versionCode } as a single JSON line (so the
 * pipeline can read it back), and lists changed files on stderr. Writes
 * app.json in place only when something actually changes.
 */
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const get = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const bump = get("bump", "none");
const versionOverride = get("version", "");
const codeOverride = get("code", "");

const appJsonPath = path.join(process.cwd(), "app.json");
const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));
const expo = appJson.expo ?? {};

const bumped = { version: String(expo.version ?? ""), versionCode: Number(expo.android?.versionCode ?? 0) };

const bumpSemver = (v, kind) => {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v);
  if (!m) throw new Error(`not a semver version: ${v}`);
  let [major, minor, patch] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (kind === "major") { major += 1; minor = 0; patch = 0; }
  else if (kind === "minor") { minor += 1; patch = 0; }
  else { patch += 1; }
  return `${major}.${minor}.${patch}`;
};

if (bump === "versionCode") {
  bumped.versionCode += 1;
} else if (bump === "patch" || bump === "minor" || bump === "major") {
  bumped.version = bumpSemver(bumped.version, bump);
  bumped.versionCode += 1;
} else if (bump !== "none") {
  console.error(`[bump] unknown BUMP value: ${bump}`);
  process.exit(1);
}

if (versionOverride) bumped.version = versionOverride;
if (codeOverride) bumped.versionCode = Number(codeOverride);

if (!bumped.version || !Number.isInteger(bumped.versionCode) || bumped.versionCode < 1) {
  console.error(`[bump] refusing invalid version/versionCode: ${JSON.stringify(bumped)}`);
  process.exit(1);
}

// Write back only when something changed.
const before = JSON.stringify({ v: expo.version, c: expo.android?.versionCode });
const after = JSON.stringify({ v: bumped.version, c: bumped.versionCode });
if (before !== after) {
  expo.version = bumped.version;
  expo.android = expo.android ?? {};
  expo.android.versionCode = bumped.versionCode;
  appJson.expo = expo;
  fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + "\n");
  console.error(`[bump] app.json: version ${expo.version}, versionCode ${bumped.versionCode}`);
} else {
  console.error("[bump] no change");
}

// Machine-readable outputs: a JSON line on stdout, plus simple value files so
// Jenkins can read them without the Pipeline Utility Steps plugin.
process.stdout.write(JSON.stringify(bumped) + "\n");

const outFile = get("out", "");
if (outFile) {
  fs.writeFileSync(`${outFile}.version`, String(bumped.version));
  fs.writeFileSync(`${outFile}.versionCode`, String(bumped.versionCode));
  console.error(`[bump] wrote ${outFile}.version and ${outFile}.versionCode`);
}
