#!/usr/bin/env node
// Simple policy check: Ensure only allowed packages directly depend on MapLibre.
// Allowed: packages/ui/map, packages/feature/map-adapter

import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const allowed = new Set([
  'packages/ui/map',
  'packages/feature/map-adapter',
]);

function* walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
      yield* walk(p);
    } else if (ent.isFile() && ent.name === 'package.json') {
      yield p;
    }
  }
}

function hasDirectMapLibreDeps(pkg) {
  const fields = ['dependencies', 'peerDependencies', 'devDependencies', 'optionalDependencies'];
  const names = new Set();
  for (const f of fields) {
    const obj = pkg[f];
    if (obj && typeof obj === 'object') {
      Object.keys(obj).forEach((k) => names.add(k));
    }
  }
  const bad = [];
  if (names.has('maplibre-gl')) bad.push('maplibre-gl');
  if (names.has('@vis.gl/react-maplibre')) bad.push('@vis.gl/react-maplibre');
  return bad;
}

const violations = [];
for (const pkgJsonPath of walk(path.join(repoRoot, 'packages'))) {
  const relDir = path.dirname(path.relative(repoRoot, pkgJsonPath));
  const raw = fs.readFileSync(pkgJsonPath, 'utf8');
  let pkg;
  try { pkg = JSON.parse(raw); } catch { continue; }
  const bad = hasDirectMapLibreDeps(pkg);
  if (bad.length === 0) continue;
  if (!Array.from(allowed).some((a) => relDir.startsWith(a))) {
    violations.push({ packageDir: relDir, bad });
  }
}

if (violations.length) {
  console.error('MapLibre encapsulation policy violation: disallowed direct dependencies found.');
  for (const v of violations) {
    console.error(` - ${v.packageDir} depends on: ${v.bad.join(', ')}`);
  }
  process.exit(1);
} else {
  console.log('MapLibre policy OK (no disallowed direct dependencies).');
}

