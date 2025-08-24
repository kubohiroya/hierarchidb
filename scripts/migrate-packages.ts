#!/usr/bin/env tsx

/**
 * Package Hierarchy Migration Tool - TypeScript Version
 *
 * This tool performs a complete migration of the package structure
 * including directory moves, package.json updates, and import rewrites
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { glob } from 'glob';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
} as const;

// Logging utilities
const log = {
  info: (msg: string) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  header: (msg: string) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}`),
  subheader: (msg: string) => console.log(`${colors.cyan}${msg}${colors.reset}`),
};

// Package mapping configuration
interface PackageMapping {
  oldPath: string;
  newPath: string;
  oldName: string;
  newName: string;
}

const PACKAGE_MAPPINGS: PackageMapping[] = [
  // 00-level: Core foundations
  {
    oldPath: 'packages/core',
    newPath: 'packages/00-core',
    oldName: '@hierarchidb/common-core',
    newName: '@hierarchidb/00-core',
  },
  // 01-level: API layer
  {
    oldPath: 'packages/api',
    newPath: 'packages/01-api',
    oldName: '@hierarchidb/common-api',
    newName: '@hierarchidb/01-api',
  },
  // 02-level: Worker
  {
    oldPath: 'packages/worker',
    newPath: 'packages/02-worker',
    oldName: '@hierarchidb/runtime-worker',
    newName: '@hierarchidb/02-worker',
  },
  // 10-level: UI Core packages
  {
    oldPath: 'packages/ui/core',
    newPath: 'packages/10-ui-core',
    oldName: '@hierarchidb/ui-core',
    newName: '@hierarchidb/10-ui-core',
  },
  {
    oldPath: 'packages/ui/client',
    newPath: 'packages/10-ui-client',
    oldName: '@hierarchidb/ui-client',
    newName: '@hierarchidb/10-ui-client',
  },
  {
    oldPath: 'packages/ui/auth',
    newPath: 'packages/10-ui-auth',
    oldName: '@hierarchidb/ui-auth',
    newName: '@hierarchidb/10-ui-auth',
  },
  {
    oldPath: 'packages/ui/i18n',
    newPath: 'packages/10-ui-i18n',
    oldName: '@hierarchidb/ui-i18n',
    newName: '@hierarchidb/10-ui-i18n',
  },
  {
    oldPath: 'packages/ui/routing',
    newPath: 'packages/10-ui-routing',
    oldName: '@hierarchidb/ui-routing',
    newName: '@hierarchidb/10-ui-routing',
  },
  // 11-level: UI Components
  {
    oldPath: 'packages/ui/layout',
    newPath: 'packages/11-ui-layout',
    oldName: '@hierarchidb/ui-layout',
    newName: '@hierarchidb/11-ui-layout',
  },
  {
    oldPath: 'packages/ui/navigation',
    newPath: 'packages/11-ui-navigation',
    oldName: '@hierarchidb/ui-navigation',
    newName: '@hierarchidb/11-ui-navigation',
  },
  {
    oldPath: 'packages/ui/file',
    newPath: 'packages/11-ui-file',
    oldName: '@hierarchidb/ui-file',
    newName: '@hierarchidb/11-ui-file',
  },
  {
    oldPath: 'packages/ui/monitoring',
    newPath: 'packages/11-ui-monitoring',
    oldName: '@hierarchidb/ui-monitoring',
    newName: '@hierarchidb/11-ui-monitoring',
  },
  {
    oldPath: 'packages/ui/tour',
    newPath: 'packages/11-ui-tour',
    oldName: '@hierarchidb/ui-tour',
    newName: '@hierarchidb/11-ui-tour',
  },
  {
    oldPath: 'packages/ui/usermenu',
    newPath: 'packages/11-ui-usermenu',
    oldName: '@hierarchidb/ui-usermenu',
    newName: '@hierarchidb/11-ui-usermenu',
  },
  // 12-level: TreeConsole packages
  {
    oldPath: 'packages/ui/treeconsole/base',
    newPath: 'packages/12-ui-treeconsole-base',
    oldName: '@hierarchidb/ui-treeconsole-base',
    newName: '@hierarchidb/12-ui-treeconsole-base',
  },
  // 20-level: Plugins
  {
    oldPath: 'packages/plugins/basemap',
    newPath: 'packages/20-plugin-basemap',
    oldName: '@hierarchidb/plugin-basemap',
    newName: '@hierarchidb/20-plugin-basemap',
  },
  {
    oldPath: 'packages/plugins/stylemap',
    newPath: 'packages/20-plugin-stylemap',
    oldName: '@hierarchidb/plugin-stylemap',
    newName: '@hierarchidb/20-plugin-stylemap',
  },
  {
    oldPath: 'packages/plugins/import-export',
    newPath: 'packages/20-plugin-import-export',
    oldName: '@hierarchidb/plugin-import-export',
    newName: '@hierarchidb/20-plugin-import-export',
  },
  // 30-level: Application
  {
    oldPath: 'packages/_app',
    newPath: 'packages/30-_app',
    oldName: '@hierarchidb/_app',
    newName: '@hierarchidb/30-_app',
  },
  // 40-level: Backend
  {
    oldPath: 'packages/backend/bff',
    newPath: 'packages/40-backend-bff',
    oldName: '@hierarchidb/backend-bff',
    newName: '@hierarchidb/bff',
  },
  {
    oldPath: 'packages/backend/cors-proxy',
    newPath: 'packages/40-backend-cors-proxy',
    oldName: '@hierarchidb/backend-cors-proxy',
    newName: '@hierarchidb/cors-proxy',
  },
];

// Build a map for quick lookups
const PACKAGE_NAME_MAP = new Map<string, string>();
PACKAGE_MAPPINGS.forEach((mapping) => {
  PACKAGE_NAME_MAP.set(mapping.oldName, mapping.newName);
});

// Check if git is available
function isGitAvailable(): boolean {
  try {
    execSync('git status', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// Step 1: Move directories (already done)
function checkDirectoryMoves(): void {
  log.header('Checking directory structure');

  let movedCount = 0;
  let notMovedCount = 0;

  PACKAGE_MAPPINGS.forEach((mapping) => {
    if (fs.existsSync(mapping.newPath)) {
      log.success(`Already moved: ${mapping.newPath}`);
      movedCount++;
    } else if (fs.existsSync(mapping.oldPath)) {
      log.warn(`Not yet moved: ${mapping.oldPath} → ${mapping.newPath}`);
      notMovedCount++;
    } else {
      log.info(`Neither old nor new path exists: ${mapping.oldPath}`);
    }
  });

  log.info(`Summary: ${movedCount} already moved, ${notMovedCount} need moving`);
}

// Step 2: Update package.json files
async function updatePackageJsonFiles(dryRun = false): Promise<void> {
  log.header(`${dryRun ? '[DRY RUN] ' : ''}Updating package.json files`);

  let updatedCount = 0;

  for (const mapping of PACKAGE_MAPPINGS) {
    const packageJsonPath = path.join(mapping.newPath, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      continue;
    }

    try {
      const content = await fs.promises.readFile(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(content);
      let modified = false;

      // Update package name
      if (packageJson.name === mapping.oldName) {
        packageJson.name = mapping.newName;
        modified = true;
      }

      // Update dependencies
      const depTypes = ['dependencies', 'devDependencies', 'peerDependencies'] as const;
      for (const depType of depTypes) {
        if (packageJson[depType]) {
          const newDeps: Record<string, string> = {};
          for (const [dep, version] of Object.entries(
            packageJson[depType] as Record<string, string>
          )) {
            const newDep = PACKAGE_NAME_MAP.get(dep) || dep;
            newDeps[newDep] = version;
            if (newDep !== dep) {
              modified = true;
            }
          }
          packageJson[depType] = newDeps;
        }
      }

      if (modified) {
        if (dryRun) {
          log.info(`Would update: ${packageJsonPath}`);
        } else {
          await fs.promises.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
          log.success(`Updated: ${packageJsonPath}`);
        }
        updatedCount++;
      }
    } catch (error) {
      log.error(`Failed to update ${packageJsonPath}: ${error}`);
    }
  }

  log.info(`Updated ${updatedCount} package.json files`);
}

// Step 3: Update imports in TypeScript/JavaScript files
async function updateImports(dryRun = false): Promise<void> {
  log.header(`${dryRun ? '[DRY RUN] ' : ''}Updating import statements`);

  const patterns = [
    'packages/**/*.{ts,tsx,js,jsx,mjs,cjs}',
    'e2e/**/*.{ts,tsx,js,jsx}',
    'scripts/**/*.{ts,js,mjs,cjs}',
  ];

  let totalFiles = 0;
  let modifiedFiles = 0;

  for (const pattern of patterns) {
    const files = await glob(pattern, {
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**'],
      nodir: true,
    });

    for (const file of files) {
      totalFiles++;

      try {
        let content = await fs.promises.readFile(file, 'utf8');
        let modified = false;

        // Replace package names in imports
        for (const [oldName, newName] of PACKAGE_NAME_MAP.entries()) {
          // Match various import patterns
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
          if (dryRun) {
            log.info(`Would update imports in: ${file}`);
          } else {
            await fs.promises.writeFile(file, content);
            log.success(`Updated imports in: ${file}`);
          }
          modifiedFiles++;
        }
      } catch (error) {
        log.error(`Failed to process ${file}: ${error}`);
      }
    }
  }

  log.info(`Processed ${totalFiles} files, modified ${modifiedFiles}`);
}

