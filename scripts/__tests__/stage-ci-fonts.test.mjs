import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { brotliCompressSync } from "node:zlib";
import { stageFonts } from "../stage-ci-fonts.mjs";

const font = Buffer.from([0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
const data = { "proximanova-reg.ttf": font.toString("base64"), "proximanova-bold.ttf": font.toString("base64") };
const parts = value => {
  const archive = brotliCompressSync(Buffer.from(JSON.stringify(value))).toString("base64");
  const split = Math.ceil(archive.length / 5);
  return Array.from({ length: 5 }, (_, i) => archive.slice(i * split, (i + 1) * split));
};
test("private font staging retains bytes and restricts file permissions", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "animu-font-test-"));
  try {
    stageFonts(parts(data), dir);
    for (const name of Object.keys(data)) {
      assert.deepEqual(fs.readFileSync(path.join(dir, name)), font);
      assert.equal(fs.statSync(path.join(dir, name)).mode & 0o777, 0o600);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test("font staging rejects missing secrets, corrupt input and unexpected archive entries", () => {
  assert.throws(() => stageFonts(Array(5).fill(""), "/unused"), /unavailable/);
  assert.throws(() => stageFonts(Array(5).fill("!"), "/unused"), /Invalid/);
  assert.throws(() => stageFonts(parts({ ...data, "../outside.ttf": "invalid" }), "/unused"), /exactly/);
  assert.throws(() => stageFonts(parts({ ...data, "proximanova-reg.ttf": "invalid" }), "/unused"), /format/);
});
test("font staging refuses a symlink destination without overwriting it", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "animu-font-test-"));
  try {
    const sentinel = path.join(dir, "sentinel"); fs.writeFileSync(sentinel, "preserve");
    fs.symlinkSync(sentinel, path.join(dir, "proximanova-reg.ttf"));
    assert.throws(() => stageFonts(parts(data), dir), { code: "EEXIST" });
    assert.equal(fs.readFileSync(sentinel, "utf8"), "preserve");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
