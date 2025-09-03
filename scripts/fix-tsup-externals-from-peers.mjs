#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } }

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

function findTsupConfig(dir) {
  for (const fn of ['tsup.config.ts', 'tsup.config.mjs', 'tsup.config.js']) {
    const f = path.join(dir, fn);
    if (fs.existsSync(f)) return f;
  }
  return null;
}

function ensureExternal(tsupFile, peers) {
  let src = fs.readFileSync(tsupFile, 'utf8');
  const missing = peers.filter((p) => !new RegExp(`["']${p}["']`).test(src));
  if (!missing.length) return false;
  if (/external\s*:\s*\[/.test(src)) {
    src = src.replace(/external\s*:\s*\[/, (m) => `${m}${missing.map((s) => `'${s}', `).join('')}`);
  } else if (/defineConfig\s*\(\s*\{/.test(src)) {
    const insertion = `external: [${missing.map((s) => `'${s}'`).join(', ')}],\n`;
    src = src.replace(/(defineConfig\s*\(\s*\{\s*)/, `$1${insertion}`);
  } else {
    // naive: add at top-level object literal first brace
    src = src.replace(/\{\s*/, (m) => `${m}external: [${missing.map((s) => `'${s}'`).join(', ')}],\n`);
  }
  fs.writeFileSync(tsupFile, src);
  return true;
}

function main() {
  const pkgs = listPackages();
  let changed = 0; const details = [];
  for (const dir of pkgs) {
    const pkg = readJson(path.join(dir, 'package.json'));
    if (!pkg) continue;
    const peers = Object.keys(pkg.peerDependencies || {});
    if (!peers.length) continue;
    const tsup = findTsupConfig(dir);
    if (!tsup) continue;
    if (ensureExternal(tsup, peers)) {
      changed++; details.push(`${pkg.name || path.basename(dir)} (${peers.length} peers)`);
    }
  }
  console.log(`Updated tsup externals in ${changed} packages.`);
  for (const d of details) console.log('- ' + d);
}

main();

