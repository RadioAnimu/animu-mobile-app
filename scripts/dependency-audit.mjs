import { spawnSync } from "node:child_process";

// Unpatched build-tool advisories reviewed against the actual resolved paths.
// Do not broaden these to package-wide exclusions: a path pnpm newly reports
// fails. (pnpm reports one representative path per version, not every
// dependent: review the package's other dependents too when adding an entry.)
// `patched` (default: no fix at all) is for a fix only in a major the dependent cannot take.
// One reviewed version takes `version` + `paths`; several take `versions` (version → paths).
const exceptions = {
  "GHSA-mrhx-c7xc-m3w5": {
    name: "zod", version: "3.25.76", patched: ">=4.6.6",
    paths: [".>expo>@expo/cli>zod"],
    reason: "Expo CLI dev-server devtools plugin schemas; absent from the mobile bundle; fixed only in zod 4",
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
  "GHSA-g3hv-75wg-m249": {
    name: "minimatch", patched: ">=11.0.1",
    versions: {
      "10.2.6": [".>eslint>minimatch"],
      "3.1.5": [".>eslint-config-expo>eslint-plugin-import>minimatch"],
    },
    reason: "The flaw runs only at optimizationLevel >= 2: 3.x predates it, ESLint uses level 1; 10.2.6 reaches it through glob 13 in Expo CLI/fingerprint, on repository-controlled patterns; fixed only in 11, which ESLint 10 and glob 13 cannot take",
  },
  "GHSA-3g3m-2fjr-6pw4": {
    name: "glob", version: "13.0.6", patched: ">=14.0.2",
    paths: [".>expo>@expo/cli>glob"],
    reason: "Expo CLI dev-time project search: an aborted first-match search may keep walking the project tree locally; absent from the mobile bundle; fixed only in glob 14 (@expo/cli pins ^13)",
  },
};

/** The paths reviewed for one vulnerable version of a policy's package. */
const reviewedPaths = (policy, version) =>
  (policy.versions && Object.hasOwn(policy.versions, version) ? policy.versions[version] : undefined) ??
  (version === policy.version ? policy.paths : undefined) ??
  [];

export function assessPnpm(report) {
  if (!report?.metadata?.vulnerabilities || !report.advisories || report.error) throw new Error("Incomplete pnpm audit report");
  const findings = Object.values(report.advisories).map(advisory => {
    const id = advisory.github_advisory_id;
    const policy = exceptions[id];
    const accepted = policy?.name === advisory.module_name && advisory.patched_versions === (policy.patched ?? "<0.0.0") &&
      advisory.findings?.length > 0 && advisory.findings.every(finding =>
        finding.paths?.length > 0 && finding.paths.every(p => reviewedPaths(policy, finding.version).includes(p)));
    return { name: advisory.module_name, severity: advisory.severity, id, accepted, reason: accepted ? policy.reason : undefined };
  });
  // Fail closed if the registry reports vulnerabilities it did not describe
  // (it counts one per vulnerable version, so an advisory can count twice).
  const total = Object.values(report.metadata.vulnerabilities).reduce((a, b) => a + b, 0);
  const described = Object.values(report.advisories).reduce((n, advisory) => n + (advisory.findings?.length ?? 0), 0);
  if (total !== described) throw new Error("Incomplete vulnerability details");
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
