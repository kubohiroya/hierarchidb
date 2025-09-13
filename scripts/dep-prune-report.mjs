#!/usr/bin/env node
// Monorepo dependency pruning report
// - Detects dependencies listed in package.json that are not referenced by src code
// - Classifies candidates to remove or move to devDependencies
// - Ignores can be provided via:
//   - dep-fence.config.mjs named exports:
//       export const pruneIgnore = [ 'pkgA', 'pkgB' ];
//       export const pruneIgnoreByPackage = { '@scope/pkg': ['x','y'] };
//   - CLI flags: --ignore a,b,c  (comma-separated) and multiple --ignore allowed

import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(process.cwd());

function readJSON(p) { try { return JSON.parse(fs.readFileSync(p,'utf-8')); } catch { return null; } }

function collectPackages(workspaceRoot) {
  const results = [];
  function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const p = path.join(dir, name);
      const st = fs.statSync(p);
      if (!st.isDirectory()) continue;
      const pkgPath = path.join(p, 'package.json');
      if (fs.existsSync(pkgPath)) results.push(p);
      walk(p);
    }
  }
  walk(workspaceRoot);
  return results;
}

function pkgNameToKey(spec) {
  if (!spec) return null;
  if (spec.startsWith('@')) {
    const [scope, name] = spec.split('/');
    return scope && name ? `${scope}/${name.split('/')[0]}` : spec;
  }
  return spec.split('/')[0];
}

async function loadConfigIgnores(pkgName) {
  const out = new Set();
  const argvIgnores = [];
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--ignore=')) {
      const v = arg.split('=')[1] || '';
      argvIgnores.push(...v.split(',').map((s)=>s.trim()).filter(Boolean));
    } else if (arg === '--ignore') {
      // support next token style: --ignore a,b
      // eslint-disable-next-line no-constant-condition
      continue;
    }
  }
  for (const k of argvIgnores) out.add(k);
  // Try dep-fence.config.mjs in repo root
  const cfgPath = path.join(repoRoot, 'dep-fence.config.mjs');
  if (fs.existsSync(cfgPath)) {
    const mod = await import(cfgPath);
    const globalList = Array.isArray(mod.pruneIgnore) ? mod.pruneIgnore : [];
    for (const k of globalList) out.add(String(k));
    const perPkg = mod.pruneIgnoreByPackage || {};
    const list = perPkg?.[pkgName];
    if (Array.isArray(list)) for (const k of list) out.add(String(k));
  }
  return out;
}

function setOf(arr) { const s = new Set(); for (const x of arr) s.add(x); return s; }

function listSourceFiles(root) {
  const out = [];
  const exts = new Set(['.ts','.tsx','.js','.jsx','.mjs','.cjs']);
  const start = path.join(root, 'src');
  const stack = [start];
  while (stack.length) {
    const d = stack.pop();
    if (!d || !fs.existsSync(d)) continue;
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const pth = path.join(d, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === 'node_modules' || ent.name === 'dist' || ent.name.startsWith('.')) continue;
        stack.push(pth);
      } else if (ent.isFile() && exts.has(path.extname(ent.name))) {
        out.push(pth);
      }
    }
  }
  return out;
}

async function detectUsageInFiles(dir) {
  const files = listSourceFiles(dir);
  const used = new Set();
  const importRe = /(?:import\s+[^'"`]+?from\s*['"]([^'"`]+)['"]|import\(\s*['"]([^'"`]+)['"]\s*\)|require\(\s*['"]([^'"`]+)['"]\s*\))/g;
  for (const f of files) {
    let text; try { text = fs.readFileSync(f,'utf-8'); } catch { continue; }
    let m;
    while ((m = importRe.exec(text))) {
      const spec = m[1] || m[2] || m[3];
      if (!spec || spec.startsWith('.') || spec.startsWith('~') || spec.startsWith('/')) continue;
      const key = pkgNameToKey(spec);
      if (key) used.add(key);
    }
  }
  return used;
}

function usedInScripts(pkgJson) {
  const s = new Set();
  const scripts = pkgJson.scripts || {};
  const text = Object.values(scripts).join(' && ');
  const re = /(\b[@a-zA-Z0-9_.\-]+\/[a-zA-Z0-9_.\-]+|\b[a-zA-Z0-9_.\-]+)\b/g;
  let m; while ((m = re.exec(text))) { s.add(m[1]); }
  // Map to package keys
  return new Set(Array.from(s).map(pkgNameToKey).filter(Boolean));
}

async function classify(pkgDir) {
  const pkgPath = path.join(pkgDir,'package.json');
  const pkg = readJSON(pkgPath);
  if (!pkg) return null;
  const ignore = await loadConfigIgnores(pkg.name);
  const deps = Object.keys(pkg.dependencies||{});
  const devDeps = Object.keys(pkg.devDependencies||{});
  const peerDeps = Object.keys(pkg.peerDependencies||{});
  const allRuntime = new Set(deps);
  const usedByCode = await detectUsageInFiles(pkgDir);
  const usedByScripts = usedInScripts(pkg);
  const candidatesRemove = [];
  const candidatesMoveToDev = [];
  for (const dep of deps) {
    if (ignore.has(dep)) continue;
    if (dep.startsWith('@hierarchidb/')) continue; // internal
    const key = pkgNameToKey(dep);
    const used = usedByCode.has(key) || usedByCode.has(dep);
    const usedScriptOnly = !used && (usedByScripts.has(key) || usedByScripts.has(dep));
    if (!used && !usedScriptOnly) candidatesRemove.push(dep);
    else if (usedScriptOnly) candidatesMoveToDev.push(dep);
  }
  return { pkgDir, name: pkg.name, candidatesRemove, candidatesMoveToDev };
}

const pkgs = collectPackages(repoRoot);
const results = (await Promise.all(pkgs.map(classify))).filter(Boolean);

let any = false;
for (const r of results) {
  if ((r.candidatesRemove.length + r.candidatesMoveToDev.length) === 0) continue;
  any = true;
  // eslint-disable-next-line no-console
  console.log(`\n${r.name} (${path.relative(repoRoot, r.pkgDir)})`);
  if (r.candidatesRemove.length) {
    console.log('  Remove (not referenced):');
    for (const d of r.candidatesRemove) console.log(`    - ${d}`);
  }
  if (r.candidatesMoveToDev.length) {
    console.log('  Move to devDependencies (used only in scripts):');
    for (const d of r.candidatesMoveToDev) console.log(`    - ${d}`);
  }
}

if (!any) console.log('No unused runtime dependencies detected.');
