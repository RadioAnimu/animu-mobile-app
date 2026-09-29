#!/usr/bin/env node
/**
 * Prints the app's Android target SDK (a single number, or "?" if not found).
 * The value comes from app.json's `expo-build-properties` plugin, which is what
 * the native project is generated with.
 *
 * Kept as a file (rather than an inline `node -p`) so the release pipeline does
 * not have to fight nested shell quoting.
 */
import fs from "node:fs";
import path from "node:path";

const appJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), "app.json"), "utf8"));
const expo = appJson.expo ?? {};

let target = expo.android?.targetSdkVersion;

if (!target) {
  const plugin = (expo.plugins ?? []).find(
    (p) => Array.isArray(p) && p[0] === "expo-build-properties"
  );
  target = plugin?.[1]?.android?.targetSdkVersion;
}

process.stdout.write(String(target ?? "?"));
