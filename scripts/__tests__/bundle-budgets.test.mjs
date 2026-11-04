import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STEPS } from "../verify.mjs";

const read = (file) => readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
const constant = (name) => Number(read("scripts/check-bundle-size.mjs").match(new RegExp(`${name} = ([\\d_]+)`))[1].replaceAll("_", ""));
const scripts = JSON.parse(read("package.json")).scripts;

test("every pipeline checks the bundle against the budgets `pnpm verify` uses", () => {
  const budgets = [constant("DEFAULT_MAX_BUNDLE"), constant("DEFAULT_MAX_ASSETS")];
  // `pnpm verify` runs the size check with no arguments: the defaults above.
  assert.ok(STEPS.some((step) => step.script === "check:bundle-size"));
  assert.equal(scripts["check:bundle-size"], "node scripts/check-bundle-size.mjs");
  for (const file of ["Jenkinsfile", "Jenkinsfile.release", ".github/workflows/ci.yml"]) {
    const text = read(file).replace(/\s*\\\n\s*/g, " ");
    if (/^\s*(run: )?pnpm verify\s*$/m.test(text)) continue;
    const call = text.match(/check-bundle-size\.mjs (\S+) (\d+) (\S+) (\d+)/);
    assert.ok(call, `${file} runs pnpm verify, or check-bundle-size.mjs with both budgets`);
    assert.deepEqual([Number(call[2]), Number(call[4])], budgets, file);
  }
});
