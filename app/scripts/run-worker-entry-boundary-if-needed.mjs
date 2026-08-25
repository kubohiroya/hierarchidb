import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPOSITORY_ROOT = resolve(APP_ROOT, '..');
const BOUNDARY_TEST_SCRIPT = 'scripts/worker-entry-boundary-verifier.node.mjs';
const RELEVANT_PATH_PREFIXES = [
  'app/package.json',
  'app/scripts/run-worker-entry-boundary-if-needed.mjs',
  'app/scripts/verify-worker-entry-boundary.mjs',
  'app/scripts/worker-entry-boundary-verifier.mjs',
  'app/scripts/worker-entry-boundary-verifier.node.mjs',
  'app/src/worker-runtime/',
  'app/vite.config.ts',
];

const runBoundaryTest = () => {
  const result = spawnSync('node', ['--test', BOUNDARY_TEST_SCRIPT], {
    cwd: APP_ROOT,
    stdio: 'inherit',
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  if (result.signal !== null) {
    throw new Error(`Worker entry boundary test terminated by signal ${result.signal}.`);
  }
  if (result.status === null) {
    throw new Error('Worker entry boundary test exited without a status code.');
  }
  return result.status;
};

const readAffectedComparison = () => {
  const baseSha = process.env.TURBO_SCM_BASE;
  const headSha = process.env.TURBO_SCM_HEAD;
  if (baseSha === undefined && headSha === undefined) {
    return undefined;
  }
  if (
    typeof baseSha !== 'string' ||
    typeof headSha !== 'string' ||
    !/^[0-9a-f]{40}$/u.test(baseSha) ||
    !/^[0-9a-f]{40}$/u.test(headSha)
  ) {
    throw new TypeError('TURBO_SCM_BASE and TURBO_SCM_HEAD must be lowercase 40-character SHAs.');
  }
  return { baseSha, headSha };
};

const changedPaths = ({ baseSha, headSha }) => {
  const result = spawnSync(
    'git',
    ['diff', '--name-only', '--no-renames', '-z', baseSha, headSha, '--'],
    {
      cwd: REPOSITORY_ROOT,
      encoding: 'buffer',
      stdio: ['ignore', 'pipe', 'inherit'],
    }
  );
  if (result.error !== undefined) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `Failed to read changed paths for worker entry boundary test: ${result.status}`
    );
  }
  return result.stdout
    .toString('utf8')
    .split('\0')
    .filter((filePath) => filePath.length > 0);
};

const isRelevantPath = (filePath) =>
  RELEVANT_PATH_PREFIXES.some((prefix) =>
    prefix.endsWith('/') ? filePath.startsWith(prefix) : filePath === prefix
  );

try {
  const comparison = readAffectedComparison();
  if (comparison === undefined) {
    process.exitCode = runBoundaryTest();
  } else if (changedPaths(comparison).some(isRelevantPath)) {
    process.exitCode = runBoundaryTest();
  } else {
    console.log('[worker-entry-boundary] skipped; affected diff does not touch boundary inputs.');
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[worker-entry-boundary] ${message}`);
  process.exitCode = 1;
}
