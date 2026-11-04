#!/usr/bin/env node
/**
 * Every check the pipelines run, with one summary at the end: each step runs
 * even after a failure, so one pass shows all that is broken. Jenkins and
 * GitHub CI run this script, so a local run and CI cannot drift apart.
 *
 * Steps of a stage run at once (half the cores at a time, each step's output
 * printed whole when it ends); stages run in order. The two Metro exports are
 * in separate stages: they share Metro's cache.
 *
 * usage: pnpm verify            every step
 *        pnpm verify --fast     skips the slow ones (secrets, submodules, bundle, doctor, network)
 *        pnpm verify --serial   one step at a time, its output live
 */
import { spawn } from "node:child_process";
import { realpathSync } from "node:fs";
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";

/**
 * A pnpm script, or a raw command; `slow` steps are skipped by `--fast`. The
 * longest come first, so they start first and the others fill in around them.
 */
export const STEPS = [
  { label: "player", script: "check:player", slow: true },
  { label: "secrets", script: "check:secrets", slow: true },
  { label: "animu-api", script: "check:animu-api", slow: true },
  { label: "unit tests + coverage", script: "test:coverage" },
  { label: "typecheck", script: "typecheck" },
  { label: "bundle size", script: "check:bundle-size", slow: true },
  { label: "react doctor", script: "doctor:gate", slow: true },
  { label: "eslint", script: "lint:eslint" },
  { label: "expo doctor", script: "check:expo-doctor", slow: true },
  { label: "knip + sherif", script: "lint:deps" },
  { label: "oxlint", script: "lint:types" },
  { label: "dependency audit", script: "check:audit", slow: true },
  { label: "expo deps", script: "check:expo-deps", slow: true },
  { label: "tooling tests", script: "test:tooling" },
  { label: "python tooling tests", command: ["python3", "-m", "unittest", "discover", "-s", "scripts/__tests__", "-p", "*_test.py"] },
  // After the bundle-size export: the two Metro exports share Metro's cache.
  { label: "web export", command: ["node", "scripts/check-web-export.mjs"], slow: true, stage: 1 },
];

const FLAGS = new Set(["--fast", "--serial"]);

/** The steps `args` select, or `null` for an unknown argument. */
export function plan(args) {
  if (args.some((arg) => !FLAGS.has(arg))) return null;
  return STEPS.filter((step) => !(args.includes("--fast") && step.slow));
}

/** `steps` grouped by stage, in stage order. */
export function stages(steps) {
  const byStage = new Map();
  for (const step of steps) {
    const stage = step.stage ?? 0;
    byStage.set(stage, [...(byStage.get(stage) ?? []), step]);
  }
  return [...byStage.keys()].sort((a, b) => a - b).map((stage) => byStage.get(stage));
}

/** How many steps run at once: half the cores, at least two (one with `--serial`). */
export function concurrency(args, cores = availableParallelism()) {
  return args.includes("--serial") ? 1 : Math.max(2, Math.floor(cores / 2));
}

const commandOf = (step) => step.command ?? ["pnpm", "run", "--silent", step.script];

/** Runs one step; its output goes live to the terminal, or is kept to print whole. */
function run(step, live) {
  const [command, ...args] = commandOf(step);
  const started = Date.now();
  return new Promise((resolve) => {
    const env = process.stdout.isTTY ? { ...process.env, FORCE_COLOR: "1" } : process.env;
    const child = spawn(command, args, { stdio: live ? "inherit" : ["ignore", "pipe", "pipe"], env });
    const output = [];
    child.stdout?.on("data", (chunk) => output.push(chunk));
    child.stderr?.on("data", (chunk) => output.push(chunk));
    // A command that could not start prints nothing itself.
    child.on("error", (error) => output.push(Buffer.from(`  ${command}: ${error.message}\n`)));
    child.on("close", (status) => {
      resolve({ ok: status === 0, seconds: Math.round((Date.now() - started) / 1000), output: Buffer.concat(output) });
    });
  });
}

/** Runs `task` on every item, at most `limit` at a time. */
async function pool(items, limit, task) {
  const queue = [...items];
  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) await task(item);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

async function main(args) {
  const steps = plan(args);
  if (!steps) {
    console.error("usage: pnpm verify [--fast] [--serial]");
    return 2;
  }
  const limit = concurrency(args);
  const live = limit === 1;
  const results = new Map();
  for (const stage of stages(steps)) {
    await pool(stage, limit, async (step) => {
      const header = `\n▶ ${step.label} (${commandOf(step).join(" ")})`;
      if (live) console.log(header);
      else console.log(`· ${step.label} started`);
      const result = await run(step, live);
      if (!live) {
        console.log(header);
        process.stdout.write(result.output);
      }
      results.set(step, result);
    });
  }

  console.log("\nverify summary");
  for (const step of steps) {
    const { ok, seconds } = results.get(step);
    console.log(`  ${ok ? "✓" : "✗"} ${step.label.padEnd(24)} ${String(seconds).padStart(4)} s`);
  }
  const failed = steps.filter((step) => !results.get(step).ok);
  console.log(failed.length ? `\n${failed.length} step(s) failed.` : "\nAll steps passed.");
  return failed.length ? 1 : 0;
}

// Run as a script (not imported by its test), however the path reached it.
const invoked = process.argv[1] ? realpathSync(process.argv[1]) : "";
if (invoked === fileURLToPath(import.meta.url)) process.exitCode = await main(process.argv.slice(2));
