#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { libraries, root, revision, clean, isolated } from "./submodules.mjs";
import { fetchArtifact } from "./jenkins-artifact.mjs";

function digest(dir) {
  const hash = createHash("sha256");
  function visit(base) {
    for (const entry of fs.readdirSync(base, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(base, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile()) hash.update(path.relative(dir, file)).update(fs.readFileSync(file));
      else throw new Error("Unexpected link in compiled output");
    }
  }
  visit(dir);
  return hash.digest("hex");
}

for (const name of process.argv.length > 2 ? process.argv.slice(2) : Object.keys(libraries)) {
  const lib = libraries[name];
  if (!lib) throw new Error(`Unknown submodule: ${name}`);
  const dir = path.join(root, "packages", name);
  const output = path.join(dir, lib.output);
  const stamp = path.join(root, ".cache", `${name}-build.json`);
  const sha = revision(dir);
  const pristine = clean(dir);
  let previous;
  try { previous = JSON.parse(fs.readFileSync(stamp, "utf8")); } catch { /* first build */ }
  if (pristine && previous?.sha === sha && fs.existsSync(path.join(output, lib.entry)) && fs.existsSync(path.join(output, lib.types)) && previous.digest === digest(output)) {
    console.log(`[${name}] verified existing output for ${sha}`);
    continue;
  }
  const downloaded = pristine && await fetchArtifact(lib, sha, output);
  if (!downloaded) {
    console.log(`[${name}] building pinned source${pristine ? "" : " with local edits"}`);
    isolated(name, (temp, run) => {
      run(name === "animu-api" ? "build" : "prepare");
      fs.rmSync(output, { recursive: true, force: true });
      fs.cpSync(path.join(temp, lib.output), output, { recursive: true });
    });
  }
  if (!fs.existsSync(path.join(output, lib.entry)) || !fs.existsSync(path.join(output, lib.types))) throw new Error(`${name}: incomplete compiled output`);
  fs.mkdirSync(path.dirname(stamp), { recursive: true });
  fs.writeFileSync(stamp, JSON.stringify({ sha: pristine ? sha : null, digest: digest(output) }));
}
