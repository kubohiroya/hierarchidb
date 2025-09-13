#!/usr/bin/env node
// Extra dependency guards complementing dep-fence policies.
// - Enforce workspace:* for @hierarchidb/* intra-repo deps
// - For React Router v7+, forbid @types/react-router (v5 types)
// - Detect unresolved runtime dependencies (installed-but-not-resolvable)
// - Advise when lockfile is newer than node_modules (restart + install)

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const repoRoot = path.resolve(process.cwd());
let config = {};
try {
  const mod = await import(path.join(repoRoot, 'dep-fence.config.mjs'));
  config = mod.policyOptions || {};
} catch {}

function globPackages(dir) {
  const out = [];
  function walk(d) {
    for (const name of fs.readdirSync(d)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
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

let errors = 0;
let warnings = 0;

function err(msg) {
  // eslint-disable-next-line no-console
  console.error(`ERROR  ${msg}`);
  errors++;
}
function warn(msg) {
  // eslint-disable-next-line no-console
  console.warn(`WARN   ${msg}`);
  warnings++;
}

function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
}

// Prepare workspace package names for internal detection
function collectWorkspacePackageNames() {
  const names = new Set();
  for (const dir of workspaces) {
    const pkg = readJSON(path.join(dir, 'package.json'));
    if (pkg?.name) names.add(pkg.name);
  }
  return names;
}

const workspacePkgNames = collectWorkspacePackageNames();
const workspaceScopes = Array.isArray(config.workspaceScopes) ? config.workspaceScopes : ['@hierarchidb'];

// Rule A: workspace protocol for internal packages
for (const dir of workspaces) {
  const pkgPath = path.join(dir, 'package.json');
  const pkg = readJSON(pkgPath);
  if (!pkg) continue;
  const all = { ...(pkg.dependencies||{}), ...(pkg.devDependencies||{}), ...(pkg.peerDependencies||{}) };
  for (const [dep, spec] of Object.entries(all)) {
    const isInternalByScope = workspaceScopes.some((s)=>dep.startsWith(`${s}/`));
    const isInternalByWorkspace = workspacePkgNames.has(dep);
    if (!isInternalByScope && !isInternalByWorkspace) continue;
    if (dep === pkg.name) continue;
    const s = String(spec||'');
    if (!s.startsWith('workspace:')) {
      err(`${pkg.name}: internal dep '${dep}' must use workspace: protocol (found '${s}')`);
    }
  }
}

// Rule B: For react-router v7+, forbid @types/react-router
for (const dir of workspaces) {
  const pkgPath = path.join(dir, 'package.json');
  const pkg = readJSON(pkgPath);
  if (!pkg) continue;
  const deps = { ...(pkg.dependencies||{}), ...(pkg.devDependencies||{}) };
  const rr = deps['react-router'] || deps['react-router-dom'];
  const typesRR = deps['@types/react-router'];
if (config.routerV7NoTypes && rr && /^\s*\^?7\./.test(String(rr)) && typesRR) {
  err(`${pkg.name}: react-router v7 detected but has @types/react-router (${typesRR}). Remove this v5 types package.`);
}
}

// Rule C: Runtime deps resolvable
function canResolveFrom(dir, dep) {
  try {
    const req = createRequire(path.join(dir, 'package.json'));
    try { req.resolve(`${dep}/package.json`); return true; } catch {}
    try { req.resolve(dep); return true; } catch {}
  } catch {}
  try {
    const rootReq = createRequire(path.join(repoRoot, 'package.json'));
    try { rootReq.resolve(`${dep}/package.json`); return true; } catch {}
    try { rootReq.resolve(dep); return true; } catch {}
  } catch {}
  return false;
}
for (const dir of workspaces) {
  const pkgPath = path.join(dir, 'package.json');
  const pkg = readJSON(pkgPath);
  if (!pkg) continue;
  if (pkg.name !== '@hierarchidb/app' && pkg.name !== '@hierarchidb/bff' && pkg.name !== '@hierarchidb/cors-proxy') continue;
  const deps = pkg.dependencies || {};
  for (const [dep, spec] of Object.entries(deps)) {
    const s = String(spec||'');
    if (s.startsWith('workspace:')) continue; // ignore intra-repo
    if (!canResolveFrom(dir, dep)) {
      // In sandbox/CI phases without full install, treat as advisory
      warn(`${pkg.name}: dependency '${dep}' is not resolvable from ${path.relative(repoRoot, dir)} (likely not installed).`);
    }
  }
}

// Rule D: Drift advisory (lockfile newer than node_modules)
const lock = ['pnpm-lock.yaml','yarn.lock','package-lock.json'].map(f=>path.join(repoRoot,f)).find(p=>fs.existsSync(p));
const nm = [
  path.join(repoRoot,'node_modules/.modules.yaml'),
  path.join(repoRoot,'node_modules/.pnpm'),
  path.join(repoRoot,'node_modules'),
].find(p=>fs.existsSync(p));
if (lock && nm) {
  const lm = fs.statSync(lock).mtimeMs;
  const nmM = fs.statSync(nm).mtimeMs;
  if (lm > nmM + 1) {
    warn(`Lockfile is newer than node_modules. Run 'pnpm -w install' and restart dev server.`);
  }
}

// Rule E: MapLibre direct dependency encapsulation (config-driven)
const mapLibreAllowed = new Set((config.mapLibreAllowedPackages || []));
if (mapLibreAllowed.size > 0) {
function hasAnyDirect(pkg, names) {
  const hit = [];
  for (const f of ['dependencies','peerDependencies','devDependencies','optionalDependencies']) {
    const o = pkg[f] || {};
    for (const n of names) if (o[n]) hit.push(n);
  }
  return hit;
}
for (const dir of workspaces) {
  const pkgPath = path.join(dir, 'package.json');
  const pkg = readJSON(pkgPath);
  if (!pkg) continue;
  const bad = hasAnyDirect(pkg, ['maplibre-gl','@vis.gl/react-maplibre']);
  if (bad.length === 0) continue;
  if (!mapLibreAllowed.has(pkg.name)) {
    err(`${pkg.name}: disallowed direct dependency on ${bad.join(', ')}. Only allowed in: ${Array.from(mapLibreAllowed).join(', ')}`);
  }
}
}

// Rule F: UI peer policy (react/react-dom/@mui/*/@emotion/* should be peers)
const uiPeerLibs = Array.isArray(config.uiPeerLibs) ? config.uiPeerLibs : [];
for (const dir of workspaces) {
  const pkgPath = path.join(dir, 'package.json');
  const pkg = readJSON(pkgPath);
  if (!pkg) continue;
  if (pkg.name === '@hierarchidb/app' || pkg.private === true) continue; // skip app and private packs
  const deps = pkg.dependencies || {};
  const peer = pkg.peerDependencies || {};
  for (const lib of uiPeerLibs) {
    if (deps[lib] && !peer[lib]) {
      err(`${pkg.name}: '${lib}' should be in peerDependencies (not dependencies).`);
    }
  }
}

// Rule G: tsup.external should include peerDependencies
const checkTsupExternal = Boolean(config.checkTsupExternalizePeers);
if (checkTsupExternal) {
  for (const dir of workspaces) {
    const pkgPath = path.join(dir, 'package.json');
    const pkg = readJSON(pkgPath);
    if (!pkg) continue;
    const peers = Object.keys(pkg.peerDependencies || {});
    if (peers.length === 0) continue;
    const tsup = pkg.tsup || {};
    const external = Array.isArray(tsup.external) ? tsup.external : [];
    const missing = peers.filter((p)=>!external.includes(p));
    if (missing.length) {
      warn(`${pkg.name}: tsup.external missing peers: ${missing.join(', ')}`);
    }
  }
}

// Rule H: Guard tsconfig overrides — allow only safe local alias ("~/*" -> "./src/*") and baseUrl "."
// Rationale: We centralize cross-package resolution in the root tsconfig. Per-package aliases are
// permitted only for local imports quality-of-life ("~/*"). Anything else risks mask/mis-resolution.
const checkTsconfigOverrides = true;
const allowTsconfigOverrides = new Set([
  '@hierarchidb/app', // app-level may have custom routes/build tooling
  '@hierarchidb/bff', // server tooling
]);
for (const dir of workspaces) {
  if (!checkTsconfigOverrides) break;
  const pkgPath = path.join(dir, 'package.json');
  const pkg = readJSON(pkgPath);
  if (!pkg) continue;
  const name = pkg.name || '';
  const tsconfigPath = path.join(dir, 'tsconfig.json');
  if (!fs.existsSync(tsconfigPath)) continue;

  let disallowed = false;
  let reason = '';
  try {
    const ts = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
    const co = ts?.compilerOptions || {};
    const baseUrl = co.baseUrl;
    const paths = co.paths || {};

    // Allow baseUrl only if '.' or undefined
    if (typeof baseUrl !== 'undefined' && baseUrl !== '.') {
      disallowed = true;
      reason = `baseUrl should be '.' or omitted (found '${baseUrl}')`;
    }

    // Allow either no paths, or a single safe alias "~/*": ["./src/*"]
    const keys = Object.keys(paths);
    if (!disallowed && keys.length > 0) {
      const isOnlyTilde = keys.length === 1 && keys[0] === '~/*';
      const vals = isOnlyTilde ? paths['~/*'] : [];
      const okVals = Array.isArray(vals) && vals.length > 0 && vals.every((v) => String(v) === './src/*');
      if (!(isOnlyTilde && okVals)) {
        disallowed = true;
        reason = `paths must be limited to { "~/*": ["./src/*"] }`;
      }
    }
  } catch {}

  if (disallowed && !allowTsconfigOverrides.has(name)) {
    // Downgrade to WARN for legacy packages to avoid blocking builds,
    // while still surfacing the configuration drift loudly.
    warn(`${name}: forbids local tsconfig baseUrl/paths overrides (${reason}). Keep resolution centralized.`);
  }
}

// Rule I: Detect duplicate keys ('paths', 'types') in tsconfig (text-level)
for (const dir of workspaces) {
  const tsconfigPath = path.join(dir, 'tsconfig.json');
  if (!fs.existsSync(tsconfigPath)) continue;
  const txt = fs.readFileSync(tsconfigPath, 'utf-8');
  const count = (key) => (txt.match(new RegExp(`"${key}"\s*:`, 'g')) || []).length;
  const keys = ['paths', 'types'];
  for (const k of keys) {
    if (count(k) > 1) {
      warn(`${path.relative(repoRoot, tsconfigPath)}: duplicate key '${k}' found. Merge into a single entry.`);
    }
  }
}

// Summary / exit code
if (errors) {
  // eslint-disable-next-line no-console
  console.error(`\nDependency guard failed: ${errors} error(s), ${warnings} warning(s).`);
  process.exit(1);
} else {
  // eslint-disable-next-line no-console
  console.log(`Dependency guard passed with ${warnings} warning(s).`);
}
