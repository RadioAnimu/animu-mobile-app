import path from "node:path";
export function validateDoctorReport(report, directory) {
  if (report.schemaVersion !== 3 || report.ok !== true || report.reactDetected !== true || !report.summary) throw new Error("Unsupported or unsuccessful React Doctor scan");
  const projects = report.projects;
  if (!Array.isArray(projects) || !projects.some(p => path.resolve(p.directory) === path.resolve(directory))) throw new Error("Expected project was not scanned");
  for (const project of projects) {
    if (project.complete !== true || project.analyzedFileCount < 1 || project.scannedFileCount < 1 || !Array.isArray(project.skippedChecks) || project.skippedChecks.length) throw new Error("Incomplete React Doctor scan");
  }
  const diagnostics = projects.flatMap(p => p.diagnostics ?? []);
  if (!Number.isFinite(report.summary.totalDiagnosticCount) || report.summary.totalDiagnosticCount !== diagnostics.length) throw new Error("Inconsistent diagnostic count");
  return diagnostics;
}
