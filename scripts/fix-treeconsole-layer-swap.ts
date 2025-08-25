#!/usr/bin/env tsx

/**
 * Fix TreeConsole layer swap - base should be at layer 13, components at layer 12
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
} as const;

const log = {
  info: (msg: string) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}✗${colors.reset} ${msg}`)
};

// Package name updates after layer swap
const PACKAGE_RENAMES = new Map<string, string>([
  // Base moves from 12 to 13
  ['@hierarchidb/12-ui-treeconsole-base', '@hierarchidb/13-ui-treeconsole-base'],
  // Components move from 13 to 12
  ['@hierarchidb/13-ui-treeconsole-breadcrumb', '@hierarchidb/12-ui-treeconsole-breadcrumb'],
  ['@hierarchidb/13-ui-treeconsole-footer', '@hierarchidb/12-ui-treeconsole-footer'],
  ['@hierarchidb/13-ui-treeconsole-speeddial', '@hierarchidb/12-ui-treeconsole-speeddial'],
  ['@hierarchidb/13-ui-treeconsole-toolbar', '@hierarchidb/12-ui-treeconsole-toolbar'],
  ['@hierarchidb/13-ui-treeconsole-trashbin', '@hierarchidb/12-ui-treeconsole-trashbin'],
  ['@hierarchidb/13-ui-treeconsole-treetable', '@hierarchidb/12-ui-treeconsole-treetable']
]);

async function updateAllPackageJsonFiles(): Promise<void> {
  log.info('Updating all package.json files...');
  
  const packageJsonFiles = await glob('packages/**/package.json', {
    ignore: ['**/node_modules/**', '**/dist/**']
  });
  
  let updatedCount = 0;
  
  for (const file of packageJsonFiles) {
    try {
      const content = await fs.promises.readFile(file, 'utf8');
      const pkg = JSON.parse(content);
      let modified = false;
      
      // Update package name if it matches
      for (const [oldName, newName] of PACKAGE_RENAMES.entries()) {
        if (pkg.name === oldName) {
          pkg.name = newName;
          modified = true;
          break;
        }
      }
      
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
        await fs.promises.writeFile(file, JSON.stringify(pkg, null, 2) + '\n');
        log.success(`Updated: ${file}`);
        updatedCount++;
      }
    } catch (error) {
      log.error(`Failed to update ${file}: ${error}`);
    }
  }
  
  log.info(`Updated ${updatedCount} package.json files`);
}

async function updateAllImports(): Promise<void> {
  log.info('Updating import statements...');
  
  const sourceFiles = await glob('packages/**/*.{ts,tsx,js,jsx,mjs,cjs}', {
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
  });
  
  let updatedCount = 0;
  
  for (const file of sourceFiles) {
    try {
      let content = await fs.promises.readFile(file, 'utf8');
      let modified = false;
      
      for (const [oldName, newName] of PACKAGE_RENAMES.entries()) {
        const patterns = [
          new RegExp(`(from\\s+['"])${escapeRegex(oldName)}(['"/])`, 'g'),
          new RegExp(`(import\\s*\\(\\s*['"])${escapeRegex(oldName)}(['"/])`, 'g'),
          new RegExp(`(require\\s*\\(\\s*['"])${escapeRegex(oldName)}(['"/])`, 'g')
        ];
        
        for (const regex of patterns) {
          if (regex.test(content)) {
            content = content.replace(regex, `$1${newName}$2`);
            modified = true;
          }
        }
      }
      
      if (modified) {
        await fs.promises.writeFile(file, content);
        log.success(`Updated imports in: ${file}`);
        updatedCount++;
      }
    } catch (error) {
      log.error(`Failed to update ${file}: ${error}`);
    }
  }
  
  log.info(`Updated ${updatedCount} source files`);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function main(): Promise<void> {
  console.log('\n=== Fixing TreeConsole Layer Swap ===\n');
  
  await updateAllPackageJsonFiles();
  await updateAllImports();
  
  log.success('\nLayer swap complete!');
  log.info('Next: Run "pnpm install" and check with "tsx scripts/check-dependency-rules.ts"');
}

main().catch(error => {
  log.error(`Fatal error: ${error}`);
  process.exit(1);
});