#!/usr/bin/env node
/**
 * Runs what the Jenkins pipeline checks, in its order, and prints one summary:
 * every step runs even after a failure, so one pass shows all that is broken.
 *
 * usage: pnpm verify            (all steps)
 *        pnpm verify --fast     (skips the slow ones: secrets, submodules, bundle, doctor, network)
 */
import { spawnSync } from "node:child_process";

/** A pnpm script, or a raw command; `slow` steps are skipped by `--fast`. */
const STEPS = [
  { label: "tooling tests", script: "test:tooling" },
  { label: "python tooling tests", command: ["python3", "-m", "unittest", "discover", "-s", "scripts/__tests__", "-p", "*_test.py"] },
  { label: "typecheck", script: "typecheck" },
  { label: "expo deps", script: "check:expo-deps", slow: true },
  { label: "expo doctor", script: "check:expo-doctor", slow: true },
  { label: "secrets", script: "check:secrets", slow: true },
  { label: "dependency audit", script: "check:audit", slow: true },
  { label: "eslint", script: "lint:eslint" },
  { label: "oxlint", script: "lint:types" },
  { label: "knip + sherif", script: "lint:deps" },
  { label: "unit tests + coverage", script: "test:coverage" },
  { label: "animu-api", script: "check:animu-api", slow: true },
  { label: "player", script: "check:player", slow: true },
  { label: "bundle size", script: "check:bundle-size", slow: true },
  { label: "web export", command: ["node", "scripts/check-web-export.mjs"], slow: true },
  { label: "react doctor", script: "doctor:gate", slow: true },
];

const args = process.argv.slice(2);
if (args.some((arg) => arg !== "--fast")) {
  console.error("usage: pnpm verify [--fast]");
  process.exit(2);
}
const fast = args.includes("--fast");
const results = [];
for (const { label, script, command: raw, slow } of STEPS) {
  if (fast && slow) continue;
  const [command, ...commandArgs] = raw ?? ["pnpm", "run", "--silent", script];
  console.log(`\n▶ ${label} (${[command, ...commandArgs].join(" ")})`);
  const started = Date.now();
  const { status, error } = spawnSync(command, commandArgs, { stdio: "inherit" });
  // A command that could not start (e.g. no python3 on PATH) prints nothing itself.
  if (error) console.error(`  ${command}: ${error.message}`);
  results.push({ label, ok: status === 0, seconds: Math.round((Date.now() - started) / 1000) });
}

console.log("\nverify summary");
for (const { label, ok, seconds } of results) {
  console.log(`  ${ok ? "✓" : "✗"} ${label.padEnd(24)} ${String(seconds).padStart(4)} s`);
}
const failed = results.filter((result) => !result.ok);
console.log(failed.length ? `\n${failed.length} step(s) failed.` : "\nAll steps passed.");
process.exit(failed.length ? 1 : 0);
