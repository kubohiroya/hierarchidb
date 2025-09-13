#!/usr/bin/env node
/**
 * Normalize per-package tsconfig.json across the monorepo.
 * - Set compilerOptions.baseUrl = '.' (if present or if paths need ~ alias)
 * - Set compilerOptions.paths to { "~/*": ["./src/*"] } when a paths section exists
 *   or when a local alias is desirable and src/ exists.
 * - Ensure jsx: 'react-jsx' when TSX is present or jsx is unset.
 * - Remove known duplicate/legacy shapes and rewrite with stable ordering.
 *
 * Exceptions: some packages may keep custom configs (allow list below).
 */
import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(process.cwd());
const allowCustom = new Set([
  '@hierarchidb/app',
  '@hierarchidb/bff',
]);

function globPackages(dir) {
  const out = [];
  function walk(d) {
    for (const name of fs.readdirSync(d)) {
      if (name === 'node_modules' || name === '.turbo' || name.startsWith('.')) continue;
      const p = path.join(d, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) {
        const pkg = path.join(p, 'package.json');
        if (fs.existsSync(pkg)) out.push(p);
        walk(p);
      }
    }
  }
  walk(dir);
  return out;
}

const workspaces = globPackages(repoRoot);
let changed = 0;
let skipped = 0;

for (const dir of workspaces) {
  const pkgPath = path.join(dir, 'package.json');
  const tsconfigPath = path.join(dir, 'tsconfig.json');
  if (!fs.existsSync(pkgPath) || !fs.existsSync(tsconfigPath)) continue;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const name = pkg.name || path.basename(dir);
  if (allowCustom.has(name)) { skipped++; continue; }

  let ts;
  try {
    let raw = fs.readFileSync(tsconfigPath, 'utf-8');
    // Strip // and /* */ comments
    raw = raw.replace(/\/\*[\s\S]*?\*\//g, '');
    raw = raw.replace(/(^|\s+)\/\/.*$/gm, '$1');
    // Remove trailing commas before } or ]
    raw = raw.replace(/,\s*([}\]])/g, '$1');
    ts = JSON.parse(raw);
  } catch {
    console.warn(`skip (unparseable): ${path.relative(repoRoot, tsconfigPath)}`);
    continue;
  }
  ts.compilerOptions = ts.compilerOptions || {};
  const co = ts.compilerOptions;

  const srcDir = fs.existsSync(path.join(dir, 'src'));
  const wantAlias = srcDir;

  // baseUrl
  if (co.baseUrl && co.baseUrl !== '.') co.baseUrl = '.';
  if (!co.baseUrl && wantAlias) co.baseUrl = '.';

  // paths
  const desiredPaths = { '~/*': ['./src/*'] };
  if (wantAlias) {
    const current = co.paths || {};
    const equal = Object.keys(current).length === 1 && current['~/*'] && Array.isArray(current['~/*']) && current['~/*'].length === 1 && current['~/*'][0] === './src/*';
    if (!equal) co.paths = desiredPaths;
  } else {
    // No src/ folder: remove paths
    if (co.paths) delete co.paths;
  }

  // jsx
  if (!co.jsx) co.jsx = 'react-jsx';

  // Clean artifacts that cause noise
  // (leave other options intact)

  const pretty = JSON.stringify(ts, null, 2) + '\n';
  fs.writeFileSync(tsconfigPath, pretty);
  changed++;
  console.log(`normalized: ${path.relative(repoRoot, tsconfigPath)}`);
}

console.log(`\nTsconfig normalized. changed=${changed} skipped=${skipped}`);
