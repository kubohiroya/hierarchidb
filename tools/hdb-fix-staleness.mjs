#!/usr/bin/env node
/**
 * Script: tools/hdb-fix-staleness.mjs
 * Purpose: apply targeted clean-up actions (bump app build fingerprint, prune
 * Vite cache, restart dev server) after diagnosis flags stale bundles.
 * Invocation: triggered by `tools/dev-diagnose-runner.mjs` when it receives
 * suggestions from `hdb-diagnose-staleness`, or run manually with flags such as
 * `--bump-fingerprint` / `--prune-cache`.
 * Output: updates files in-place (`app/src/version.ts`) and removes cache
 * directories under `.vite` depending on flags; no additional artefacts are
 * written.
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const args = new Map(process.argv.slice(2).flatMap((a) => {
  const m = a.match(/^--([^=]+)(=(.*))?$/);
  if (m) return [[m[1], m[3] ?? 'true']];
  return [];
}));

const repoRoot = process.cwd();
const appDir = path.resolve(repoRoot, args.get('app') || 'app');
const port = Number(args.get('port') || 4200);

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

function bumpFingerprint() {
  const versionFile = path.join(appDir, 'src/version.ts');
  const now = new Date().toISOString();
  try {
    fs.appendFileSync(versionFile, `\n// HMR-FINGERPRINT ${now}\n`);
    console.log('[HDB-BOOT] bump-fingerprint appended to version.ts %s', now);
  } catch (e) {
    console.log('[HDB-BOOT] bump-fingerprint failed %o', e);
  }
}

function pruneCache() {
  const candidates = [
    path.join(appDir, 'node_modules/.vite'),
    path.join(repoRoot, 'node_modules/.vite'),
  ];
  let removed = 0;
  for (const dir of candidates) {
    if (!fs.existsSync(dir)) continue;
    const entries = fs.readdirSync(dir);
    for (const name of entries) {
      if (/^@?hierarchidb|^react|^vite|^comlink|app/i.test(name)) {
        try {
          fs.rmSync(path.join(dir, name), { recursive: true, force: true });
          removed++;
        } catch {}
      }
    }
  }
  console.log('[HDB-BOOT] prune-cache removed entries=%d', removed);
}

function restartDev() {
  const pid = getDevServerPidByPort(port);
  if (!pid) {
    console.log('[HDB-BOOT] restart-dev: no process on port %d', port);
    return;
  }
  try {
    process.kill(pid);
    console.log('[HDB-BOOT] restart-dev: killed pid=%d', pid);
  } catch (e) {
    console.log('[HDB-BOOT] restart-dev: failed to kill pid=%d %o', pid, e);
  }
}

if (args.get('bump-fingerprint') === 'true') bumpFingerprint();
if (args.get('prune-cache') === 'true') pruneCache();
if (args.get('restart-dev') === 'true') restartDev();
