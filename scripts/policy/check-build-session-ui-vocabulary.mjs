#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const checks = [
  {
    name: 'UI must not use legacy startup step token session-resume-request',
    pattern: '\\bsession-resume-request\\b',
    paths: [
      'app/src',
      'packages/ui/build-sessions/src',
      'packages/plugin-ui-host/src',
      'plugins/shape-plugin/src/ui',
    ],
  },
  {
    name: 'Shape build-progress internal path must not depend on refreshTasks',
    pattern: '\\brefreshTasks\\b',
    paths: ['plugins/shape-plugin/src/ui/components/build-progress/internal'],
  },
];

function runRipgrep(pattern, paths) {
  const result = spawnSync(
    'rg',
    [
      '-n',
      '--no-heading',
      '--glob',
      '!**/__tests__/**',
      '--glob',
      '!**/test-shims/**',
      pattern,
      ...paths,
    ],
    { encoding: 'utf8' },
  );

  if (typeof result.status !== 'number') {
    throw new Error(`failed to execute rg: ${result.error?.message ?? 'unknown error'}`);
  }

  if (result.status === 1) {
    return [];
  }

  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'rg failed').trim());
  }

  return result.stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

const violations = [];
for (const check of checks) {
  const matches = runRipgrep(check.pattern, check.paths);
  if (matches.length > 0) {
    violations.push({ name: check.name, matches });
  }
}

if (violations.length === 0) {
  console.log('[policy] build-session UI vocabulary checks passed');
  process.exit(0);
}

console.error('[policy] ERROR: build-session UI vocabulary checks failed');
for (const violation of violations) {
  console.error(`- ${violation.name}`);
  for (const line of violation.matches) {
    console.error(`  ${line}`);
  }
}
process.exit(1);
