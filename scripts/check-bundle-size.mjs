#!/usr/bin/env node
/**
 * Fails when the exported JS bundle or its asset directory outgrow a budget,
 * so a heavy dependency or an unoptimised image is caught in review rather
 * than after release.
 *
 * usage: node scripts/check-bundle-size.mjs <bundle> <maxBundleBytes> [<assetsDir> <maxAssetBytes>]
 *        node scripts/check-bundle-size.mjs   (no arguments: builds the release
 *        Android bundle the way CI does and checks it against CI's budgets)
 *
 * Budgets sit ~10% above the measured size at the time they were set
 * (bundle 3.21 MB, assets 1.81 MB); raise them deliberately, with the reason
 * in the commit, when a feature genuinely needs the room.
 *
 * Raised Oct 2026 to 3.9 MB JS (measured 3.37 MB): synced lyrics with the
 * offline Japanese reader (kuromoji, wanakana, fflate), frame-synced keyboard
 * handling (react-native-keyboard-controller, ~106 KB — Metro does not
 * tree-shake its unused toolbar/chat views) and React Navigation 7.14.3.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** CI's budgets (the pipelines pass the same numbers; a tooling test keeps them in step). */
const DEFAULT_MAX_BUNDLE = 3_900_000;
const DEFAULT_MAX_ASSETS = 2_000_000;

let [, , bundle, maxBundle, assetsDir, maxAssets] = process.argv;
/** The self-built bundle's folder, removed on exit. */
let out = null;

if (process.argv.length === 2) {
  out = mkdtempSync(join(tmpdir(), "animu-bundle-"));
  process.on("exit", () => rmSync(out, { recursive: true, force: true }));
  // Ctrl-C ends the build too: exit through the cleanup instead of the default kill.
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => process.exit(130));
  bundle = join(out, "index.android.bundle");
  assetsDir = join(out, "assets");
  [maxBundle, maxAssets] = [String(DEFAULT_MAX_BUNDLE), String(DEFAULT_MAX_ASSETS)];
  const build = spawnSync(
    "pnpm",
    ["exec", "expo", "export:embed", "--platform", "android", "--entry-file", "index.js",
      "--bundle-output", bundle, "--assets-dest", assetsDir, "--dev", "false"],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
  if (build.status !== 0) {
    console.error(`[size] the release bundle did not build${build.signal ? ` (${build.signal})` : ""}`);
    process.exit(1);
  }
}

const dirBytes = (dir) =>
  readdirSync(dir, { withFileTypes: true }).reduce(
    (sum, entry) =>
      sum +
      (entry.isDirectory()
        ? dirBytes(join(dir, entry.name))
        : statSync(join(dir, entry.name)).size),
    0,
  );

const mb = (bytes) => `${(bytes / 1048576).toFixed(2)} MB`;
let failed = false;

const check = (label, actual, budget) => {
  const ok = actual <= budget;
  console.log(`[size] ${label}: ${mb(actual)} / budget ${mb(budget)}${ok ? "" : "  OVER BUDGET"}`);
  if (!ok) failed = true;
};

if (!bundle || !Number(maxBundle)) {
  console.error("usage: check-bundle-size.mjs <bundle> <maxBundleBytes> [<assetsDir> <maxAssetBytes>]");
  process.exit(2);
}

check("JS bundle", statSync(bundle).size, Number(maxBundle));
if (assetsDir && Number(maxAssets)) {
  check("assets", dirBytes(assetsDir), Number(maxAssets));
}

process.exit(failed ? 1 : 0);
