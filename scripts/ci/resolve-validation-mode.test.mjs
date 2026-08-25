import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { classifyChangedPaths } from './resolve-validation-mode.mjs';
import { selectRelatedTests } from './run-affected-fast-tests.mjs';
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
    classifyChangedPaths(['packages/core-types/src/index.ts', 'scripts/naming-audit-baseline.json'])
      .mode,
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
  assert.deepEqual(args.slice(0, 5), ['exec', 'turbo', 'run', 'typecheck', '--filter']);
  assert.equal(args[5], `[${BASE_SHA}...${HEAD_SHA}]`);
  assert.equal(args[6], '--log-order=grouped');
  assert.equal(args[7], '--output-logs=errors-only');
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

test('selects changed and related package tests for fast PR validation', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'hdb-ci-fast-tests-'));
  mkdirSync(path.join(cwd, 'plugins/example-plugin/src/common/__tests__'), { recursive: true });
  writeFileSync(
    path.join(cwd, 'plugins/example-plugin/package.json'),
    JSON.stringify({ name: '@hierarchidb/example-plugin' })
  );
  writeFileSync(
    path.join(cwd, 'plugins/example-plugin/src/common/featureTableEditAdapters.ts'),
    ''
  );
  writeFileSync(
    path.join(
      cwd,
      'plugins/example-plugin/src/common/__tests__/featureTableEditAdapters.unit.test.ts'
    ),
    ''
  );
  writeFileSync(
    path.join(cwd, 'plugins/example-plugin/src/common/__tests__/unrelated.unit.test.ts'),
    ''
  );

  const [selection] = selectRelatedTests({
    cwd,
    changedPaths: ['plugins/example-plugin/src/common/featureTableEditAdapters.ts'],
  });
  assert.equal(selection?.packageName, '@hierarchidb/example-plugin');
  assert.deepEqual(selection?.relatedTests, [
    'plugins/example-plugin/src/common/__tests__/featureTableEditAdapters.unit.test.ts',
  ]);
});

test('selects changed test files directly for fast PR validation', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'hdb-ci-changed-tests-'));
  mkdirSync(path.join(cwd, 'packages/example/src/__tests__'), { recursive: true });
  writeFileSync(
    path.join(cwd, 'packages/example/package.json'),
    JSON.stringify({ name: '@hierarchidb/example' })
  );
  writeFileSync(path.join(cwd, 'packages/example/src/__tests__/changed.unit.test.ts'), '');

  const [selection] = selectRelatedTests({
    cwd,
    changedPaths: ['packages/example/src/__tests__/changed.unit.test.ts'],
  });
  assert.deepEqual(selection?.relatedTests, [
    'packages/example/src/__tests__/changed.unit.test.ts',
  ]);
});

test('marks selected test packages without test scripts as non-runnable', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'hdb-ci-missing-test-script-'));
  mkdirSync(path.join(cwd, 'packages/example/src/__tests__'), { recursive: true });
  writeFileSync(
    path.join(cwd, 'packages/example/package.json'),
    JSON.stringify({ name: '@hierarchidb/example' })
  );
  writeFileSync(path.join(cwd, 'packages/example/src/__tests__/changed.unit.test.ts'), '');

  const [selection] = selectRelatedTests({
    cwd,
    changedPaths: ['packages/example/src/__tests__/changed.unit.test.ts'],
  });
  assert.equal(selection?.hasTestScript, false);
  assert.deepEqual(selection?.relatedTests, [
    'packages/example/src/__tests__/changed.unit.test.ts',
  ]);
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
