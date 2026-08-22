import { spawnSync } from 'node:child_process';

const PLAYWRIGHT_TARGET = 'e2e/shape/shape-build-session-lifecycle.spec.ts';
const fastArtifacts = process.env.SHAPE_E2E_FAST_ARTIFACTS || '1';

const env = {
  ...process.env,
  HIERARCHIDB_E2E: process.env.HIERARCHIDB_E2E || '1',
  HIERARCHIDB_E2E_FAST_ARTIFACTS: fastArtifacts,
};
const rawForwardedArgs = process.argv.slice(2);
const forwardedArgs = rawForwardedArgs[0] === '--' ? rawForwardedArgs.slice(1) : rawForwardedArgs;
const testTimeout = process.env.SHAPE_E2E_TEST_TIMEOUT_MS || '120000';
const globalTimeout = process.env.SHAPE_E2E_GLOBAL_TIMEOUT_MS || '180000';
const traceMode =
  process.env.SHAPE_E2E_TRACE_MODE || (fastArtifacts === '1' ? 'off' : 'retain-on-failure');
const args = [
  'exec',
  'playwright',
  'test',
  PLAYWRIGHT_TARGET,
  '--project=chromium',
  '--workers=1',
  `--timeout=${testTimeout}`,
  `--global-timeout=${globalTimeout}`,
  `--trace=${traceMode}`,
  ...forwardedArgs,
];
const result = spawnSync('pnpm', args, {
  stdio: 'inherit',
  env,
});

process.exit(result.status ?? 1);
