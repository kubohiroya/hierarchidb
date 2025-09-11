#!/usr/bin/env node
/*
  HierarchiDB Dev: diagnose partial staleness without full cache wipes

  What it does:
  - Detect recent source changes (git + mtimes)
  - Check Vite dev server status on a given port
  - Compare change times vs dev-server start and .vite cache mtimes
  - Print targeted suggestions (and machine-readable JSON if --json)

  Usage:
    node tools/hdb-diagnose-staleness.mjs --port 4200 --app packages/app [--json]
*/
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync, spawnSync } from 'child_process';
import http from 'http';
import https from 'https';

const args = new Map(process.argv.slice(2).flatMap((a) => {
  const m = a.match(/^--([^=]+)(=(.*))?$/);
  if (m) return [[m[1], m[3] ?? 'true']];
  return [];
}));

const repoRoot = process.cwd();
const appDir = path.resolve(repoRoot, args.get('app') || 'app');
const port = Number(args.get('port') || 4200);
const outputJson = args.get('json') === 'true';

function nowIso() { return new Date().toISOString(); }

function safeStat(p) { try { return fs.statSync(p); } catch { return null; } }

function listFiles(dir, filterFn) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    let entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name.startsWith('.git')) continue;
        stack.push(p);
      } else if (!filterFn || filterFn(p)) {
        out.push(p);
      }
    }
  }
  return out;
}

function gitChangedSinceCommit(filesRoot) {
  try {
    const r = execSync('git rev-parse --verify HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const diff = execSync(`git diff --name-only ${r}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const list = diff.split(/\r?\n/).filter(Boolean).map(f => path.resolve(repoRoot, f));
    return list.filter(p => p.startsWith(filesRoot));
  } catch {
    return [];
  }
}

function getLatestMtime(files) {
  let latest = 0;
  for (const f of files) {
    const st = safeStat(f);
    if (st && st.mtimeMs > latest) latest = st.mtimeMs;
  }
  return latest || 0;
}

function getDevServerPidByPort(port) {
  try {
    if (process.platform === 'darwin' || process.platform === 'linux') {
      const out = execSync(`lsof -i :${port} -sTCP:LISTEN -n -P | awk 'NR>1 {print $2}' | head -n1`, { shell: '/bin/bash' }).toString().trim();
      const pid = Number(out);
      return Number.isFinite(pid) && pid > 0 ? pid : null;
    }
  } catch {}
  return null;
}

function getProcessStartTime(pid) {
  try {
    if (!pid) return null;
    if (process.platform === 'darwin') {
      const out = execSync(`ps -o lstart= -p ${pid}`).toString().trim();
      const t = Date.parse(out);
      return Number.isFinite(t) ? t : null;
    } else if (process.platform === 'linux') {
      const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
      const fields = stat.split(' ');
      const startTicks = Number(fields[21]);
      const clkTck = Number(execSync('getconf CLK_TCK').toString().trim());
      const bootTime = Number(execSync('cat /proc/stat | grep btime | awk "{print $2}"').toString().trim()) * 1000;
      return bootTime + (startTicks / clkTck) * 1000;
    }
  } catch {}
  return null;
}

async function httpHead(host, port) {
  return new Promise((resolve) => {
    const req = http.request({ host, port, path: '/', method: 'HEAD', timeout: 1500 }, (res) => {
      resolve({ ok: true, headers: res.headers, status: res.statusCode });
    });
    req.on('error', () => resolve({ ok: false }));
    req.on('timeout', () => { try { req.destroy(); } catch {} resolve({ ok: false }); });
    req.end();
  });
}

async function httpGetJson(url) {
  const mod = url.startsWith('https:') ? https : http;
  return new Promise((resolve) => {
    const req = mod.get(url, { timeout: 1500 }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { try { req.destroy(); } catch {} resolve(null); });
  });
}

function findViteCaches(appDir) {
  const caches = [];
  const local = path.join(appDir, 'node_modules/.vite');
  const root = path.join(repoRoot, 'node_modules/.vite');
  for (const d of [local, root]) {
    const st = safeStat(d);
    if (st && st.isDirectory()) {
      caches.push(d);
    }
  }
  return caches;
}

function listCacheEntries(cacheDir) {
  try {
    return fs.readdirSync(cacheDir).map(n => path.join(cacheDir, n));
  } catch { return []; }
}

async function diagnose() {
  const appSrc = path.join(appDir, 'src');
  const changed = gitChangedSinceCommit(appSrc);
  const mtimes = getLatestMtime(changed.length ? changed : listFiles(appSrc, p => p.endsWith('.ts') || p.endsWith('.tsx')));

  const pid = getDevServerPidByPort(port);
  const devStart = getProcessStartTime(pid);

  const caches = findViteCaches(appDir).flatMap(d => listCacheEntries(d));
  const cacheLatest = getLatestMtime(caches);

  const diagnosis = {
    repoRoot,
    appDir,
    port,
    devServer: { pid, startTimeMs: devStart },
    sourceLatestChangeMs: mtimes,
    viteCacheLatestMTimeMs: cacheLatest,
    suggestions: [],
  };

  // Compare server start vs source change
  if (devStart && mtimes && mtimes > devStart + 5000) {
    diagnosis.suggestions.push('dev-server-restart-recommended');
  }

  // If cache newer than server start but older than source change → cache likely stale
  if (cacheLatest && mtimes && cacheLatest + 1000 < mtimes) {
    diagnosis.suggestions.push('vite-cache-partial-prune-recommended');
  }

  // Fetch build beacon from running dev server
  const beacon = await httpGetJson(`http://127.0.0.1:${port}/__hdb_build.json`);
  diagnosis.devServer.beacon = beacon;
  if (beacon && beacon.buildTime) {
    const serverBuildMs = Date.parse(beacon.buildTime) || 0;
    if (mtimes && serverBuildMs && serverBuildMs + 2000 < mtimes) {
      diagnosis.suggestions.push('server-running-old-bundle');
    }
  }

  return diagnosis;
}


(async function main() {
  const head = await httpHead('127.0.0.1', port);
  const diag = await diagnose();
  diag.devServer.httpHead = head;

  if (outputJson) {
    console.log(JSON.stringify(diag, null, 2));
    return;
  }

  console.log('[HDB-BOOT] diagnose @ %s', nowIso());
  if (!head.ok) {
    console.log('[HDB-BOOT] dev server not responding on port %d', port);
  } else {
    console.log('[HDB-BOOT] dev server responds: status=%s date=%s', diag.devServer.httpHead.status, diag.devServer.httpHead.headers?.date || 'n/a');
  }
  console.log('[HDB-BOOT] dev pid=%s start=%s', diag.devServer.pid ?? 'n/a', diag.devServer.startTimeMs ? new Date(diag.devServer.startTimeMs).toISOString() : 'n/a');
  console.log('[HDB-BOOT] source latest mtime=%s', diag.sourceLatestChangeMs ? new Date(diag.sourceLatestChangeMs).toISOString() : 'n/a');
  console.log('[HDB-BOOT] .vite cache latest mtime=%s', diag.viteCacheLatestMTimeMs ? new Date(diag.viteCacheLatestMTimeMs).toISOString() : 'n/a');
  console.log('[HDB-BOOT] suggestions=%o', diag.suggestions);
  if (diag.devServer?.beacon) {
    console.log('[HDB-BOOT] beacon=%o', { buildTime: diag.devServer.beacon.buildTime, started: diag.devServer.beacon.serverStartedAt, pid: diag.devServer.beacon.pid });
  } else {
    console.log('[HDB-BOOT] beacon=unavailable');
  }
})();
