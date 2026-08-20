import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyChangedPaths } from './resolve-validation-mode.mjs';
import { createTurboArguments } from './run-affected-validation.mjs';

const BASE_SHA = '1111111111111111111111111111111111111111';
const HEAD_SHA = '2222222222222222222222222222222222222222';

test('skips documentation-only changes', () => {
  assert.equal(classifyChangedPaths(['docs/ci-validation.md', 'README.md']).mode, 'skip');
});

test('selects affected validation for workspace-local changes', () => {
  assert.equal(
    classifyChangedPaths(['packages/core-types/src/index.ts', 'packages/core-types/README.md'])
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

test('rejects empty and invalid path lists', () => {
  assert.throws(() => classifyChangedPaths([]), /At least one changed path/u);
  assert.throws(
    () => classifyChangedPaths(['../package.json']),
    /Invalid repository-relative path/u
  );
});

test('builds an exact changed-package Turbo filter', () => {
  const args = createTurboArguments({ baseSha: BASE_SHA, headSha: HEAD_SHA });
  assert.deepEqual(args.slice(0, 8), [
    'exec',
    'turbo',
    'run',
    'build',
    'typecheck',
    'test',
    'lint',
    '--filter',
  ]);
  assert.equal(args[8], `[${BASE_SHA}...${HEAD_SHA}]`);
  assert.equal(args[9], '--log-order=grouped');
  assert.equal(args[10], '--output-logs=errors-only');
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