// Helper function to escape regex special characters
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Step 4: Update configuration files
async function updateConfigFiles(dryRun = false): Promise<void> {
  log.header(`${dryRun ? '[DRY RUN] ' : ''}Updating configuration files`);

  // Update pnpm-workspace.yaml
  const workspacePath = 'pnpm-workspace.yaml';
  if (fs.existsSync(workspacePath)) {
    let content = await fs.promises.readFile(workspacePath, 'utf8');

    // Update workspace paths
    const replacements = [
      { old: "- 'packages/core'", new: "- 'packages/00-core'" },
      { old: "- 'packages/api'", new: "- 'packages/01-api'" },
      { old: "- 'packages/worker'", new: "- 'packages/02-worker'" },
      { old: "- 'packages/ui/*'", new: "- 'packages/1*-ui-*'" },
      { old: "- 'packages/ui/treeconsole/*'", new: "- 'packages/12-ui-treeconsole-*'" },
      { old: "- 'packages/plugins/*'", new: "- 'packages/20-plugin-*'" },
      { old: "- 'packages/_app'", new: "- 'packages/30-_app'" },
      { old: "- 'packages/backend/*'", new: "- 'packages/40-backend-*'" },
    ];

    for (const { old: oldText, new: newText } of replacements) {
      content = content.replace(oldText, newText);
    }

    if (dryRun) {
      log.info('Would update pnpm-workspace.yaml');
    } else {
      await fs.promises.writeFile(workspacePath, content);
      log.success('Updated pnpm-workspace.yaml');
    }
  }

  // Update TypeScript configs
  const tsconfigs = await glob('**/tsconfig*.json', {
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
  });

  for (const tsconfigPath of tsconfigs) {
    try {
      const content = await fs.promises.readFile(tsconfigPath, 'utf8');
      const tsconfig = JSON.parse(content);
      let modified = false;

      // Update paths in compilerOptions
      if (tsconfig.compilerOptions?.paths) {
        const newPaths: Record<string, string[]> = {};

        for (const [key, value] of Object.entries(
          tsconfig.compilerOptions.paths as Record<string, string[]>
        )) {
          let newKey = key;

          // Update package names in path keys
          for (const [oldName, newName] of PACKAGE_NAME_MAP.entries()) {
            if (key.startsWith(oldName)) {
              newKey = key.replace(oldName, newName);
              modified = true;
            }
          }

          // Update path values
          const newValue = value.map((v) => {
            let newV = v;
            for (const mapping of PACKAGE_MAPPINGS) {
              if (v.includes(mapping.oldPath)) {
                newV = v.replace(mapping.oldPath, mapping.newPath);
                modified = true;
              }
            }
            return newV;
          });

          newPaths[newKey] = newValue;
        }

        if (modified) {
          tsconfig.compilerOptions.paths = newPaths;
        }
      }

      // Update references
      if (tsconfig.references) {
        tsconfig.references = tsconfig.references.map((ref: { path: string }) => {
          let newPath = ref.path;
          for (const mapping of PACKAGE_MAPPINGS) {
            if (ref.path.includes(mapping.oldPath)) {
              newPath = ref.path.replace(mapping.oldPath, mapping.newPath);
              modified = true;
            }
          }
          return { path: newPath };
        });
      }

      if (modified) {
        if (dryRun) {
          log.info(`Would update: ${tsconfigPath}`);
        } else {
          await fs.promises.writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2) + '\n');
          log.success(`Updated: ${tsconfigPath}`);
        }
      }
    } catch (error) {
      // Skip invalid JSON files
      if (!error.message.includes('JSON')) {
        log.error(`Failed to update ${tsconfigPath}: ${error}`);
      }
    }
  }
}

