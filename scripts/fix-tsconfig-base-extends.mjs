#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const BASE = path.join(ROOT, 'tsconfig.base.json');

function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } }
function writeJson(file, obj) { fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n'); }

function listPackages() {
  const out = [];
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        const pkg = path.join(p, 'package.json');
        if (fs.existsSync(pkg)) out.push(p);
        walk(p);
      }
    }
  }
  const pkgsRoot = path.join(ROOT, 'packages');
  if (fs.existsSync(pkgsRoot)) walk(pkgsRoot);
  const appPkg = path.join(ROOT, 'app', 'package.json');
  if (fs.existsSync(appPkg)) out.push(path.join(ROOT, 'app'));
  return out;
}

function main() {
  const pkgs = listPackages();
  let updated = 0;
  for (const dir of pkgs) {
    const f = path.join(dir, 'tsconfig.json');
    if (!fs.existsSync(f)) continue;
    const ts = readJson(f) || {};
    const ext = ts.extends || '';
    if (ext.includes('tsconfig.base.json')) continue;
    const rel = path.relative(dir, BASE).replace(/\\/g, '/');
    ts.extends = rel || '../../tsconfig.base.json';
    writeJson(f, ts);
    updated++;
    console.log(`extends set: ${path.basename(dir)} -> ${ts.extends}`);
  }
  console.log(`Updated ${updated} tsconfig.json files.`);
}

main();

