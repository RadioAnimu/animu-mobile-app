import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
const constant = (name) => Number(read("scripts/check-bundle-size.mjs").match(new RegExp(`${name} = ([\\d_]+)`))[1].replaceAll("_", ""));

test("every pipeline checks the bundle against the budgets `pnpm verify` uses", () => {
  const budgets = [constant("DEFAULT_MAX_BUNDLE"), constant("DEFAULT_MAX_ASSETS")];
  for (const file of ["Jenkinsfile", "Jenkinsfile.release", ".github/workflows/ci.yml"]) {
    const call = read(file).replace(/\s*\\\n\s*/g, " ").match(/check-bundle-size\.mjs (\S+) (\d+) (\S+) (\d+)/);
    assert.ok(call, `${file} runs check-bundle-size.mjs with both budgets`);
    assert.deepEqual([Number(call[2]), Number(call[4])], budgets, file);
  }
});
