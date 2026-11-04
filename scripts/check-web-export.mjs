#!/usr/bin/env node
/**
 * Builds the web export (`pnpm run build:web`) as a check, with or without
 * the licensed Proxima Nova fonts.
 *
 * The web bundle requires the font files, which are gitignored and staged
 * only on the release hosts (see src/assets/fonts/README.md). A missing one
 * is stood in for by another TrueType font under its name, as
 * .github/workflows/ios-release.yml does: this export is never distributed.
 * Stand-ins are removed afterwards, and any found before the build (left by a
 * run that was killed) are removed first, so one is never taken for the font.
 *
 * usage: node scripts/check-web-export.mjs
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FONT_DIR = join(ROOT, "src/assets/fonts");
const FONTS = ["proximanova-reg.ttf", "proximanova-bold.ttf"];
const STAND_IN = join(ROOT, "node_modules/@react-native-vector-icons/material-icons/fonts/MaterialIcons.ttf");

const standIn = readFileSync(STAND_IN);
const isStandIn = (path) => existsSync(path) && readFileSync(path).equals(standIn);

const created = [];
const cleanUp = () => {
  for (const path of created.splice(0)) rmSync(path, { force: true });
};
process.on("exit", cleanUp);
// Ctrl-C or a pipeline abort: exit through the cleanup.
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => process.exit(130));

for (const font of FONTS) {
  const path = join(FONT_DIR, font);
  if (isStandIn(path)) rmSync(path);
  if (existsSync(path)) continue;
  copyFileSync(STAND_IN, path);
  created.push(path);
}
if (created.length > 0) console.log(`[web] standing in for ${created.length} licensed font(s)`);

const build = spawnSync("pnpm", ["run", "build:web"], { cwd: ROOT, stdio: "inherit" });
if (build.error) console.error(`[web] pnpm: ${build.error.message}`);
process.exit(build.status ?? 1);
