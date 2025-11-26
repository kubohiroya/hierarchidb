#!/usr/bin/env node
/**
 * Runs the dependency guard script after scrubbing npm/pnpm env configs that
 * cause noisy warnings in npm CLI (e.g. verify-deps-before-run, _jsr-registry).
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

for (const key of sanitizedKeys) {
  if (key in process.env) {
    delete process.env[key];
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const target = path.join(__dirname, 'run-dep-fence-extra.mjs');

await import(pathToFileURL(target).href);
