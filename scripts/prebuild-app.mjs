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

const result = spawnSync('pnpm', args, { stdio: 'inherit', shell: false });

if (result.error) {
  console.error('[prebuild@app] Failed to invoke pnpm:', result.error);
  process.exit(result.status ?? 1);
}

if (typeof result.status === 'number') {
  process.exit(result.status);
}

if (result.signal) {
  process.kill(process.pid, result.signal);
}
