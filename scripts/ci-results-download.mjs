import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';

const limit = 32 * 1024 * 1024;
async function request(url, headers = {}) {
  const response = await fetch(url, { headers, redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('CI request failed');
  return response;
}
async function bytes(response) {
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > limit) throw new Error('CI artifact too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function json(url, headers) { return JSON.parse(await bytes(await request(url, headers))); }
export function successfulBuild(build, sha) {
  return build.result === 'SUCCESS' && !build.building && Number.isSafeInteger(build.number) && build.actions?.some(a => a.lastBuiltRevision?.SHA1 === sha);
}
async function jenkins(job, sha) {
  const JENKINS_URL = process.env.JENKINS_URL;
  const JENKINS_USER = process.env.JENKINS_USER;
  const JENKINS_API_TOKEN = process.env.JENKINS_API_TOKEN;
  if (!JENKINS_URL || !JENKINS_USER || !JENKINS_API_TOKEN) return null;
  const url = new URL(JENKINS_URL);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid Jenkins URL');
  const base = `${url.href.replace(/\/$/, '')}/${job.split('/').map(s => `job/${encodeURIComponent(s)}`).join('/')}`;
  const headers = { Authorization: `Basic ${Buffer.from(`${JENKINS_USER}:${JENKINS_API_TOKEN}`).toString('base64')}` };
  const data = await json(`${base}/api/json?tree=builds[number,result,building,actions[lastBuiltRevision[SHA1]]]{0,30}`, headers);
  for (const build of data.builds ?? []) {
    if (!successfulBuild(build, sha)) continue;
    try { return await json(`${base}/${build.number}/artifact/ci-results.json`, headers); }
    catch { /* Older successful builds may predate portable results. */ }
  }
  return null;
}
export function successfulRun(run, repository, sha) {
  return run.conclusion === 'success' && run.status === 'completed' && run.event === 'push' && run.head_branch === 'main' && run.head_sha === sha && run.head_repository?.full_name === repository && Number.isSafeInteger(run.id);
}
async function github(repository, sha) {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) return null; // Artifact downloads require authentication.
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' };
  const base = `https://api.github.com/repos/${repository}`;
  const data = await json(`${base}/actions/workflows/ci.yml/runs?head_sha=${sha}&event=push&status=success&per_page=10`, headers);
  const run = data.workflow_runs?.find(r => successfulRun(r, repository, sha));
  if (!run) return null;
  const artifacts = await json(`${base}/actions/runs/${run.id}/artifacts`, headers);
  const artifact = artifacts.artifacts?.find(a => a.name === 'ci-results' && !a.expired && a.size_in_bytes <= limit && Number.isSafeInteger(a.id));
  if (!artifact) return null;
  // Follow the signed storage redirect WITHOUT forwarding the GitHub token.
  const response = await fetch(`${base}/actions/artifacts/${artifact.id}/zip`, { headers, redirect: 'manual', signal: AbortSignal.timeout(15000) });
  if (response.status !== 302) throw new Error('Missing artifact redirect');
  const location = new URL(response.headers.get('location'));
  if (location.protocol !== 'https:' || location.username || location.password) throw new Error('Invalid artifact redirect');
  // Decode a single bounded member in memory. Never write network bytes or ZIP
  // paths into the filesystem. Python's standard library is present on CI agents.
  const archive = await bytes(await request(location));
  const script = `import io, sys, zipfile
with zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())) as archive:
    with archive.open("ci-results.json") as entry:
        data = entry.read(32 * 1024 * 1024 + 1)
        if len(data) > 32 * 1024 * 1024:
            raise ValueError("CI artifact too large")
        sys.stdout.buffer.write(data)
`;
  return JSON.parse(execFileSync('python3', ['-c', script], { input: archive, maxBuffer: limit, timeout: 15000 }));
}
export async function downloadResults(repository, job, sha) {
  try { const data = await jenkins(job, sha); if (data) return data; }
  catch { /* Unavailable Jenkins falls back to GitHub, then local work. */ }
  return github(repository, sha);
}
