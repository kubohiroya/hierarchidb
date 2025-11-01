#!/usr/bin/env node
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const DEPENDENCY_PACKAGES = [
  { name: '@hierarchidb/components', dir: 'packages/components' },
  { name: '@hierarchidb/plugin-ui-host', dir: 'packages/plugin-ui-host' },
  { name: '@hierarchidb/ui-auth', dir: 'packages/ui/auth' },
  { name: '@hierarchidb/ui-dialog', dir: 'packages/ui/dialog' },
  { name: '@hierarchidb/ui-icon', dir: 'packages/ui/icon' },
  { name: '@hierarchidb/ui-i18n', dir: 'packages/ui/i18n' },
  { name: '@hierarchidb/ui-layout', dir: 'packages/ui/layout' },
  { name: '@hierarchidb/ui-map', dir: 'packages/ui/map' },
  { name: '@hierarchidb/ui-navigation', dir: 'packages/ui/navigation' },
  { name: '@hierarchidb/ui-routing', dir: 'packages/ui/routing' },
  { name: '@hierarchidb/ui-theme', dir: 'packages/ui/theme' },
  { name: '@hierarchidb/ui-tour', dir: 'packages/ui/tour' },
  { name: '@hierarchidb/ui-treeconsole-base', dir: 'packages/ui/treeconsole/base' },
  { name: '@hierarchidb/ui-treeconsole-breadcrumb', dir: 'packages/ui/treeconsole/breadcrumb' },
  { name: '@hierarchidb/ui-treeconsole-toolbar', dir: 'packages/ui/treeconsole/toolbar' },
  { name: '@hierarchidb/ui-treeconsole-treetable', dir: 'packages/ui/treeconsole/treetable' },
  { name: '@hierarchidb/ui-usermenu', dir: 'packages/ui/usermenu' },
  { name: '@hierarchidb/plugin-ui-sdk', dir: 'packages/plugin-ui-sdk' },
  { name: '@hierarchidb/plugin-base', dir: 'packages/plugin-base' },
  { name: '@hierarchidb/plugin-presentation', dir: 'packages/plugin-presentation' },
  { name: '@hierarchidb/common-api', dir: 'packages/common/api' },
  { name: '@hierarchidb/common-types', dir: 'packages/common/types' },
  { name: '@hierarchidb/util', dir: 'packages/util' }
];

const args = new Set(process.argv.slice(2));
const force = args.has('--force');

const pnpmEnv = {
  ...process.env,
  PNPM_REPORTER: process.env.PNPM_REPORTER ?? 'append-only'
};

const stripDotPrefix = (value) => (value.startsWith('./') ? value.slice(2) : value);

const resolveTypesEntry = (pkgJson) => {
  if (typeof pkgJson.types === 'string') return stripDotPrefix(pkgJson.types);
  const exportTypes = pkgJson?.exports?.['.']?.types;
  if (typeof exportTypes === 'string') return stripDotPrefix(exportTypes);
  return 'dist/index.d.ts';
};

const needsBuild = (pkg) => {
  try {
    const packageJsonPath = path.join(ROOT_DIR, pkg.dir, 'package.json');
    const pkgJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const typesEntry = resolveTypesEntry(pkgJson);
    const typesPath = path.join(ROOT_DIR, pkg.dir, typesEntry);
    return force || !fs.existsSync(typesPath);
  } catch (error) {
    console.warn(`[ui-shell-pretypecheck] Unable to inspect ${pkg.name}: ${error.message}`);
    return true;
  }
};

const buildPackage = (pkg) => {
  console.log(`[ui-shell-pretypecheck] building ${pkg.name}`);
  const result = spawnSync('pnpm', ['--filter', pkg.name, 'build'], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    env: pnpmEnv
  });

  if (result.status !== 0) {
    throw new Error(`${pkg.name} build failed with exit code ${result.status}`);
  }
};

const targets = DEPENDENCY_PACKAGES.filter(needsBuild);

if (targets.length === 0) {
  console.log('[ui-shell-pretypecheck] all dependency artifacts present, skipping builds');
  process.exit(0);
}

try {
  for (const pkg of targets) {
    buildPackage(pkg);
  }
  console.log('[ui-shell-pretypecheck] dependency builds completed');
} catch (error) {
  console.error(`[ui-shell-pretypecheck] ${error.message}`);
  process.exit(1);
}
