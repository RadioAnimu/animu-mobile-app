#!/usr/bin/env node
/**
 * Fails when React Doctor reports any diagnostic. Shared by the GitHub Actions
 * CI, the Jenkins CI and the release pipeline so the gate cannot drift between
 * them. Uses the lockfile-pinned devDependency (no @latest), so new findings
 * only appear when the version is bumped deliberately.
 *
 * usage: node scripts/react-doctor-gate.mjs
 */
import { spawnSync } from "node:child_process";
import { validateDoctorReport } from "./doctor-report.mjs";

const run = spawnSync("pnpm", ["exec", "react-doctor", "--json", "--scope", "full", "--blocking", "none", "-y"], {
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});

let report;
try {
  report = JSON.parse(run.stdout ?? "");
} catch {
  console.error("Could not parse the React Doctor report");
  console.error(run.stdout, run.stderr);
  process.exit(1);
}

if (run.error || run.status !== 0) {
  console.error("React Doctor process failed");
  process.exit(1);
}
let diagnostics;
try { diagnostics = validateDoctorReport(report, process.cwd()); }
catch (error) { console.error(error.message); process.exit(1); }
const { summary } = report;

console.log(
  `React Doctor: score ${summary.score}, ${summary.errorCount} error(s), ${summary.warningCount} warning(s)`,
);
if (summary.totalDiagnosticCount > 0) {
  for (const d of diagnostics) {
    console.error(
      `${d.severity}  ${d.plugin ?? ""}/${d.rule}  ${d.filePath}:${d.line}  ${d.message ?? ""}`,
    );
  }
  console.error("React Doctor reported findings; fix them (the gate allows none).");
  process.exit(1);
}
