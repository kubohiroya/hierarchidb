#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const logPath = path.resolve(repoRoot, '.this-trace.log');

if (fs.existsSync(logPath)) {
  fs.rmSync(logPath);
}

console.log('[trace-this] running Vite stage with TRACE_THIS=1 ...');
const result = spawnSync('pnpm', ['-C', 'app', 'build'], {
  env: { ...process.env, TRACE_THIS: '1' },
  stdio: 'inherit',
});

if (!fs.existsSync(logPath)) {
  console.error('[trace-this] trace log not found. Did the plugin run?');
  process.exit(1);
}

const logLines = fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean);
const hits = logLines.filter((line) => line.includes('HIT transform'));

console.log('\n=== trace summary ===');
console.log(`[trace-this] build exit code: ${result.status ?? 'unknown'}`);
console.log(`[trace-this] log entries: ${logLines.length}`);

if (hits.length === 0) {
  console.log('[trace-this] no HIT lines detected. review load entries in the log for clues.');
  process.exit(result.status === 0 ? 0 : 1);
}

console.log('\nModules returning only "this":');
for (const line of hits) {
  console.log(`  ${line}`);
}
