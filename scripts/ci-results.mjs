import { Buffer } from 'node:buffer';
// Portable outputs bound to an exact commit and a successful trusted CI run.
// No package dependencies: coverage can be restored before an install.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { downloadResults } from './ci-results-download.mjs';

export const projects = {
  'RadioAnimu/animu-mobile-app': { job: 'Animu/animu-mobile-app' },
  'RadioAnimu/animu-api': { job: 'Animu/animu-api', output: 'dist', entries: ['esm/index.js', 'esm/index.d.ts', 'cjs/index.cjs'] },
  'rmotafreitas/react-native-anything-player': { job: 'Animu/react-native-anything-player', output: 'lib', entries: ['module/index.js', 'typescript/src/index.d.ts'] },
};
export const digest = data => createHash('sha256').update(data).digest('hex');
export const revision = cwd => execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
export function clean(cwd) {
  return execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd, encoding: 'utf8' }).trim() === '';
}
function safePath(file) {
  return typeof file === 'string' && file.length > 0 && !file.includes('\\') && !path.isAbsolute(file) && !file.split('/').some(p => ['..', '.', ''].includes(p));
}
export function normalizeCoverage(lcov, cwd) {
  return lcov.split('\n').map(line => {
    if (!line.startsWith('SF:')) return line;
    const file = line.slice(3);
    const relative = path.isAbsolute(file) ? path.relative(cwd, file) : file;
    if (!safePath(relative)) throw new Error('Coverage source is outside the checkout');
    return `SF:${relative}`;
  }).join('\n');
}
function collect(dir, prefix = '') {
  return fs.readdirSync(path.join(dir, prefix), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    const name = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) return collect(dir, name);
    if (!entry.isFile()) throw new Error('Links are forbidden in CI output');
    const bytes = fs.readFileSync(path.join(dir, name));
    return [{ path: name, data: bytes.toString('base64'), sha256: digest(bytes) }];
  });
}
export function validateResults(data, repository, sha) {
  const project = projects[repository];
  if (!project || data?.schema !== 1 || data.repository !== repository || data.sha !== sha || !/^[a-f0-9]{40}$/.test(sha)) throw new Error('CI identity mismatch');
  if (typeof data.lcov !== 'string' || !data.lcov.includes('SF:') || digest(data.lcov) !== data.coverageSha256) throw new Error('Invalid coverage');
  normalizeCoverage(data.lcov, '/not-a-checkout');
  if (!Array.isArray(data.files)) throw new Error('Missing output inventory');
  const seen = new Set();
  for (const file of data.files) {
    if (!safePath(file.path) || seen.has(file.path) || typeof file.data !== 'string' || digest(Buffer.from(file.data, 'base64')) !== file.sha256) throw new Error('Invalid compiled output');
    seen.add(file.path);
  }
  for (const entry of project.entries ?? []) if (!seen.has(entry)) throw new Error('Incomplete compiled output');
  return data;
}
export function publish(repository, cwd = process.cwd()) {
  const project = projects[repository];
  if (!project) throw new Error('Unknown CI project');
  const lcov = normalizeCoverage(fs.readFileSync(path.join(cwd, 'coverage/lcov.info'), 'utf8'), cwd);
  const data = { schema: 1, repository, sha: revision(cwd), node: process.versions.node, lcov, coverageSha256: digest(lcov), files: project.output ? collect(path.join(cwd, project.output)) : [] };
  validateResults(data, repository, data.sha);
  fs.writeFileSync(path.join(cwd, 'ci-results.json'), JSON.stringify(data));
}
export async function restore(repository, cwd = process.cwd(), kind = 'coverage') {
  if (!projects[repository] || process.env.CI_REUSE_RESULTS === '0' || !clean(cwd)) return false;
  const sha = revision(cwd);
  try {
    const data = validateResults(await downloadResults(repository, projects[repository].job, sha), repository, sha);
    if (kind === 'coverage') {
      fs.mkdirSync(path.join(cwd, 'coverage'), { recursive: true });
      fs.writeFileSync(path.join(cwd, 'coverage/lcov.info'), data.lcov);
    } else {
      const output = path.join(cwd, projects[repository].output);
      fs.rmSync(output, { recursive: true, force: true });
      for (const file of data.files) {
        const target = path.join(output, file.path);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, Buffer.from(file.data, 'base64'));
      }
    }
    console.log(`[ci-results] Reused ${kind} from successful CI for ${repository}@${sha}`);
    return true;
  } catch {
    // Errors can contain credentials, signed URLs or server response bodies.
    console.log(`[ci-results] No verified ${kind} for ${repository}@${sha}; running locally`);
    return false;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , command, repository] = process.argv;
  if (command === 'publish') publish(repository);
  else if (command === 'restore') process.exitCode = await restore(repository) ? 0 : 1;
  else throw new Error('Usage: ci-results.mjs publish|restore owner/repository');
}
