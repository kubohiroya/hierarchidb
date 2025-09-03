#!/usr/bin/env node
// Move packages reported as `external-in-deps` to peerDependencies.
// Dry-run by default; pass --apply to write changes.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const APPLY = process.argv.includes('--apply');

function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } }
function writeJson(file, obj) { fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n'); }

function ensureBuiltChecker() {
  spawnSync('pnpm', ['--filter', '@hierarchidb/check-deps', 'build'], { stdio: 'inherit' });
}

function runCheckerJson() {
  const res = spawnSync('node', ['packages/tools/check-deps/dist/cli.js', '--json'], { encoding: 'utf8' });
  if (res.status !== 0 && res.status !== null) {
    console.error('check-deps failed (non-fatal for parse)', res.status);
  }
  try { return JSON.parse(res.stdout || '{}'); } catch { return { findings: [] }; }
}

function groupExternalInDeps(findings) {
  const out = new Map();
  for (const f of findings) {
    if (f.rule !== 'external-in-deps') continue;
    // parse message: lines with module names
    const mods = (f.message || '')
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith('external '))
      .map((s) => s.replace(/^[-]\s*/, ''))
      .filter(Boolean);
    if (!mods.length) continue;
    const arr = out.get(f.packageDir) || [];
    arr.push({ pkgName: f.packageName, modules: mods });
    out.set(f.packageDir, arr);
  }
  return out; // Map<pkgDir, Array<{pkgName, modules}>>
}

function pickVersion(rangeMap, name, fallback) {
  return rangeMap[name] || fallback || '^0.0.0';
}

function applyMove(dir, rootRanges, modules) {
  const file = path.join(dir, 'package.json');
  const pkg = readJson(file);
  if (!pkg) return { changed: false };
  let changed = false;
  pkg.peerDependencies ||= {};
  pkg.devDependencies ||= {};
  for (const name of modules) {
    const ver = pkg.dependencies?.[name] || pkg.devDependencies?.[name] || pkg.peerDependencies?.[name] || pickVersion(rootRanges, name);
    if (pkg.dependencies && pkg.dependencies[name]) { delete pkg.dependencies[name]; changed = true; }
    if (!pkg.peerDependencies[name] || pkg.peerDependencies[name] !== ver) { pkg.peerDependencies[name] = ver; changed = true; }
    if (!pkg.devDependencies[name] || pkg.devDependencies[name] !== ver) { pkg.devDependencies[name] = ver; changed = true; }
  }
  if (changed && APPLY) writeJson(file, pkg);
  return { changed, pkgName: pkg.name || path.basename(dir) };
}

function main() {
  ensureBuiltChecker();
  const data = runCheckerJson();
  const groups = groupExternalInDeps(data.findings || []);
  const rootPkg = readJson(path.join(ROOT, 'package.json')) || {};
  const rootRanges = { ...(rootPkg.dependencies || {}), ...(rootPkg.devDependencies || {}) };

  let total = 0; const logs = [];
  for (const [dir, arr] of groups.entries()) {
    const modules = [...new Set(arr.flatMap((x) => x.modules))];
    const { changed, pkgName } = applyMove(dir, rootRanges, modules);
    if (changed) { total++; logs.push(`- ${pkgName}: moved ${modules.join(', ')} to peerDependencies`); }
  }
  console.log(`${APPLY ? 'Applied' : 'Planned'} peerization in ${total} packages.`);
  for (const l of logs) console.log(l);
  if (!APPLY) console.log('Run again with --apply to write changes.');
}

main();

