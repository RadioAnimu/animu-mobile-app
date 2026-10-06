#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requested = process.argv.slice(2);
if (requested.length > 1) {
  console.error("Usage: pnpm run install:apk [path/to/app.apk]");
  process.exit(1);
}

const candidates = requested.length
  ? [path.resolve(requested[0])]
  : ["dist", "release-artifacts"].flatMap((dir) =>
      existsSync(path.join(root, dir))
        ? readdirSync(path.join(root, dir), { withFileTypes: true })
            .filter((entry) => entry.isFile() && entry.name.endsWith(".apk"))
            .map((entry) => path.join(root, dir, entry.name))
        : [],
    );
const apk = candidates.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
if (!apk || !apk.endsWith(".apk") || !existsSync(apk) || !statSync(apk).isFile()) {
  console.error("No APK found; supply a path or build an APK in dist/release-artifacts.");
  process.exit(1);
}

// Preserve application data. A signer mismatch must fail rather than erase it.
// ANDROID_SERIAL (adb's standard mechanism) selects a device when several run.
const result = spawnSync("adb", ["install", "-r", apk], { stdio: "inherit" });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
