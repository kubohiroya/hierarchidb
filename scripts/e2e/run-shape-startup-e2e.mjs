import { spawnSync } from 'node:child_process';

const PLAYWRIGHT_TARGET = 'e2e/shape/shape-build-startup-receiving-task-snapshot.spec.ts';

const env = {
  ...process.env,
  HIERARCHIDB_E2E: process.env.HIERARCHIDB_E2E || '1',
};
const rawForwardedArgs = process.argv.slice(2);
const forwardedArgs =
  rawForwardedArgs[0] === '--' ? rawForwardedArgs.slice(1) : rawForwardedArgs;
const args = [
  'exec',
  'playwright',
  'test',
  PLAYWRIGHT_TARGET,
  '--project=chromium',
  ...forwardedArgs,
];
const result = spawnSync('pnpm', args, {
  stdio: 'inherit',
  env,
});

process.exit(result.status ?? 1);
