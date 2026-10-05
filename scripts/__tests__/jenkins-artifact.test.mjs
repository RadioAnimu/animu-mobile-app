import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import * as tar from "tar";
import { fetchArtifact } from "../jenkins-artifact.mjs";

test("only accepts successful exact-commit artifacts and refuses symlinks or incomplete output", async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "artifact-test-"));
  const before = { ...process.env };
  const sha = "a".repeat(40);
  let result = "SUCCESS", revision = sha;
  const archive = path.join(temporary, "artifact.tgz");
  const output = path.join(temporary, "output");
  const server = http.createServer((req, res) => {
    if (req.url.includes("api/json")) res.end(JSON.stringify({ builds: [{ number: 1, result, actions: [{ lastBuiltRevision: { SHA1: revision } }] }] }));
    else res.end(fs.readFileSync(archive));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const lib = { job: "Animu/library", artifact: "library.tgz", prefix: "dist/", entry: "index.js", types: "index.d.ts" };
  try {
    process.env.JENKINS_URL = `http://127.0.0.1:${server.address().port}`;
    process.env.JENKINS_USER = "test"; process.env.JENKINS_API_TOKEN = "test";
    fs.mkdirSync(path.join(temporary, "dist"));
    fs.writeFileSync(path.join(temporary, "dist/index.js"), "export const answer = 42;");
    fs.writeFileSync(path.join(temporary, "dist/index.d.ts"), "export declare const answer: number;");
    const pack = () => tar.c({ gzip: true, file: archive, cwd: temporary }, ["dist"]);
    await pack();
    assert.equal(await fetchArtifact(lib, sha, output), true);
    assert.match(fs.readFileSync(path.join(output, "index.js"), "utf8"), /42/);
    result = "FAILURE"; assert.equal(await fetchArtifact(lib, sha, output), false);
    result = "SUCCESS"; revision = "b".repeat(40); assert.equal(await fetchArtifact(lib, sha, output), false);
    revision = sha;
    fs.symlinkSync("/tmp/outside", path.join(temporary, "dist/link")); await pack();
    assert.equal(await fetchArtifact(lib, sha, output), false);
    fs.unlinkSync(path.join(temporary, "dist/link")); fs.unlinkSync(path.join(temporary, "dist/index.d.ts")); await pack();
    assert.equal(await fetchArtifact(lib, sha, output), false);
    assert.ok(fs.existsSync(path.join(output, "index.d.ts")), "invalid archive preserves existing output");
  } finally {
    process.env = before;
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
