#!/usr/bin/env node
/**
 * Downloads the animu-api `dist/` artifact built by its Jenkins CI job for a
 * specific commit and extracts it, so the mobile build can consume the exact
 * prebuilt library instead of compiling it from source.
 *
 * Exits 0 on success. Exits 1 (without throwing) when there is no successful
 * animu-api build for that commit, so the caller can fall back to building from
 * source.
 *
 * usage: node scripts/fetch-animu-api-dist.mjs <jobName> <sha> <distDir>
 * env:   JENKINS_URL (or BUILD_URL), JENKINS_USER, JENKINS_API_TOKEN
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const [, , jobName, sha, distDir] = process.argv;
const { JENKINS_URL, BUILD_URL, JENKINS_USER, JENKINS_API_TOKEN } = process.env;

const log = (m) => console.error(`[animu-api] ${m}`);

if (!jobName || !sha || !distDir) {
  log("usage: <jobName> <sha> <distDir>");
  process.exit(1);
}
if (!JENKINS_USER || !JENKINS_API_TOKEN) {
  log("missing JENKINS_USER / JENKINS_API_TOKEN");
  process.exit(1);
}

const rawBase = JENKINS_URL || BUILD_URL || "";
const base = rawBase.replace(/\/job\/.*$/, "").replace(/\/+$/, "");
if (!base) {
  log(`could not derive a Jenkins base URL from "${rawBase}"`);
  process.exit(1);
}

const auth = "Basic " + Buffer.from(`${JENKINS_USER}:${JENKINS_API_TOKEN}`).toString("base64");
// "Animu/animu-api" -> "/job/Animu/job/animu-api"
const jobUrl = jobName
  .split("/")
  .filter(Boolean)
  .map((segment) => `/job/${encodeURIComponent(segment)}`)
  .join("");
const ARTIFACT = "animu-api-dist.tar.gz";

const getJson = async (url) => {
  const res = await fetch(url, { headers: { Authorization: auth } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
};

try {
  const data = await getJson(
    `${base}${jobUrl}/api/json?tree=builds[number,result,actions[lastBuiltRevision[SHA1]]]`
  );
  const build = (data.builds ?? []).find((b) => {
    const rev = (b.actions ?? []).find((a) => a?.lastBuiltRevision?.SHA1)?.lastBuiltRevision?.SHA1;
    return rev === sha && b.result === "SUCCESS";
  });
  if (!build) {
    log(`no successful ${jobName} build for ${sha}`);
    process.exit(1);
  }

  const url = `${base}${jobUrl}/${build.number}/artifact/${ARTIFACT}`;
  const res = await fetch(url, { headers: { Authorization: auth } });
  if (!res.ok) throw new Error(`artifact HTTP ${res.status}`);

  const tmp = path.join(path.dirname(distDir), `.animu-api-dist.${process.pid}.tar.gz`);
  fs.writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));

  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(distDir), { recursive: true });
  execFileSync("tar", ["-xzf", tmp, "-C", path.dirname(distDir)], { stdio: "inherit" });
  fs.rmSync(tmp, { force: true });

  if (!fs.existsSync(path.join(distDir, "esm", "index.js"))) {
    log("extracted archive is missing esm/index.js");
    process.exit(1);
  }

  log(`using ${jobName} build #${build.number} dist for ${sha}`);
  process.exit(0);
} catch (e) {
  log(e.message);
  process.exit(1);
}
