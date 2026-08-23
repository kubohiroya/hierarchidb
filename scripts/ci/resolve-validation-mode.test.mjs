import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyChangedPaths } from './resolve-validation-mode.mjs';
import { createTurboArguments } from './run-affected-validation.mjs';

const BASE_SHA = '1111111111111111111111111111111111111111';
const HEAD_SHA = '2222222222222222222222222222222222222222';

test('skips documentation-only changes', () => {
  assert.equal(classifyChangedPaths(['docs/ci-validation.md', 'README.md']).mode, 'skip');
});

test('skips naming audit workflow and baseline-only changes', () => {
  assert.equal(classifyChangedPaths(['.github/workflows/naming-audit.yml']).mode, 'skip');
  assert.equal(classifyChangedPaths(['.github/workflows/naming-audit-baseline.yml']).mode, 'skip');
  assert.equal(classifyChangedPaths(['scripts/naming-audit-baseline.json']).mode, 'skip');
});

test('selects affected validation for workspace-local changes', () => {
  assert.equal(
    classifyChangedPaths(['packages/core-types/src/index.ts', 'packages/core-types/README.md'])
      .mode,
    'affected'
  );
  assert.equal(
    classifyChangedPaths([
      'packages/core-types/src/index.ts',
      'scripts/naming-audit-baseline.json',
    ]).mode,
    'affected'
  );
});

test('selects full validation for repository-wide inputs', () => {
  assert.equal(
    classifyChangedPaths(['packages/core-types/src/index.ts', 'turbo.json']).mode,
    'full'
  );
  assert.equal(classifyChangedPaths(['scripts/policy/check.mjs']).mode, 'full');
});

test('keeps lockfile-only and workspace-plus-lockfile changes in affected validation', () => {
  assert.equal(classifyChangedPaths(['pnpm-lock.yaml']).mode, 'affected');
  assert.equal(
    classifyChangedPaths(['packages/core-types/src/index.ts', 'pnpm-lock.yaml']).mode,
    'affected'
  );
  assert.equal(classifyChangedPaths(['pnpm-lock.yaml', 'turbo.json']).mode, 'full');
});

test('rejects empty and invalid path lists', () => {
  assert.throws(() => classifyChangedPaths([]), /At least one changed path/u);
  assert.throws(
    () => classifyChangedPaths(['../package.json']),
    /Invalid repository-relative path/u
  );
});

test('builds an exact changed-package Turbo filter', () => {
  const args = createTurboArguments({ baseSha: BASE_SHA, headSha: HEAD_SHA });
  assert.deepEqual(args.slice(0, 6), [
    'exec',
    'turbo',
    'run',
    'typecheck',
    'test',
    '--filter',
  ]);
  assert.equal(args[6], `[${BASE_SHA}...${HEAD_SHA}]`);
  assert.equal(args[7], '--log-order=grouped');
  assert.equal(args[8], '--output-logs=errors-only');
});

test('allows affected Turbo task escalation through CI_AFFECTED_TASKS', () => {
  const previousTasks = process.env.CI_AFFECTED_TASKS;
  process.env.CI_AFFECTED_TASKS = 'build,typecheck,test,lint';
  try {
    const args = createTurboArguments({ baseSha: BASE_SHA, headSha: HEAD_SHA });
    assert.deepEqual(args.slice(3, 7), ['build', 'typecheck', 'test', 'lint']);
  } finally {
    if (previousTasks === undefined) {
      delete process.env.CI_AFFECTED_TASKS;
    } else {
      process.env.CI_AFFECTED_TASKS = previousTasks;
    }
  }
});

test('rejects missing or malformed Turbo comparison refs', () => {
  assert.throws(
    () => createTurboArguments({ baseSha: 'main', headSha: HEAD_SHA }),
    /TURBO_SCM_BASE/u
  );
  assert.throws(
    () => createTurboArguments({ baseSha: BASE_SHA, headSha: undefined }),
    /TURBO_SCM_HEAD/u
  );
});
