import { Buffer } from 'node:buffer';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { digest, normalizeCoverage, validateResults } from '../ci-results.mjs';
import { successfulBuild, successfulRun } from '../ci-results-download.mjs';
const repository = 'RadioAnimu/animu-api';
const sha = 'a'.repeat(40);
const lcov = 'TN:\nSF:src/index.ts\nDA:1,1\nend_of_record\n';
function fixture() {
  return { schema: 1, repository, sha, lcov, coverageSha256: digest(lcov), files: ['esm/index.js', 'esm/index.d.ts', 'cjs/index.cjs'].map(path => ({ path, data: Buffer.from('test').toString('base64'), sha256: digest('test') })) };
}
test('results bind coverage and compiled bytes to the exact repository and commit', () => {
  assert.equal(validateResults(fixture(), repository, sha).sha, sha);
  assert.throws(() => validateResults(fixture(), repository, 'b'.repeat(40)));
  assert.throws(() => validateResults(fixture(), 'RadioAnimu/animu-mobile-app', sha));
  const corrupt = fixture(); corrupt.files[0].data = 'Y29ycnVwdA==';
  assert.throws(() => validateResults(corrupt, repository, sha));
  const coverage = fixture(); coverage.lcov += 'DA:2,1\n';
  assert.throws(() => validateResults(coverage, repository, sha));
});
test('unsafe, duplicate, or missing output paths cannot be restored', () => {
  for (const unsafe of ['../outside', '/tmp/outside', 'a/../../outside', 'a\\outside']) {
    const data = fixture(); data.files[0].path = unsafe;
    assert.throws(() => validateResults(data, repository, sha));
  }
  const duplicate = fixture(); duplicate.files.push(duplicate.files[0]);
  assert.throws(() => validateResults(duplicate, repository, sha));
  const incomplete = fixture(); incomplete.files.pop();
  assert.throws(() => validateResults(incomplete, repository, sha));
});
test('coverage relocates between Jenkins and GitHub, rejecting external sources', () => {
  assert.equal(normalizeCoverage(lcov.replace('src/index.ts', '/workspace/src/index.ts'), '/workspace'), lcov);
  assert.throws(() => normalizeCoverage('SF:/outside/source.ts', '/workspace'));
});
test('only successful completed Jenkins builds and upstream main push workflows qualify', () => {
  const build = { number: 1, result: 'SUCCESS', building: false, actions: [{ lastBuiltRevision: { SHA1: sha } }] };
  assert.equal(successfulBuild(build, sha), true);
  for (const change of [{ result: 'FAILURE' }, { building: true }, { actions: [] }]) assert.ok(!successfulBuild({ ...build, ...change }, sha));
  const run = { id: 1, conclusion: 'success', status: 'completed', event: 'push', head_branch: 'main', head_sha: sha, head_repository: { full_name: repository } };
  assert.equal(successfulRun(run, repository, sha), true);
  for (const change of [{ event: 'pull_request' }, { status: 'in_progress' }, { head_branch: 'feature' }, { head_sha: 'b'.repeat(40) }, { head_repository: { full_name: 'fork/animu-api' } }]) assert.equal(successfulRun({ ...run, ...change }, repository, sha), false);
});

test('Jenkins restore falls back on failed builds, corruption, and dirty source', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const http = await import('node:http');
  const { execFileSync } = await import('node:child_process');
  const { restore } = await import('../ci-results.mjs');
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-restore-test-'));
  const env = { ...process.env };
  const git = (...args) => execFileSync('git', args, { cwd, stdio: 'pipe' }).toString().trim();
  git('init');
  fs.writeFileSync(path.join(cwd, '.gitignore'), 'dist/\ncoverage/\n');
  fs.writeFileSync(path.join(cwd, 'source.ts'), 'original');
  git('add', '.'); git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-m', 'fixture');
  const commit = git('rev-parse', 'HEAD');
  let result = 'SUCCESS';
  const data = { ...fixture(), sha: commit };
  const server = http.createServer((req, res) => {
    res.end(JSON.stringify(req.url.includes('api/json') ? { builds: [{ number: 1, result, building: false, actions: [{ lastBuiltRevision: { SHA1: commit } }] }] } : data));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    process.env.JENKINS_URL = `http://127.0.0.1:${server.address().port}`;
    process.env.JENKINS_USER = 'test'; process.env.JENKINS_API_TOKEN = 'test';
    delete process.env.GH_TOKEN; delete process.env.GITHUB_TOKEN; delete process.env.CI_REUSE_RESULTS;
    assert.equal(await restore(repository, cwd, 'build'), true);
    assert.equal(fs.readFileSync(path.join(cwd, 'dist/esm/index.js'), 'utf8'), 'test');
    result = 'FAILURE'; assert.equal(await restore(repository, cwd), false);
    result = 'SUCCESS'; data.coverageSha256 = 'corrupt'; assert.equal(await restore(repository, cwd), false);
    assert.ok(!fs.existsSync(path.join(cwd, 'coverage/lcov.info')));
    data.coverageSha256 = digest(lcov); fs.writeFileSync(path.join(cwd, 'source.ts'), 'edited');
    assert.equal(await restore(repository, cwd, 'build'), false);
    assert.equal(fs.readFileSync(path.join(cwd, 'source.ts'), 'utf8'), 'edited');
  } finally {
    process.env = env;
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