// Main function
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');

  console.log(`
${colors.bright}${colors.cyan}╔══════════════════════════════════════════════════════════╗
║     HierarchiDB Package Hierarchy Migration (TypeScript)  ║
╚══════════════════════════════════════════════════════════╝${colors.reset}
`);

  if (dryRun) {
    log.warn('DRY RUN MODE - No changes will be made');
    log.info('Use --execute flag to perform the actual migration\n');
  } else {
    log.warn('EXECUTING MIGRATION - This will modify your project!');
    log.info('Make sure you have committed all changes first.\n');
  }

  // Check current state
  checkDirectoryMoves();

  // Execute migration steps
  await updatePackageJsonFiles(dryRun);
  await updateImports(dryRun);
  await updateConfigFiles(dryRun);

  console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(60)}${colors.reset}`);

  if (dryRun) {
    log.success('Dry run completed!');
    log.info('\nTo execute the migration, run:');
    log.info('  tsx scripts/migrate-packages.ts --execute');
  } else {
    log.success('Migration completed!');
    log.info('\nNext steps:');
    log.info('  1. Run: pnpm install');
    log.info('  2. Run: pnpm typecheck');
    log.info('  3. Run: pnpm build');
    log.info('  4. Run: pnpm test');
    log.info('  5. Commit the changes');
  }
}

// Run the migration
main().catch((error) => {
  log.error(`Fatal error: ${error}`);
  process.exit(1);
});
