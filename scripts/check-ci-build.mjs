#!/usr/bin/env node
/**
 * Prints "true" if the given Jenkins CI job has a SUCCESSFUL build for the
 * given commit SHA, else "false". Used by the release pipeline to trust an
 * already-green CI build instead of re-running the checks.
 *
 * usage: JENKINS_URL=... JENKINS_USER=... JENKINS_API_TOKEN=... \
 *          node scripts/check-ci-build.mjs <jobPath> <sha>
 *
 * <jobPath> is the job's full path: a bare name ("animu-mobile-app") or nested
 * folders ("Animu/animu-mobile-app"); each segment becomes a /job/<segment>.
 *
 * On any error it prints "false" so the caller falls back to running the checks.
 */
const [, , jobPath, sha] = process.argv;
const { JENKINS_URL, JENKINS_USER, JENKINS_API_TOKEN } = process.env;

const fail = (msg) => {
  if (msg) console.error(`[ci-check] ${msg}`);
  console.log("false");
  process.exit(0);
};

if (!jobPath || !sha) fail("missing <jobPath> or <sha>");
if (!JENKINS_URL || !JENKINS_USER || !JENKINS_API_TOKEN) fail("missing Jenkins env");

const base = JENKINS_URL.replace(/\/+$/, "");
// "Animu/animu-mobile-app" -> "/job/Animu/job/animu-mobile-app"
const jobUrl = jobPath
  .split("/")
  .filter(Boolean)
  .map((segment) => `/job/${encodeURIComponent(segment)}`)
  .join("");
const url =
  `${base}${jobUrl}/api/json` +
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
