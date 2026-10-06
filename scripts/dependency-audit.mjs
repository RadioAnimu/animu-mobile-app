import { spawnSync } from "node:child_process";

// Unpatched build-tool advisories reviewed against the actual resolved paths.
// Do not broaden these to package-wide exclusions: an added runtime path must fail.
const exceptions = {
  "GHSA-86w9-cpqp-85rv": {
    name: "node-forge", version: "1.4.0",
    paths: [".>expo>@expo/cli>node-forge"],
    reason: "Expo CLI certificate tooling; absent from the mobile bundle; no published fix",
  },
  "GHSA-vfj7-8cjw-p6xm": {
    name: "braces", version: "3.0.3",
    paths: [
      ".>expo>@expo/cli>@expo/metro-file-map>micromatch>braces",
      ".>expo>@expo/metro>metro-file-map>micromatch>braces",
    ],
    dependents: ["micromatch@npm:4.0.8"],
    reason: "Build-tool matching of repository-controlled globs; no published fix",
  },
};

export function assessPnpm(report) {
  if (!report?.metadata?.vulnerabilities || !report.advisories || report.error) throw new Error("Incomplete pnpm audit report");
  const findings = Object.values(report.advisories).map(advisory => {
    const id = advisory.github_advisory_id;
    const policy = exceptions[id];
    const accepted = policy?.name === advisory.module_name && advisory.patched_versions === "<0.0.0" &&
      advisory.findings?.length > 0 && advisory.findings.every(finding =>
        finding.version === policy.version && finding.paths?.length > 0 && finding.paths.every(p => policy.paths.includes(p)));
    return { name: advisory.module_name, severity: advisory.severity, id, accepted, reason: accepted ? policy.reason : undefined };
  });
  // Fail closed if the registry reports vulnerabilities it did not describe.
  const total = Object.values(report.metadata.vulnerabilities).reduce((a, b) => a + b, 0);
  if (total !== findings.length) throw new Error("Incomplete vulnerability details");
  return findings;
}

export function assessYarn(output) {
  return output.trim().split("\n").filter(Boolean).map(line => {
    const { value: name, children: advisory } = JSON.parse(line);
    if (!advisory?.Severity || !advisory.Issue) throw new Error("Incomplete Yarn audit report");
    const id = advisory.URL?.split("/").at(-1);
    const policy = exceptions[id];
    const accepted = policy?.name === name && advisory["Tree Versions"]?.length > 0 &&
      advisory["Tree Versions"].every(version => version === policy.version) && advisory.Dependents?.length > 0 &&
      advisory.Dependents.every(parent => policy.dependents?.includes(parent));
    return { name, severity: advisory.Severity, id: id ?? String(advisory.ID), accepted, reason: accepted ? policy.reason : undefined };
  });
}

export function blocking(findings) {
  return findings.some(f => ["high", "critical"].includes(f.severity) && !f.accepted);
}

export function auditDependencies(cwd, manager = "pnpm") {
  const args = manager === "yarn" ? ["yarn", "npm", "audit", "--all", "--recursive", "--json"] : ["pnpm", "audit", "--json"];
  const result = spawnSync("corepack", args, { cwd, encoding: "utf8", timeout: 120_000, maxBuffer: 16 * 1024 * 1024 });
  if (result.error || result.signal || ![0, 1].includes(result.status)) throw new Error("Dependency audit could not complete");
  const findings = manager === "yarn" ? assessYarn(result.stdout) : assessPnpm(JSON.parse(result.stdout));
  if (result.status !== 0 && findings.length === 0) throw new Error("Dependency audit failed without findings");
  console.log(`Dependency audit (${manager}): ${findings.length} finding(s)`);
  for (const f of findings) console.log(`${f.severity}: ${f.name} ${f.id}${f.accepted ? ` — reviewed build-tool risk: ${f.reason}` : ""}`);
  if (blocking(findings)) throw new Error("Unreviewed high/critical dependency vulnerability");
  return findings;
}
