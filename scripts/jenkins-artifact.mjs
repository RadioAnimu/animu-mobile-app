import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as tar from "tar";

const limit = 64 * 1024 * 1024;
export async function fetchArtifact(lib, sha, output) {
  const { JENKINS_URL, JENKINS_USER, JENKINS_API_TOKEN } = process.env;
  if (!JENKINS_URL || !JENKINS_USER || !JENKINS_API_TOKEN) return false;
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "animu-artifact-"));
  try {
    const base = new URL(JENKINS_URL);
    if (!["https:", "http:"].includes(base.protocol) || base.username || base.password) throw new Error("Invalid Jenkins URL");
    const job = lib.job.split("/").map(s => `job/${encodeURIComponent(s)}`).join("/");
    const headers = { Authorization: `Basic ${Buffer.from(`${JENKINS_USER}:${JENKINS_API_TOKEN}`).toString("base64")}` };
    async function get(relative) {
      const response = await fetch(new URL(relative, base.href.replace(/\/?$/, "/")), { headers, redirect: "error", signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`Jenkins HTTP ${response.status}`);
      let size = 0;
      const chunks = [];
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > limit) throw new Error("Artifact exceeds size limit");
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    }
    const data = JSON.parse(await get(`${job}/api/json?tree=builds[number,result,actions[lastBuiltRevision[SHA1]]]`));
    const build = data.builds?.find(b => b.result === "SUCCESS" && b.actions?.some(a => a.lastBuiltRevision?.SHA1 === sha));
    if (!build || !Number.isSafeInteger(build.number)) return false;
    const archive = path.join(temporary, "artifact.tgz");
    fs.writeFileSync(archive, await get(`${job}/${build.number}/artifact/${lib.artifact}`));
    let invalid = false;
    let expanded = 0;
    // Validate all entries BEFORE extraction: reject links, traversal, devices,
    // and decompression bombs. Only compiled output is copied into the checkout.
    await tar.t({ file: archive, strict: true, onReadEntry(entry) {
      expanded += entry.size;
      if (expanded > limit || !["File", "Directory"].includes(entry.type) || path.isAbsolute(entry.path) || entry.path.includes("\\") || entry.path.split("/").includes("..")) invalid = true;
    } });
    if (invalid) throw new Error("Unsafe archive");
    const extracted = path.join(temporary, "extracted");
    fs.mkdirSync(extracted);
    await tar.x({ file: archive, cwd: extracted, strict: true, filter: p => p.startsWith(lib.prefix) });
    const compiled = path.join(extracted, lib.prefix);
    for (const entry of [lib.entry, lib.types]) if (!fs.existsSync(path.join(compiled, entry))) throw new Error("Incomplete artifact");
    fs.rmSync(output, { recursive: true, force: true });
    fs.cpSync(compiled, output, { recursive: true });
    console.log(`[${lib.job}] reused successful build #${build.number} for ${sha}`);
    return true;
  } catch {
    // Never print server response bodies, URLs, or errors containing credentials.
    console.warn(`[${lib.job}] artifact unavailable or invalid; building source`);
    return false;
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}
