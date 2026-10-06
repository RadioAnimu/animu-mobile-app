import test from "node:test";
import assert from "node:assert/strict";
import { assessPnpm, assessYarn, blocking } from "../dependency-audit.mjs";

const braces = {
  module_name: "braces", github_advisory_id: "GHSA-vfj7-8cjw-p6xm", severity: "high", patched_versions: "<0.0.0",
  findings: [{ version: "3.0.3", paths: [".>expo>@expo/cli>@expo/metro-file-map>micromatch>braces"] }],
};
const report = advisory => ({ metadata: { vulnerabilities: { high: 1 } }, advisories: { 1: advisory } });

test("reviewed build-tool risk remains visible and does not allow an added runtime path", () => {
  const findings = assessPnpm(report(braces));
  assert.equal(findings.length, 1);
  assert.equal(blocking(findings), false);
  const changed = structuredClone(braces);
  changed.findings[0].paths.push(".>runtime-parser>braces");
  assert.equal(blocking(assessPnpm(report(changed))), true);
});

test("a published fix or an unknown high advisory fails the gate", () => {
  assert.equal(blocking(assessPnpm(report({ ...braces, patched_versions: ">=3.0.4" }))), true);
  assert.equal(blocking(assessPnpm(report({ ...braces, github_advisory_id: "GHSA-new-risk" }))), true);
});

test("an incomplete registry report cannot pass as an empty audit", () => {
  assert.throws(() => assessPnpm({}));
  assert.throws(() => assessPnpm({ metadata: { vulnerabilities: { high: 1 } }, advisories: {} }));
  assert.throws(() => assessYarn('{"type":"error"}'));
});

test("Yarn exceptions reject a changed version or dependent", () => {
  const entry = { value: "braces", children: { Severity: "high", Issue: "Deep glob recursion", URL: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm", "Tree Versions": ["3.0.3"], Dependents: ["micromatch@npm:4.0.8"] } };
  assert.equal(blocking(assessYarn(JSON.stringify(entry))), false);
  entry.children.Dependents.push("runtime-parser@npm:1.0.0");
  assert.equal(blocking(assessYarn(JSON.stringify(entry))), true);
  entry.children.Dependents = ["micromatch@npm:4.0.8"];
  entry.children["Tree Versions"] = ["3.0.2"];
  assert.equal(blocking(assessYarn(JSON.stringify(entry))), true);
});
