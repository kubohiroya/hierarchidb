#!/usr/bin/env tsx

/**
 * Fix remaining packages that weren't migrated yet
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
} as const;

const log = {
  info: (msg: string) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
};

// Package name mappings - only the renames, not the moves
const PACKAGE_RENAMES = new Map<string, string>([
  ['@hierarchidb/common-core', '@hierarchidb/00-core'],
  ['@hierarchidb/common-api', '@hierarchidb/01-api'],
  ['@hierarchidb/runtime-worker', '@hierarchidb/02-worker'],
  ['@hierarchidb/ui-core', '@hierarchidb/10-ui-core'],
  ['@hierarchidb/ui-client', '@hierarchidb/10-ui-client'],
  ['@hierarchidb/ui-auth', '@hierarchidb/10-ui-auth'],
  ['@hierarchidb/ui-i18n', '@hierarchidb/10-ui-i18n'],
  ['@hierarchidb/ui-routing', '@hierarchidb/10-ui-routing'],
  ['@hierarchidb/ui-layout', '@hierarchidb/11-ui-layout'],
  ['@hierarchidb/ui-navigation', '@hierarchidb/11-ui-navigation'],
  ['@hierarchidb/ui-file', '@hierarchidb/11-ui-file'],
  ['@hierarchidb/ui-monitoring', '@hierarchidb/11-ui-monitoring'],
  ['@hierarchidb/ui-tour', '@hierarchidb/11-ui-tour'],
  ['@hierarchidb/ui-usermenu', '@hierarchidb/11-ui-usermenu'],
  ['@hierarchidb/ui-treeconsole-base', '@hierarchidb/12-ui-treeconsole-base'],
  ['@hierarchidb/plugin-basemap', '@hierarchidb/20-plugin-basemap'],
  ['@hierarchidb/plugin-stylemap', '@hierarchidb/20-plugin-stylemap'],
  ['@hierarchidb/plugin-import-export', '@hierarchidb/20-plugin-import-export'],
  ['@hierarchidb/_app', '@hierarchidb/30-_app'],
  ['@hierarchidb/backend-bff', '@hierarchidb/bff'],
  ['@hierarchidb/backend-cors-proxy', '@hierarchidb/cors-proxy'],
]);

async function updatePackageJson(filePath: string): Promise<boolean> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf8');
    const pkg = JSON.parse(content);
    let modified = false;

    // Update dependencies
    const depTypes = ['dependencies', 'devDependencies', 'peerDependencies'] as const;
    for (const depType of depTypes) {
      if (pkg[depType]) {
        const newDeps: Record<string, string> = {};
        for (const [dep, version] of Object.entries(pkg[depType] as Record<string, string>)) {
          const newDep = PACKAGE_RENAMES.get(dep) || dep;
          newDeps[newDep] = version;
          if (newDep !== dep) {
            modified = true;
          }
        }
        pkg[depType] = newDeps;
      }
    }

    if (modified) {
      await fs.promises.writeFile(filePath, JSON.stringify(pkg, null, 2) + '\n');
      log.success(`Updated: ${filePath}`);
      return true;
    }

    return false;
  } catch (error) {
    log.error(`Failed to update ${filePath}: ${error}`);
    return false;
  }
}

async function updateSourceFile(filePath: string): Promise<boolean> {
  try {
    let content = await fs.promises.readFile(filePath, 'utf8');
    let modified = false;

    for (const [oldName, newName] of PACKAGE_RENAMES.entries()) {
      const patterns = [
        new RegExp(`(from\\s+['"])${escapeRegex(oldName)}(['"/])`, 'g'),
        new RegExp(`(import\\s*\\(\\s*['"])${escapeRegex(oldName)}(['"/])`, 'g'),
        new RegExp(`(require\\s*\\(\\s*['"])${escapeRegex(oldName)}(['"/])`, 'g'),
        new RegExp(`(import\\s+['"])${escapeRegex(oldName)}(['"/])`, 'g'),
      ];

      for (const regex of patterns) {
        if (regex.test(content)) {
          content = content.replace(regex, `$1${newName}$2`);
          modified = true;
        }
      }
    }

    if (modified) {
      await fs.promises.writeFile(filePath, content);
      log.success(`Updated imports in: ${filePath}`);
      return true;
    }

    return false;
  } catch (error) {
    log.error(`Failed to update ${filePath}: ${error}`);
    return false;
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function main() {
  console.log('\n=== Fixing Remaining Package References ===\n');

  // Find all package.json files
  log.info('Updating package.json files...');
  const packageJsonFiles = await glob('packages/**/package.json', {
    ignore: ['**/node_modules/**', '**/dist/**'],
  });

  let updatedPackageCount = 0;
  for (const file of packageJsonFiles) {
    if (await updatePackageJson(file)) {
      updatedPackageCount++;
    }
  }
  log.info(`Updated ${updatedPackageCount} package.json files\n`);

  // Find all source files
  log.info('Updating import statements...');
  const sourceFiles = await glob('packages/**/*.{ts,tsx,js,jsx,mjs,cjs}', {
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
  });

  let updatedSourceCount = 0;
  for (const file of sourceFiles) {
    if (await updateSourceFile(file)) {
      updatedSourceCount++;
    }
  }
  log.info(`Updated ${updatedSourceCount} source files\n`);

  log.success('Fix complete!');
  log.info('\nNext: Run "pnpm install" to verify all dependencies are resolved.');
}

main().catch((error) => {
  log.error(`Fatal error: ${error}`);
  process.exit(1);
});
