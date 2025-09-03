#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

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
  return out;
}

function hasTsx(dir) {
  const srcDir = path.join(dir, 'src');
  const stack = [srcDir];
  while (stack.length) {
    const d = stack.pop();
    if (!d || !fs.existsSync(d)) continue;
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) stack.push(p);
      else if (p.endsWith('.tsx')) return true;
    }
  }
  return false;
}

function main() {
  const pkgs = listPackages();
  let updated = 0;
  for (const dir of pkgs) {
    if (!hasTsx(dir)) continue;
    const f = path.join(dir, 'tsconfig.json');
    if (!fs.existsSync(f)) continue;
    const ts = readJson(f) || {};
    ts.compilerOptions ||= {};
    if (ts.compilerOptions.jsx !== 'react-jsx') {
      ts.compilerOptions.jsx = 'react-jsx';
      writeJson(f, ts);
      updated++;
      console.log(`jsx set to react-jsx: ${path.basename(dir)}`);
    }
  }
  console.log(`Updated ${updated} tsconfig.json files.`);
}

main();

