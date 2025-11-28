#!/usr/bin/env node
// Extra dependency guards complementing dep-fence policies.
// - Enforce workspace:* for @hierarchidb/* intra-repo deps
// - For React Router v7+, forbid @types/react-router (v5 types)
// - Detect unresolved runtime-worker dependencies (installed-but-not-resolvable)
// - Advise when lockfile is newer than node_modules (restart + install)

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const repoRoot = path.resolve(process.cwd());
let config = {};
{
  const mod = await import(path.join(repoRoot, 'dep-fence.config.mjs'));
  config = mod.policyOptions || {};
}

const IGNORE_ROOT_PREFIXES = new Set(['reference']);

function globPackages(dir) {
  const out = [];
  function walk(d) {
    for (const name of fs.readdirSync(d)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const p = path.join(d, name);
      const st = fs.statSync(p);
      const rel = path.relative(repoRoot, p);
      const top = rel.split(path.sep)[0];
      if (IGNORE_ROOT_PREFIXES.has(top)) continue;
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
  console.error(`ERROR  ${msg}`);
  errors++;
}
function warn(msg) {
  console.warn(`WARN   ${msg}`);
  warnings++;
}

function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
}

// Read JSON-with-comments (JSONC) safely — for tsconfig*.json
function stripCommentsAndTrailingCommas(text) {
  let out = '';
  let inStr = false;
  let quote = '';
  let esc = false;
  let inLine = false;
  let inBlock = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];

    if (inLine) {
      if (c === '\n' || c === '\r') { inLine = false; out += c; }
      continue;
    }
    if (inBlock) {
      if (c === '*' && n === '/') { inBlock = false; i++; }
      continue;
    }
    if (inStr) {
      out += c;
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === quote) { inStr = false; }
      continue;
    }

    // Detect start of comments only when outside strings
    if (c === '/' && n === '/') { inLine = true; i++; continue; }
    if (c === '/' && n === '*') { inBlock = true; i++; continue; }

    // Handle strings
    if (c === '"' || c === "'") { inStr = true; quote = c; out += c; continue; }

    // Drop trailing commas before } or ]
    if (c === ',') {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      const nxt = text[j];
      if (nxt === '}' || nxt === ']') { continue; }
    }

    out += c;
  }
  return out;
}
function readJSONC(file) {
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    const cleaned = stripCommentsAndTrailingCommas(raw);
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
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
function tryResolve(req, spec) {
  try { req.resolve(spec); return true; }
  catch (e) { return false; }
}

function canResolveFrom(dir, dep) {
  const req = createRequire(path.join(dir, 'package.json'));
  if (tryResolve(req, `${dep}/package.json`) || tryResolve(req, dep)) return true;
  const rootReq = createRequire(path.join(repoRoot, 'package.json'));
  if (tryResolve(rootReq, `${dep}/package.json`) || tryResolve(rootReq, dep)) return true;
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

/*
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
 */

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
  {
    const ts = readJSONC(tsconfigPath);
    if (!ts) {
      warn(`${path.relative(repoRoot, tsconfigPath)}: could not be parsed as JSON (comments/trailing commas?). Skipping strict checks.`);
    } else {
      const co = ts?.compilerOptions || {};
      const normalizeBaseUrl = (value) => {
        if (typeof value !== 'string') return value;
        const trimmed = value.trim();
        if (trimmed === './' || trimmed === '.\\') return '.';
        return trimmed;
      };
      const baseUrl = normalizeBaseUrl(co.baseUrl);
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
      const okVals = Array.isArray(vals)
        && vals.length > 0
        && vals.every((v) => {
             const s = String(v);
             return s === './src/*' || s === 'src/*';
           });
        if (!(isOnlyTilde && okVals)) {
          disallowed = true;
          reason = `paths must be limited to { "~/*": ["./src/*"] }`;
        }
      }
    }
  }

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
  console.error(`\nDependency guard failed: ${errors} error(s), ${warnings} warning(s).`);
  process.exit(1);
} else {
  console.log(`Dependency guard passed with ${warnings} warning(s).`);
}
