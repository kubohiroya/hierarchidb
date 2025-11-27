#!/usr/bin/env node
/**
 * Strip noisy npm/pnpm env config keys before spawning a child command.
 * Prevents npm v11+ from printing "Unknown env config" warnings.
 */
import { spawn } from 'node:child_process';

const [, , cmd, ...cmdArgs] = process.argv;
if (!cmd) {
  console.error('Usage: node scripts/with-clean-npm-config.mjs <cmd> [...args]');
  process.exit(1);
}

const sanitizedKeys = [
  'npm_config_verify_deps_before_run',
  'npm_config__jsr_registry',
  'npm_config_npm_globalconfig',
  'NPM_CONFIG_VERIFY_DEPS_BEFORE_RUN',
  'NPM_CONFIG__JSR_REGISTRY',
  'NPM_CONFIG_NPM_GLOBALCONFIG',
  'pnpm_config_verify_deps_before_run',
  'pnpm_config__jsr_registry',
  'PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN',
  'PNPM_CONFIG__JSR_REGISTRY',
  'pnpm_config_npm_globalconfig',
  'PNPM_CONFIG_NPM_GLOBALCONFIG',
];

const env = { ...process.env };
for (const key of sanitizedKeys) {
  if (key in env) {
    delete env[key];
  }
}

const child = spawn(cmd, cmdArgs, {
  env,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
