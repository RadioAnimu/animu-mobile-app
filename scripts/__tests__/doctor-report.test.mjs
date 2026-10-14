import { test } from "node:test";
import assert from "node:assert/strict";
import { validateDoctorReport } from "../doctor-report.mjs";
const valid = () => ({ schemaVersion: 3, ok: true, reactDetected: true, summary: { totalDiagnosticCount: 0, errorCount: 0, warningCount: 0 }, projects: [{ directory: process.cwd(), complete: true, analyzedFileCount: 10, scannedFileCount: 10, skippedChecks: [], diagnostics: [] }] });
test("accepts a complete finding-free scan", () => assert.deepEqual(validateDoctorReport(valid(), process.cwd()), []));
for (const [name, edit] of Object.entries({
  "unsupported schema": r => { r.schemaVersion = 2; },
  "missing project": r => { r.projects = []; },
  "incomplete scan": r => { r.projects[0].complete = false; },
  "skipped checks": r => { r.projects[0].skippedChecks = ["lint"]; },
  "empty scope": r => { r.projects[0].analyzedFileCount = 0; },
  "count disagreement": r => { r.projects[0].diagnostics = [{ severity: "error" }]; },
  "severity disagreement": r => { r.summary.warningCount = 1; },
  "duplicate findings": r => { r.projects[0].diagnostics = [{ id: "same", severity: "error" }, { id: "same", severity: "error" }]; r.summary.totalDiagnosticCount = 2; r.summary.errorCount = 2; },
})) test(`rejects ${name}`, () => { const report = valid(); edit(report); assert.throws(() => validateDoctorReport(report, process.cwd())); });
