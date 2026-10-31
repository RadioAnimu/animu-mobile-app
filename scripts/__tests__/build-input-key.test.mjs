import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inputKey } from '../build-input-key.mjs';
test('installation/native keys invalidate for patches and toolchains, and native keys for assets', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'input-key-'));
  try {
    const key = mode => inputKey(mode, cwd, 'node22/linux');
    const before = key('dependencies');
    assert.equal(before, key('dependencies'));
    assert.notEqual(before, inputKey('dependencies', cwd, 'node24/linux'));
    fs.mkdirSync(path.join(cwd, 'patches')); fs.writeFileSync(path.join(cwd, 'patches/test.patch'), 'one');
    const patched = key('dependencies'); assert.notEqual(before, patched);
    fs.writeFileSync(path.join(cwd, 'patches/test.patch'), 'two'); assert.notEqual(patched, key('dependencies'));
    const dependencies = key('dependencies'); const native = key('native');
    fs.mkdirSync(path.join(cwd, 'assets')); fs.writeFileSync(path.join(cwd, 'assets/icon.png'), 'changed');
    assert.equal(dependencies, key('dependencies')); assert.notEqual(native, key('native'));
    const withAssets = key('native');
    fs.mkdirSync(path.join(cwd, 'src/assets/fonts'), { recursive: true });
    fs.writeFileSync(path.join(cwd, 'src/assets/fonts/proximanova-reg.ttf'), 'font-bytes');
    assert.notEqual(withAssets, key('native')); assert.equal(dependencies, key('dependencies'));
    const withFonts = key('native');
    // The player's config plugin is app.plugin.js plus its plugin/ helpers.
    fs.mkdirSync(path.join(cwd, 'packages/react-native-anything-player/plugin'), { recursive: true });
    fs.writeFileSync(path.join(cwd, 'packages/react-native-anything-player/plugin/helpers.js'), 'mods');
    assert.notEqual(withFonts, key('native')); assert.equal(dependencies, key('dependencies'));
  } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
});
