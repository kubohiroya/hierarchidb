#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const UI_LIBS = [
  'react',
  'react-dom',
  '@mui/material',
  '@mui/icon-material',
  '@emotion/react',
  '@emotion/styled',
];

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

function pickVersion(rangeMap, name, fallback = '^0.0.0') {
  return rangeMap[name] || fallback;
}

function ensurePeers(pkgJson, rangeMap) {
  pkgJson.peerDependencies ||= {};
  pkgJson.devDependencies ||= {};
  let changed = false;
  for (const name of UI_LIBS) {
    const inDeps = pkgJson.dependencies?.[name];
    const inDev = pkgJson.devDependencies?.[name];
    const inPeer = pkgJson.peerDependencies?.[name];
    if (inDeps || inDev || inPeer) {
      const ver = pickVersion(rangeMap, name, inDeps || inDev || inPeer || '^0.0.0');
      if (inDeps) { delete pkgJson.dependencies[name]; changed = true; }
      if (!inPeer || inPeer !== ver) { pkgJson.peerDependencies[name] = ver; changed = true; }
      // keep devDependency as well for local typecheck/build
      if (!inDev || inDev !== ver) { pkgJson.devDependencies[name] = ver; changed = true; }
    }
  }
  return changed;
}

function updateTsupExternal(tsupFile) {
  let src = fs.readFileSync(tsupFile, 'utf8');
  if (/external\s*:\s*\[/.test(src)) {
    // augment existing array
    const before = src;
    for (const lib of UI_LIBS) {
      const rx = new RegExp(`['\"]${lib}['\"]`);
      if (!rx.test(src)) {
        src = src.replace(/external\s*:\s*\[/, (m) => `${m}'${lib}', `);
      }
    }
    if (src !== before) { fs.writeFileSync(tsupFile, src); return true; }
    return false;
  } else if (/defineConfig\s*\(\s*\{/.test(src)) {
    // inject external field after first brace
    const insertion = `external: [${UI_LIBS.map((s) => `'${s}'`).join(', ')}],\n`;
    src = src.replace(/(defineConfig\s*\(\s*\{\s*)/, `$1${insertion}`);
    fs.writeFileSync(tsupFile, src);
    return true;
  }
  return false;
}

function findTsupConfig(dir) {
  for (const fn of ['tsup.config.ts', 'tsup.config.mjs', 'tsup.config.js']) {
    const f = path.join(dir, fn);
    if (fs.existsSync(f)) return f;
  }
  return null;
}

function isLikelyUiPackage(dir, pkgJson) {
  if (pkgJson.private) return false; // skip apps/private
  const hasUiDep = UI_LIBS.some((n) => (pkgJson.dependencies && pkgJson.dependencies[n]) || (pkgJson.devDependencies && pkgJson.devDependencies[n]) || (pkgJson.peerDependencies && pkgJson.peerDependencies[n]));
  if (hasUiDep) return true;
  if (/\bui\b|plugin/i.test(pkgJson.name || '') || /\/ui\//.test(dir)) return true;
  // check for tsx existence (quick scan)
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
  const rootPkg = readJson(path.join(ROOT, 'package.json')) || {};
  const rootRanges = { ...(rootPkg.dependencies || {}), ...(rootPkg.devDependencies || {}) };
  const pkgs = listPackages();
  let peerChanged = 0, tsupChanged = 0;
  const touched = [];

  for (const dir of pkgs) {
    const pkgFile = path.join(dir, 'package.json');
    const pkg = readJson(pkgFile);
    if (!pkg) continue;
    if (!isLikelyUiPackage(dir, pkg)) continue;
    const before = JSON.stringify(pkg);
    const p1 = ensurePeers(pkg, rootRanges);
    if (p1) writeJson(pkgFile, pkg);
    if (p1) peerChanged++;
    let p2 = false;
    const tsup = findTsupConfig(dir);
    if (tsup) { p2 = updateTsupExternal(tsup); if (p2) tsupChanged++; }
    if (p1 || p2) touched.push({ name: pkg.name || path.basename(dir), dir, peers: p1, tsup: !!p2 });
  }

  console.log(`Updated peerDependencies in ${peerChanged} packages; updated tsup external in ${tsupChanged} packages.`);
  for (const t of touched) {
    console.log(`- ${t.name}: peer=${t.peers ? 'yes' : 'no'}, tsup=${t.tsup ? 'yes' : 'no'}`);
  }
}

main();
