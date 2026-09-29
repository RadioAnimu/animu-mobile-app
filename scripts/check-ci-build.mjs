#!/usr/bin/env node
/**
 * Prints "true" if the given Jenkins CI job has a SUCCESSFUL build for the
 * given commit SHA, else "false". Used by the release pipeline to trust an
 * already-green CI build instead of re-running the checks.
 *
 * usage: JENKINS_URL=... JENKINS_USER=... JENKINS_API_TOKEN=... \
 *          node scripts/check-ci-build.mjs <jobName> <sha>
 *
 * On any error it prints "false" so the caller falls back to running the checks.
 */
const [, , jobName, sha] = process.argv;
const { JENKINS_URL, JENKINS_USER, JENKINS_API_TOKEN } = process.env;

const fail = (msg) => {
  if (msg) console.error(`[ci-check] ${msg}`);
  console.log("false");
  process.exit(0);
};

if (!jobName || !sha) fail("missing <jobName> or <sha>");
if (!JENKINS_URL || !JENKINS_USER || !JENKINS_API_TOKEN) fail("missing Jenkins env");

const base = JENKINS_URL.replace(/\/+$/, "");
const url =
  `${base}/job/${encodeURIComponent(jobName)}/api/json` +
  `?tree=builds[number,result,actions[lastBuiltRevision[SHA1]]]`;

const auth = Buffer.from(`${JENKINS_USER}:${JENKINS_API_TOKEN}`).toString("base64");

let builds;
try {
  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  if (!res.ok) fail(`HTTP ${res.status}`);
  builds = (await res.json()).builds ?? [];
} catch (e) {
  fail(e.message);
}

const match = builds.find((b) => {
  const rev = (b.actions ?? []).find((a) => a?.lastBuiltRevision?.SHA1)?.lastBuiltRevision?.SHA1;
  return rev === sha && b.result === "SUCCESS";
});

console.log(match ? "true" : "false");
