#!/usr/bin/env node
/**
 * Every check the pipelines run, with one summary at the end: each step runs
 * even after a failure, so one pass shows all that is broken. Jenkins and
 * GitHub CI run this script, so a local run and CI cannot drift apart.
 *
 * Steps of a stage run at once (half the cores at a time, each step's output
 * printed whole when it ends); stages run in order. A step `after` another
 * waits for it: the two Metro exports share Metro's cache.
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
  // Waits for the bundle-size export only: the two Metro exports share Metro's cache.
  { label: "web export", command: ["node", "scripts/check-web-export.mjs"], slow: true, after: "bundle size" },
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
  // A step `after` another starts last, so it waits as little as it can.
  for (const step of [...steps].sort((a, b) => Number(Boolean(a.after)) - Number(Boolean(b.after)))) {
    const stage = step.stage ?? 0;
    byStage.set(stage, [...(byStage.get(stage) ?? []), step]);
  }
  return [...byStage.keys()].sort((a, b) => a - b).map((stage) => byStage.get(stage));
}

/**
 * How many steps run at once: VERIFY_JOBS if set (a verify started by
 * another's step gets 2), else half the cores and at least two; one with
 * `--serial`.
 */
export function concurrency(args, cores = availableParallelism(), env = process.env) {
  if (args.includes("--serial")) return 1;
  const jobs = Number(env.VERIFY_JOBS);
  if (Number.isInteger(jobs) && jobs >= 1) return jobs;
  return Math.max(2, Math.floor(cores / 2));
}

/**
 * What every step sees: VERIFY_RUNNING (the test runners then take half the
 * cores) and VERIFY_JOBS for a verify a step starts (a library's checks).
 */
export function stepEnv(limit, env = process.env, tty = process.stdout.isTTY) {
  return {
    ...env,
    // The test runners take half the cores only beside other steps.
    ...(limit > 1 ? { VERIFY_RUNNING: "1" } : {}),
    VERIFY_JOBS: String(Math.min(2, limit)),
    ...(tty ? { FORCE_COLOR: "1" } : {}),
  };
}

/**
 * The package manager this script runs under, as `pnpm run` named it in
 * npm_execpath (a JS file runs on this Node), or `pnpm` from PATH.
 */
export function runner(env = process.env) {
  const execPath = env.npm_execpath;
  if (!execPath) return ["pnpm"];
  return /\.[cm]?js$/.test(execPath) ? [process.execPath, execPath] : [execPath];
}

const commandOf = (step) => step.command ?? ["pnpm", "run", "--silent", step.script];

/** The steps running now, each a process group of its own; the signal that stopped verify. */
const running = new Set();
let stoppedBy = null;
const SIGNAL_EXIT = { SIGINT: 130, SIGTERM: 143 };

/** Ctrl-C or a pipeline abort: start nothing more, and stop what runs (its whole tree); a second one kills it. */
function stop(signal) {
  if (stoppedBy) {
    // Again: a step that ignores the first signal does not get to hang verify.
    for (const child of running) {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        // Already gone.
      }
    }
    process.exit(SIGNAL_EXIT[stoppedBy]);
  }
  stoppedBy = signal;
  for (const child of running) {
    try {
      process.kill(-child.pid, signal);
    } catch {
      // Already gone.
    }
  }
}

/** Runs one step; its output goes live to the terminal, or is kept to print whole. */
function run(step, live, env) {
  const [command, ...args] = step.command ?? [...runner(), "run", "--silent", step.script];
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: live ? ["ignore", "inherit", "inherit"] : ["ignore", "pipe", "pipe"],
      // Its own process group, so stop() reaches everything it starts.
      detached: true, env });
    child.verifyLabel = step.label;
    running.add(child);
    const output = [];
    child.stdout?.on("data", (chunk) => output.push(chunk));
    child.stderr?.on("data", (chunk) => output.push(chunk));
    // A command that could not start prints nothing itself.
    child.on("error", (error) => output.push(Buffer.from(`  ${command}: ${error.message}\n`)));
    child.on("close", (status) => {
      running.delete(child);
      resolve({ ok: status === 0, seconds: Math.round((Date.now() - started) / 1000), output: Buffer.concat(output) });
    });
  });
}

/** Runs `task` on every item, at most `limit` at a time. */
async function pool(items, limit, task) {
  const queue = [...items];
  const worker = async () => {
    for (let item = queue.shift(); item && !stoppedBy; item = queue.shift()) await task(item);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

async function main(args) {
  const steps = plan(args);
  if (!steps) {
    console.error("usage: pnpm verify [--fast] [--serial]");
    return 2;
  }
  for (const signal of Object.keys(SIGNAL_EXIT)) process.on(signal, () => stop(signal));
  const limit = concurrency(args);
  const live = limit === 1;
  const env = stepEnv(limit);
  const github = Boolean(process.env.GITHUB_ACTIONS);
  // In CI, a step that hangs would print nothing until the timeout: say what runs.
  const heartbeat =
    !live && process.env.CI
      ? setInterval(() => {
          const labels = [...running].map((child) => child.verifyLabel);
          if (labels.length) console.log(`· still running: ${labels.join(", ")}`);
        }, 60_000)
      : null;
  const results = new Map();
  // Each step's end, for the steps `after` it (resolved at once for a skipped one).
  const settle = new Map();
  const done = new Map(STEPS.map((step) => [step.label, new Promise((resolve) => settle.set(step.label, resolve))]));
  for (const step of STEPS) if (!steps.includes(step)) settle.get(step.label)();
  for (const stage of stages(steps)) {
    if (stoppedBy) break;
    await pool(stage, limit, async (step) => {
      // Started last in its stage, so what it waits for has usually ended.
      if (step.after) await done.get(step.after);
      if (stoppedBy) return;
      const header = `\n▶ ${step.label} (${commandOf(step).join(" ")})`;
      if (live) console.log(header);
      else console.log(`· ${step.label} started`);
      const result = await run(step, live, env);
      if (!live) {
        // GitHub folds each step's output under its line.
        console.log(github ? `::group::${header.trim()}` : header);
        process.stdout.write(result.output);
        if (github) console.log("::endgroup::");
      }
      results.set(step, result);
      settle.get(step.label)();
    });
  }

  if (heartbeat) clearInterval(heartbeat);
  if (stoppedBy) {
    console.error(`\nverify stopped by ${stoppedBy}.`);
    return SIGNAL_EXIT[stoppedBy];
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
