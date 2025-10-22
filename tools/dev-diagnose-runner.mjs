#!/usr/bin/env node
/**
 * Script: tools/dev-diagnose-runner.mjs
 * Purpose: orchestrates the "diagnose staleness" → optional auto-fix → dev
 * server boot flow used by `pnpm dev:diagnose` when local IndexedDB/cache
 * issues surface.
 * Invocation: executed via the root script `pnpm dev:diagnose`, which runs
 * `node tools/dev-diagnose-runner.mjs` from the workspace root.
 * Output: consumes the JSON emitted by `tools/hdb-diagnose-staleness.mjs`. It
 * does not emit persistent files; it only starts the dev server or prints logs
 * to stdout/stderr.
 */
import { spawnSync, spawn } from 'child_process';
import path from 'path';
import process from 'process';

const repoRoot = process.cwd();
const appDir = process.env.HDB_APP_DIR || 'app';
const port = Number(process.env.HDB_PORT || 4200);

function runNode(script, args = []) {
  const p = spawnSync(process.execPath, [script, ...args], { stdio: ['ignore', 'pipe', 'inherit'] });
  if (p.error) throw p.error;
  return p.stdout?.toString() || '';
}

function log(...args) { console.log('[HDB-BOOT]', ...args); }

function startDev() {
  log('starting dev server...');
  const child = spawn('pnpm', ['dev'], { stdio: 'inherit', cwd: repoRoot, env: process.env });
  child.on('exit', (code) => process.exit(code ?? 0));
}

(function main() {
  log('diagnose running...');
  const diagJson = runNode(path.join('tools', 'hdb-diagnose-staleness.mjs'), ['--app', 'app', '--port', String(port), '--json']);
  let diag = {};
  try { diag = JSON.parse(diagJson); } catch { log('diagnose parse failed'); }

  const suggestions = new Set(diag?.suggestions || []);
  const serverOk = Boolean(diag?.devServer?.httpHead?.ok);

  // Decide machine-fixable actions
  const fixes = [];
  if (suggestions.has('vite-cache-partial-prune-recommended')) fixes.push('prune-cache');
  if (suggestions.has('dev-server-restart-recommended') || !serverOk) fixes.push('restart-dev');

  // If server is clearly running an old bundle, fail-fast unless --auto-fix is provided
  if (suggestions.has('server-running-old-bundle') && !process.argv.includes('--auto-fix')) {
    log('ERROR: dev server is serving an older bundle than local sources.');
    log('Guide:');
    log('- Close the dev server (Ctrl+C)');
    log('- Run: node tools/hdb-fix-staleness.mjs --app app --prune-cache --bump-fingerprint');
    log('- Then: pnpm dev');
    process.exit(2);
  }

  if (fixes.length === 0 && !process.argv.includes('--auto-fix')) {
    // No machine fix necessary. Provide guidance and exit.
    log('no machine-fixable issues detected.');
    log('tips:');
    log('- If browser shows stale bundle, hard reload with cache disabled.');
    log('- If worker looks stale, run: node tools/hdb-fix-staleness.mjs --bump-fingerprint');
    return;
  }

  // Execute fixes
  const fixArgs = [];
  if (fixes.includes('prune-cache')) fixArgs.push('--prune-cache');
  if (fixes.includes('restart-dev')) fixArgs.push('--restart-dev');
  // Always bump fingerprint to force HMR after cache prune/restart
  fixArgs.push('--bump-fingerprint');

  log('applying fixes:', fixArgs.join(' '));
  runNode(path.join('tools','hdb-fix-staleness.mjs'), ['--app', 'app', '--port', String(port), ...fixArgs]);

  // Start dev server after fixes
  startDev();
})();
