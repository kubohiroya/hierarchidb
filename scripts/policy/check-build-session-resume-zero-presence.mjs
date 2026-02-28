#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const scopedPaths = ['app/src', 'packages', 'plugins'];

const patterns = [
  { name: 'resumeBuildSession', regex: '\\bresumeBuildSession\\b' },
  { name: 'session/resume', regex: '\\bsession/resume\\b' },
  { name: 'performResume', regex: '\\bperformResume\\b' },
];

const violations = [];
for (const pattern of patterns) {
  const result = spawnSync(
    'rg',
    [
      '-n',
      '--no-heading',
      '--glob',
      '!**/__tests__/**',
      '--glob',
      '!**/*.{test,spec}.{ts,tsx,js,jsx}',
      '--glob',
      '!**/test-shims/**',
      '--glob',
      '*.{ts,tsx,js,jsx,mts,cts}',
      pattern.regex,
      ...scopedPaths,
    ],
    { encoding: 'utf8' },
  );

  if (typeof result.status !== 'number') {
    throw new Error(`failed to execute rg: ${result.error?.message ?? 'unknown error'}`);
  }

  if (result.status !== 0 && result.status !== 1) {
    throw new Error((result.stderr || result.stdout || 'rg failed').trim());
  }

  const matches = (result.stdout || '')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  if (matches.length > 0) {
    violations.push({ token: pattern.name, matches });
  }
}

if (violations.length === 0) {
  console.log('[policy] legacy resume control token zero-presence check passed');
  process.exit(0);
}

console.error('[policy] ERROR: legacy resume control tokens must not appear in runtime/UI/plugin source code');
for (const violation of violations) {
  console.error(`- ${violation.token}`);
  for (const line of violation.matches) {
    console.error(`  ${line}`);
  }
}
process.exit(1);
