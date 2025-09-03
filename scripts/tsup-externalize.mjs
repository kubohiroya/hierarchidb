#!/usr/bin/env node
/*
  tsup-externalize.mjs
  - 目的: 各パッケージの package.json に tsup.external を追加/統合し、
          peerDependencies を外部化してバンドルに含めないようにする
  - 使い方:
    node scripts/tsup-externalize.mjs \
      --dry
  - 備考: tsup.config.* を使っている場合でも、package.json の "tsup" フィールドが優先される構成なら
          こちらを採用（なければ新規追加）。
*/
import { promises as fs } from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? true] : [a, true];
}));

const cwd = process.cwd();
const dryRun = Boolean(args['dry']);
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

function uniq(arr) { return Array.from(new Set(arr)); }

async function main() {
  const files = [];
  await findPackageJsons(cwd, files);
  if (files.length === 0) { console.log('No package.json found.'); return; }
  console.log(`Found ${files.length} package.json file(s).`);

  for (const file of files) {
    const json = JSON.parse(await fs.readFile(file, 'utf8'));
    const peers = Object.keys(json.peerDependencies || {});
    if (peers.length === 0) continue;

    const tsupCfg = json.tsup || {};
    const currentExt = Array.isArray(tsupCfg.external) ? tsupCfg.external : [];
    const nextExt = uniq([...currentExt, ...peers]).sort();

    let changed = false;
    if (JSON.stringify(nextExt) !== JSON.stringify(currentExt)) {
      tsupCfg.external = nextExt;
      json.tsup = tsupCfg;
      changed = true;
    }

    if (changed) {
      console.log(`Update: ${path.relative(cwd, file)} (tsup.external)`);
      if (!dryRun) {
        await fs.writeFile(file, JSON.stringify(json, null, 2) + '\n', 'utf8');
      }
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });

