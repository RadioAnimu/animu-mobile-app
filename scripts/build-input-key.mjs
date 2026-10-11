// Workspace installation/prebuild keys include the files that can affect their
// outputs. The lockfile alone misses patches, workspace manifests and toolchains.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
export function inputKey(mode, cwd = process.cwd(), runtime = `${process.platform}/${process.arch}/${process.version}/${process.versions.modules}`) {
  if (!['dependencies', 'native'].includes(mode)) throw new Error('Unknown cache key');
  const hash = createHash('sha256').update(`v1/${mode}/${runtime}`);
  function visit(relative) {
    const file = path.join(cwd, relative);
    if (!fs.existsSync(file)) { hash.update(`missing:${relative}\0`); return; }
    const stat = fs.lstatSync(file);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(file).sort()) visit(path.join(relative, name));
    } else if (stat.isFile()) hash.update(relative).update('\0').update(fs.readFileSync(file)).update('\0');
    else throw new Error('Unexpected linked build input');
  }
  for (const file of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', '.npmrc', '.nvmrc', 'patches', 'packages/animu-api/package.json', 'packages/react-native-anything-player/package.json']) visit(file);
  if (mode === 'native') for (const file of ['app.json', 'app.config.js', 'app.config.ts', 'plugins', 'assets', 'packages/react-native-anything-player/app.plugin.js']) visit(file);
  return hash.digest('hex');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(inputKey(process.argv[2]));
