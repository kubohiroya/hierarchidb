#!/usr/bin/env node
/*
  peerify.mjs
  - 目的: 指定パッケージを dependencies/devDependencies から peerDependencies へ移動し、
          ローカル開発用に devDependencies にも同じバージョンを保持 (--dev)
  - 使い方:
    node scripts/peerify.mjs \
      --peers react,react-dom,@mui/material,@mui/icon-material \
      --dev \
      --dry
*/
import { promises as fs } from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? true] : [a, true];
}));

const cwd = process.cwd();
const dryRun = Boolean(args['dry']);
const alsoDev = Boolean(args['dev']);
const peers = String(args['peers'] || '').split(',').map(s => s.trim()).filter(Boolean);
if (peers.length === 0) {
  console.error('Error: --peers <comma-separated list> is required.');
  process.exit(2);
}

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.turbo', '.next', 'out']);

async function findPackageJsons(dir, acc) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) {
      if (IGNORE_DIRS.has(e.name)) continue;
      await findPackageJsons(path.join(dir, e.name), acc);
    } else if (e.isFile() && e.name === 'package.json') {
      acc.push(path.join(dir, e.name));
    }
  }
}

function ensure(obj, key) {
  if (!obj[key]) obj[key] = {};
  return obj[key];
}

async function main() {
  const files = [];
  await findPackageJsons(cwd, files);
  if (files.length === 0) {
    console.log('No package.json found.');
    return;
  }
  console.log(`Found ${files.length} package.json file(s).`);

  for (const file of files) {
    const json = JSON.parse(await fs.readFile(file, 'utf8'));
    const deps = json.dependencies || {};
    const devDeps = json.devDependencies || {};
    const peerDeps = ensure(json, 'peerDependencies');

    let changed = false;
    for (const name of peers) {
      let ver = undefined;
      if (deps[name]) { ver = deps[name]; delete deps[name]; changed = true; }
      if (!ver && devDeps[name]) { ver = devDeps[name]; }
      if (!ver && peerDeps[name]) { ver = peerDeps[name]; }
      if (!ver) continue; // 対象外

      if (peerDeps[name] !== ver) { peerDeps[name] = ver; changed = true; }
      if (alsoDev && devDeps[name] !== ver) { devDeps[name] = ver; changed = true; }
    }

    if (changed) {
      json.dependencies = deps;
      json.devDependencies = devDeps;
      json.peerDependencies = peerDeps;
      console.log(`Update: ${path.relative(cwd, file)}`);
      if (!dryRun) {
        await fs.writeFile(file, JSON.stringify(json, null, 2) + '\n', 'utf8');
      }
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
