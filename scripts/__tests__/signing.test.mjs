import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const script = fileURLToPath(new URL("../inject-android-signing.mjs", import.meta.url));
test("signing passwords cannot interpolate Groovy and existing files become private", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "signing-test-"));
  try {
    fs.mkdirSync(path.join(temp, "android/app"), { recursive: true });
    fs.mkdirSync(path.join(temp, ".signing"));
    fs.writeFileSync(path.join(temp, ".signing/upload.jks"), "test");
    fs.writeFileSync(path.join(temp, "android/app/build.gradle"), "// fixture\n");
    const output = path.join(temp, "android/app/ci-signing.gradle");
    fs.writeFileSync(output, "", { mode: 0o644 });
    fs.writeFileSync(path.join(temp, ".signing.json"), JSON.stringify({ keystorePassword: "a${danger}'\\secret", keyAlias: "upload" }));
    execFileSync(process.execPath, [script], { env: { ...process.env, WORKSPACE: temp } });
    assert.ok(fs.readFileSync(output, "utf8").includes("storePassword 'a${danger}\\'\\\\secret'"));
    assert.equal(fs.statSync(output).mode & 0o777, 0o600);
    execFileSync(process.execPath, [script], { env: { ...process.env, WORKSPACE: temp } });
    assert.equal(fs.readFileSync(path.join(temp, "android/app/build.gradle"), "utf8").split('apply from:').length, 2);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
