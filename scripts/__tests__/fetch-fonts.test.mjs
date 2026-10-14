import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

test("a failed private font download does not expose its signed URL", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "animu-font-fetch-test-"));
  try {
    fs.mkdirSync(path.join(dir, "scripts"));
    fs.mkdirSync(path.join(dir, "bin"));
    fs.copyFileSync("scripts/fetch-fonts.mjs", path.join(dir, "scripts/fetch-fonts.mjs"));
    fs.writeFileSync(path.join(dir, "bin/curl"), "#!/bin/sh\ncat >/dev/null\nprintf 'source unavailable' >&2\nexit 22\n", { mode: 0o700 });
    const result = spawnSync(process.execPath, [path.join(dir, "scripts/fetch-fonts.mjs")], {
      encoding: "utf8",
      env: { ...process.env, PATH: path.join(dir, "bin") + path.delimiter + process.env.PATH,
        PROXIMA_NOVA_FONTS_DIR: "", PROXIMA_NOVA_FONTS_URL: "https://fonts.example/font.zip?signature=sensitive-font-signature" },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Private build-font download or extraction failed/);
    assert.doesNotMatch(result.stdout + result.stderr, /fonts\.example|sensitive-font-signature/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
