#!/usr/bin/env node
/**
 * Fails when the React Doctor health score is below the floor. Shared by the
 * GitHub Actions CI, the Jenkins CI and the release pipeline so the gate cannot
 * drift between them. Uses the lockfile-pinned devDependency (no @latest).
 *
 * usage: node scripts/react-doctor-gate.mjs [minScore=85]
 */
import { spawnSync } from "node:child_process";

const MIN_SCORE = Number(process.argv[2] ?? 85);

const run = spawnSync("pnpm", ["exec", "react-doctor", "--score"], {
  encoding: "utf8",
});
const score = Number(
  (run.stdout ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\d+$/.test(line))
    .pop(),
);

if (!Number.isFinite(score)) {
  console.error("Could not parse a React Doctor score");
  console.error(run.stdout, run.stderr);
  process.exit(1);
}

console.log(`React Doctor score: ${score} (minimum ${MIN_SCORE})`);
if (score < MIN_SCORE) {
  console.error(`React Doctor score ${score} is below the required minimum of ${MIN_SCORE}`);
  process.exit(1);
}
