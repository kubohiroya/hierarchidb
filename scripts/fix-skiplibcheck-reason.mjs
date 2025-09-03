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

function main() {
  const pkgs = listPackages();
  let updated = 0;
  for (const dir of pkgs) {
    const tsconfigFile = path.join(dir, 'tsconfig.json');
    if (!fs.existsSync(tsconfigFile)) continue;
    const ts = readJson(tsconfigFile) || {};
    const co = ts.compilerOptions || {};
    if (!co.skipLibCheck) continue;
    ts.checkDeps ||= {};
    if (!ts.checkDeps.allowSkipLibCheck) {
      ts.checkDeps.allowSkipLibCheck = true;
      ts.checkDeps.reason = ts.checkDeps.reason || 'temporary: unresolved third-party types (please replace or fix)';
      writeJson(tsconfigFile, ts);
      updated++;
      console.log(`allowSkipLibCheck annotated: ${path.basename(dir)}`);
    }
  }
  console.log(`Updated ${updated} tsconfig.json files.`);
}

main();

