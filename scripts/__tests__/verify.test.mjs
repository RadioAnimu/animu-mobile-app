import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { concurrency, plan, stepEnv, stages, STEPS } from "../verify.mjs";

const scripts = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")).scripts;

test("every step is a package script or a command", () => {
  for (const step of STEPS) assert.ok(step.command ?? scripts[step.script], step.label);
});

test("`pnpm run lint` runs the linters verify runs", () => {
  const linters = STEPS.filter((step) => step.script?.startsWith("lint:")).map((step) => `pnpm run ${step.script}`);
  assert.deepEqual(scripts.lint.split(" && ").sort(), linters.sort());
});

test("the two Metro exports never run at once", () => {
  const metro = STEPS.filter((step) => step.script === "check:bundle-size" || step.command?.includes("scripts/check-web-export.mjs"));
  assert.equal(metro.length, 2);
  assert.notEqual(metro[0].stage ?? 0, metro[1].stage ?? 0);
});

test("stages run in order; --fast skips the slow steps; an unknown flag is refused", () => {
  const order = stages(plan([])).map((stage) => stage[0].stage ?? 0);
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.equal(stages(plan([])).flat().length, STEPS.length);
  assert.ok(plan(["--fast"]).every((step) => !step.slow));
  assert.equal(plan(["--fats"]), null);
});

test("half the cores at a time, at least two; one with --serial", () => {
  assert.equal(concurrency([], 12, {}), 6);
  assert.equal(concurrency([], 2, {}), 2);
  assert.equal(concurrency(["--serial"], 12, {}), 1);
});

test("run as a script, it runs, through a symlink too (an unknown flag exits 2)", () => {
  const script = fileURLToPath(new URL("../verify.mjs", import.meta.url));
  const dir = mkdtempSync(join(tmpdir(), "verify-"));
  try {
    const link = join(dir, "verify.mjs");
    symlinkSync(script, link);
    for (const path of [script, link]) {
      const run = spawnSync(process.execPath, [path, "--bogus"], { encoding: "utf8" });
      assert.equal(run.status, 2, path);
      assert.match(run.stderr, /usage: pnpm verify/);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("VERIFY_JOBS sets the count; a verify a step starts gets at most 2", () => {
  assert.equal(concurrency([], 12, { VERIFY_JOBS: "3" }), 3);
  assert.equal(concurrency([], 12, { VERIFY_JOBS: "x" }), 6);
  assert.equal(stepEnv(6, {}, false).VERIFY_JOBS, "2");
  assert.equal(stepEnv(1, {}, false).VERIFY_JOBS, "1");
  assert.equal(stepEnv(6, {}, false).VERIFY_RUNNING, "1");
});
