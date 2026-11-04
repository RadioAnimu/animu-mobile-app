import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("../bump-version.mjs", import.meta.url));

/** Runs the script on an app.json holding `expo`; returns its output and the app.json after. */
function bump(expo, ...args) {
  const dir = mkdtempSync(join(tmpdir(), "bump-"));
  try {
    writeFileSync(join(dir, "app.json"), JSON.stringify({ expo }, null, 2) + "\n");
    const run = spawnSync(process.execPath, [script, ...args], { cwd: dir, encoding: "utf8" });
    return { status: run.status, out: run.stdout, expo: JSON.parse(readFileSync(join(dir, "app.json"), "utf8")).expo };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const app = { version: "4.1.0", android: { versionCode: 21 }, ios: { buildNumber: "21" } };

test("a bump moves the iOS build number with the versionCode", () => {
  const { status, out, expo } = bump(app, "--bump", "patch");
  assert.equal(status, 0);
  assert.deepEqual(JSON.parse(out), { version: "4.1.1", versionCode: 22 });
  assert.equal(expo.android.versionCode, 22);
  assert.equal(expo.ios.buildNumber, "22");
});

test("an override sets both build numbers", () => {
  assert.equal(bump(app, "--code", "30").expo.ios.buildNumber, "30");
});

test("an iOS build number behind the versionCode is brought level", () => {
  const { expo } = bump({ ...app, ios: { buildNumber: "7" } });
  assert.equal(expo.ios.buildNumber, "21");
  assert.equal(expo.android.versionCode, 21);
});

test("an iOS build number ahead of the versionCode is refused, not lowered", () => {
  const { status, expo } = bump({ ...app, ios: { buildNumber: "23" } });
  assert.equal(status, 1);
  assert.equal(expo.ios.buildNumber, "23");
});

test("no bump leaves an aligned app.json untouched", () => {
  const { status, expo } = bump(app);
  assert.equal(status, 0);
  assert.deepEqual(expo, app);
});
