#!/usr/bin/env node
// scripts/prebuild-app.mjs — guard the app prebuild hook.
// Purpose: skip the expensive dependency rebuild when Turborepo is orchestrating tasks.
// Context: turborepo already ensures dependency builds; we only need the manual fallback when running outside turbo.

import { spawnSync } from 'node:child_process';

const isTurbo = Boolean(process.env.TURBO_HASH);

if (isTurbo) {
  console.log('[prebuild@app] TURBO_HASH detected — skipping dependency builds because Turborepo handles them.');
  process.exit(0);
}

const args = [
  '-w',
  'run',
  '-r',
  '--workspace-concurrency=1',
  '--filter',
  '@hierarchidb/app^...',
  '--filter',
  '!@hierarchidb/app',
  '--filter',
  '!hierarchidb',
  'build',
];

console.log('[prebuild@app] Dependency build開始: ワークスペースをシリアルにビルドします。少々お待ちください…');
const startedAt = Date.now();

const result = spawnSync('pnpm', args, { stdio: 'inherit', shell: false });

const elapsedMs = Date.now() - startedAt;

if (result.error) {
  console.error('[prebuild@app] Failed to invoke pnpm:', result.error);
  process.exit(result.status ?? 1);
}

if (typeof result.status === 'number') {
  if (result.status === 0) {
    console.log(`[prebuild@app] 依存ビルド完了 (${Math.round(elapsedMs / 1000)}s)。`);
  }
  process.exit(result.status);
}

if (result.signal) {
  process.kill(process.pid, result.signal);
}
