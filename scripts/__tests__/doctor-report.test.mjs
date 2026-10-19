import { test } from "node:test";
import assert from "node:assert/strict";
import { validateDoctorReport } from "../doctor-report.mjs";
const valid = () => ({ schemaVersion: 3, ok: true, reactDetected: true, summary: { totalDiagnosticCount: 0 }, projects: [{ directory: process.cwd(), complete: true, analyzedFileCount: 10, scannedFileCount: 10, skippedChecks: [], diagnostics: [] }] });
test("accepts a complete finding-free scan", () => assert.deepEqual(validateDoctorReport(valid(), process.cwd()), []));
for (const [name, edit] of Object.entries({
  "unsupported schema": r => { r.schemaVersion = 2; },
  "missing project": r => { r.projects = []; },
  "incomplete scan": r => { r.projects[0].complete = false; },
  "skipped checks": r => { r.projects[0].skippedChecks = ["lint"]; },
  "empty scope": r => { r.projects[0].analyzedFileCount = 0; },
  "missing analyzed count": r => { delete r.projects[0].analyzedFileCount; },
  "missing scanned count": r => { delete r.projects[0].scannedFileCount; },
  "missing diagnostics": r => { delete r.projects[0].diagnostics; },
  "count disagreement": r => { r.projects[0].diagnostics = [{ severity: "error" }]; },
})) test(`rejects ${name}`, () => { const report = valid(); edit(report); assert.throws(() => validateDoctorReport(report, process.cwd())); });
test("the React Doctor workflow runs the lockfile's CLI version", async () => {
  const { readFileSync } = await import("node:fs");
  const workflow = readFileSync(new URL("../../.github/workflows/react-doctor.yml", import.meta.url), "utf8");
  const lock = readFileSync(new URL("../../pnpm-lock.yaml", import.meta.url), "utf8");
  assert.equal(workflow.match(/^\s+version: "([^"]+)"/m)?.[1], lock.match(/^ {2}react-doctor@([\d.]+):/m)?.[1]);
});
