#!/usr/bin/env tsx

/**
 * Fix TreeConsole sub-packages and other remaining packages
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

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

interface PackageMove {
  old: string;
  new: string;
  oldName: string;
  newName: string;
}

const PACKAGE_MOVES: PackageMove[] = [
  // Move ui/theme to 10-level (foundation)
  {
    old: 'packages/ui/theme',
    new: 'packages/10-ui-theme',
    oldName: '@hierarchidb/ui-theme',
    newName: '@hierarchidb/10-ui-theme'
  },
  
  // Move TreeConsole sub-packages to 13-level
  {
    old: 'packages/ui/treeconsole/breadcrumb',
    new: 'packages/13-ui-treeconsole-breadcrumb',
    oldName: '@hierarchidb/ui-treeconsole-breadcrumb',
    newName: '@hierarchidb/13-ui-treeconsole-breadcrumb'
  },
  {
    old: 'packages/ui/treeconsole/footer',
    new: 'packages/13-ui-treeconsole-footer',
    oldName: '@hierarchidb/ui-treeconsole-footer',
    newName: '@hierarchidb/13-ui-treeconsole-footer'
  },
  {
    old: 'packages/ui/treeconsole/speeddial',
    new: 'packages/13-ui-treeconsole-speeddial',
    oldName: '@hierarchidb/ui-treeconsole-speeddial',
    newName: '@hierarchidb/13-ui-treeconsole-speeddial'
  },
  {
    old: 'packages/ui/treeconsole/toolbar',
    new: 'packages/13-ui-treeconsole-toolbar',
    oldName: '@hierarchidb/ui-treeconsole-toolbar',
    newName: '@hierarchidb/13-ui-treeconsole-toolbar'
  },
  {
    old: 'packages/ui/treeconsole/trashbin',
    new: 'packages/13-ui-treeconsole-trashbin',
    oldName: '@hierarchidb/ui-treeconsole-trashbin',
    newName: '@hierarchidb/13-ui-treeconsole-trashbin'
  },
  {
    old: 'packages/ui/treeconsole/treetable',
    new: 'packages/13-ui-treeconsole-treetable',
    oldName: '@hierarchidb/ui-treeconsole-treetable',
    newName: '@hierarchidb/13-ui-treeconsole-treetable'
  },
  
  // Fix backend packages naming
  {
    old: 'packages/40-backend-bff',
    new: 'packages/40-backend-bff',
    oldName: '@hierarchidb/bff',
    newName: '@hierarchidb/bff'
  },
  {
    old: 'packages/40-backend-cors-proxy',
    new: 'packages/40-backend-cors-proxy',
    oldName: '@hierarchidb/cors-proxy',
    newName: '@hierarchidb/cors-proxy'
  }
];

// Build package name map
const PACKAGE_NAME_MAP = new Map<string, string>();
PACKAGE_MOVES.forEach(move => {
  PACKAGE_NAME_MAP.set(move.oldName, move.newName);
});

async function movePackages(): Promise<void> {
  log.info('Moving packages to correct locations...');
  
  for (const move of PACKAGE_MOVES) {
    if (move.old === move.new) {
      // Just a rename, not a move
      continue;
    }
    
    if (!fs.existsSync(move.old)) {
      log.warn(`Source not found: ${move.old}`);
      continue;
    }
    
    if (fs.existsSync(move.new)) {
      log.warn(`Target already exists: ${move.new}`);
      continue;
    }
    
    try {
      // Create parent directory if needed
      const parentDir = path.dirname(move.new);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      
      // Try git mv first
      try {
        execSync(`git mv "${move.old}" "${move.new}"`, { stdio: 'pipe' });
        log.success(`Moved: ${move.old} → ${move.new}`);
      } catch {
        // Fallback to regular move
        fs.renameSync(move.old, move.new);
        log.success(`Moved (no git): ${move.old} → ${move.new}`);
      }
    } catch (error) {
      log.error(`Failed to move ${move.old}: ${error}`);
    }
  }
}

async function updatePackageJsonFiles(): Promise<void> {
  log.info('Updating package.json files...');
  
  for (const move of PACKAGE_MOVES) {
    const packageJsonPath = path.join(move.new, 'package.json');
    
    if (!fs.existsSync(packageJsonPath)) {
      continue;
    }
    
    try {
      const content = await fs.promises.readFile(packageJsonPath, 'utf8');
      const pkg = JSON.parse(content);
      let modified = false;
      
      // Update package name
      if (pkg.name === move.oldName) {
        pkg.name = move.newName;
        modified = true;
      }
      
      // Update dependencies
      const depTypes = ['dependencies', 'devDependencies', 'peerDependencies'] as const;
      for (const depType of depTypes) {
        if (pkg[depType]) {
          const newDeps: Record<string, string> = {};
          for (const [dep, version] of Object.entries(pkg[depType] as Record<string, string>)) {
            const newDep = PACKAGE_NAME_MAP.get(dep) || dep;
            newDeps[newDep] = version;
            if (newDep !== dep) {
              modified = true;
            }
          }
          pkg[depType] = newDeps;
        }
      }
      
      if (modified) {
        await fs.promises.writeFile(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n');
        log.success(`Updated: ${packageJsonPath}`);
      }
    } catch (error) {
      log.error(`Failed to update ${packageJsonPath}: ${error}`);
    }
  }
}

async function updateAllDependencies(): Promise<void> {
  log.info('Updating all package.json files to use new names...');
  
  const { glob } = await import('glob');
  const packageJsonFiles = await glob('packages/**/package.json', {
    ignore: ['**/node_modules/**', '**/dist/**']
  });
  
  for (const file of packageJsonFiles) {
    try {
      const content = await fs.promises.readFile(file, 'utf8');
      const pkg = JSON.parse(content);
      let modified = false;
      
      // Update dependencies
      const depTypes = ['dependencies', 'devDependencies', 'peerDependencies'] as const;
      for (const depType of depTypes) {
        if (pkg[depType]) {
          const newDeps: Record<string, string> = {};
          for (const [dep, version] of Object.entries(pkg[depType] as Record<string, string>)) {
            const newDep = PACKAGE_NAME_MAP.get(dep) || dep;
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
        log.success(`Updated dependencies in: ${file}`);
      }
    } catch (error) {
      log.error(`Failed to update ${file}: ${error}`);
    }
  }
}

async function updateImports(): Promise<void> {
  log.info('Updating import statements...');
  
  const { glob } = await import('glob');
  const sourceFiles = await glob('packages/**/*.{ts,tsx,js,jsx,mjs,cjs}', {
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
  });
  
  for (const file of sourceFiles) {
    try {
      let content = await fs.promises.readFile(file, 'utf8');
      let modified = false;
      
      for (const [oldName, newName] of PACKAGE_NAME_MAP.entries()) {
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
      }
    } catch (error) {
      log.error(`Failed to update ${file}: ${error}`);
    }
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function main(): Promise<void> {
  console.log('\n=== Fixing TreeConsole and Remaining Packages ===\n');
  
  await movePackages();
  await updatePackageJsonFiles();
  await updateAllDependencies();
  await updateImports();
  
  log.success('\nPackage restructuring complete!');
  log.info('Next: Run "pnpm install" and then check dependencies with "tsx scripts/check-dependency-rules.ts"');
}

main().catch(error => {
  log.error(`Fatal error: ${error}`);
  process.exit(1);
});