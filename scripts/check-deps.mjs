#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const UI_PEERS = [
  'react',
  'react-dom',
  '@mui/material',
  '@mui/icons-material',
  '@emotion/react',
  '@emotion/styled',
];

const args = new Set(process.argv.slice(2));
const STRICT = args.has('--strict');

function readConfig() {
  const file = path.join(ROOT, 'scripts', 'check-deps.config.json');
  const cfg = readJson(file) || {};
  cfg.allowSkipLibCheck = new Set(cfg.allowSkipLibCheck || []);
  return cfg;
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function listPackages() {
  const out = [];
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        const pkgPath = path.join(p, 'package.json');
        if (fs.existsSync(pkgPath)) out.push(p);
        walk(p);
      }
    }
  }
  walk(path.join(ROOT, 'packages'));
  // include app if present
  const appPkg = path.join(ROOT, 'app', 'package.json');
  if (fs.existsSync(appPkg)) out.push(path.join(ROOT, 'app'));
  return out;
}

function parseExternalsFromTsupConfig(file) {
  try {
    const src = fs.readFileSync(file, 'utf8');
    const m = src.match(/external\s*:\s*\[([\s\S]*?)\]/);
    if (!m) return [];
    const body = m[1];
    const singles = [...body.matchAll(/'([^']+)'/g)].map((x) => x[1]);
    const doubles = [...body.matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    return [...new Set([...singles, ...doubles])];
  } catch { return []; }
}

function loadDefaultExternals() {
  const base = path.join(ROOT, 'tsup.base.config.ts');
  return parseExternalsFromTsupConfig(base);
}

function readTsupExternals(pkgDir, defaults) {
  const files = ['tsup.config.ts', 'tsup.config.mjs', 'tsup.config.js']
    .map((f) => path.join(pkgDir, f))
    .filter((f) => fs.existsSync(f));
  const extras = files.flatMap((f) => parseExternalsFromTsupConfig(f));
  return [...new Set([...(defaults || []), ...extras])];
}

function readTsconfig(pkgDir) {
  const file = path.join(pkgDir, 'tsconfig.json');
  return readJson(file) || {};
}

function fmt(list) { return list.map((s) => `- ${s}`).join('\n'); }

function analyze() {
  const defaults = loadDefaultExternals();
  const cfg = readConfig();
  const pkgs = listPackages();
  const results = [];
  for (const dir of pkgs) {
    const pkgJson = readJson(path.join(dir, 'package.json'));
    if (!pkgJson) continue;
    const name = pkgJson.name || path.basename(dir);
    const deps = new Set(Object.keys(pkgJson.dependencies || {}));
    const peers = new Set(Object.keys(pkgJson.peerDependencies || {}));
    const devs = new Set(Object.keys(pkgJson.devDependencies || {}));
    const externals = new Set(readTsupExternals(dir, defaults));
    const tsconfig = readTsconfig(dir);
    const paths = (tsconfig.compilerOptions && tsconfig.compilerOptions.paths) || {};

    const warnings = [];
    const errors = [];

    // Rule 1: peerDependencies ⊆ externals
    const missingExternal = [...peers].filter((p) => !externals.has(p));
    if (missingExternal.length) warnings.push(`peer not in tsup.external:\n${fmt(missingExternal)}`);

    // Rule 2: externals in dependencies but not in peers → warn（多重バンドル予備軍）
    const extInDepsNotPeers = [...externals].filter((e) => deps.has(e) && !peers.has(e));
    if (extInDepsNotPeers.length) warnings.push(`external also in dependencies (consider peer):\n${fmt(extInDepsNotPeers)}`);

    // Rule 3: UI peers must be peerDependencies（依存に置かない）
    const uiInDeps = UI_PEERS.filter((u) => deps.has(u));
    if (uiInDeps.length) errors.push(`UI libs should be peerDependencies (not dependencies):\n${fmt(uiInDeps)}`);
    const uiMissingPeer = UI_PEERS.filter((u) => (deps.has(u) || devs.has(u)) && !peers.has(u));
    if (uiMissingPeer.length) warnings.push(`UI libs installed but missing in peerDependencies:\n${fmt(uiMissingPeer)}`);

    // Rule 4: tsconfig.paths で ../xxx/src 直参照を警告（types-only除外は将来対応）
    const badPaths = Object.entries(paths)
      .flatMap(([k, arr]) => (arr || []).map((p) => ({ key: k, val: p })))
      .filter((e) => /\.\.\/.+\/src(\/|$)/.test(e.val));
    if (badPaths.length) warnings.push(`tsconfig paths direct src reference:\n${fmt(badPaths.map((e) => `${e.key} -> ${e.val}`))}`);

    // Rule 5: local shim presence (info)
    const shimDir = path.join(dir, 'src', 'types');
    if (fs.existsSync(shimDir)) {
      const shims = fs.readdirSync(shimDir).filter((f) => f.endsWith('.d.ts'));
      if (shims.length) warnings.push(`local type shims present (document policy):\n${fmt(shims)}`);
    }

    // Rule 6: skipLibCheck policing
    const skipLibCheck = !!(tsconfig.compilerOptions && tsconfig.compilerOptions.skipLibCheck);
    const allowInTsconfig = !!(tsconfig.checkDeps && tsconfig.checkDeps.allowSkipLibCheck);
    if (skipLibCheck) {
      if (cfg.allowSkipLibCheck.has(name) || allowInTsconfig) {
        const reason = (tsconfig.checkDeps && tsconfig.checkDeps.reason) || '';
        if (!reason && !cfg.allowSkipLibCheck.has(name)) {
          warnings.push('skipLibCheck enabled without documented reason (add tsconfig.checkDeps.reason or root allow list).');
        }
      } else {
        errors.push('skipLibCheck is enabled but not allowed. Prefer fixing types or documenting explicit allowance.');
      }
    }

    // Rule 7: tsconfig extends baseline
    const extendsField = tsconfig.extends || '';
    if (!extendsField.includes('tsconfig.base.json')) {
      warnings.push(`tsconfig does not extend repo base (tsconfig.base.json): ${extendsField || '(missing)'}`);
    }

    // Rule 8: tsx detection requires jsx: react-jsx
    const srcDir = path.join(dir, 'src');
    let hasTsx = false;
    try {
      const stack = [srcDir];
      while (stack.length && !hasTsx) {
        const d = stack.pop();
        if (!d || !fs.existsSync(d)) break;
        for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
          if (ent.isDirectory()) stack.push(path.join(d, ent.name));
          else if (ent.name.endsWith('.tsx')) { hasTsx = true; break; }
        }
      }
    } catch {}
    const jsxOpt = tsconfig.compilerOptions && tsconfig.compilerOptions.jsx;
    if (hasTsx && jsxOpt !== 'react-jsx') {
      warnings.push(`tsx files detected but compilerOptions.jsx is '${jsxOpt || '(unset)'}' (recommend 'react-jsx').`);
    }

    if (warnings.length || errors.length) {
      results.push({ name, dir, warnings, errors });
    }
  }

  let hasError = false;
  for (const r of results) {
    if (r.errors.length) hasError = true;
    console.log(`\n=== ${r.name} ===`);
    if (r.errors.length) console.log(`ERRORS:\n${r.errors.join('\n\n')}`);
    if (r.warnings.length) console.log(`WARNINGS:\n${r.warnings.join('\n\n')}`);
  }

  if (!results.length) console.log('All packages passed dependency checks.');
  if (STRICT && hasError) process.exit(1);
}

analyze();
