#!/usr/bin/env tsx

/**
 * Add DOM utils to all UI packages that need it
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

async function addDOMLibToUIPackages(): Promise<void> {
  log.info('Finding all UI package tsconfig.json files...');

  // Find all UI packages (packages with "ui" in the name)
  const patterns = [
    'packages/*ui*/tsconfig.json',
    'packages/ui*/tsconfig.json',
    'packages/ui/**/tsconfig.json',
    'packages/30-_app/tsconfig.json', // App also needs DOM
  ];

  let fixedCount = 0;

  for (const pattern of patterns) {
    const tsconfigs = await glob(pattern, {
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
    });

    for (const tsconfigPath of tsconfigs) {
      try {
        const content = await fs.promises.readFile(tsconfigPath, 'utf8');
        let tsconfig: any;

        try {
          tsconfig = JSON.parse(content);
        } catch (parseError) {
          log.warn(`Skipping invalid JSON: ${tsconfigPath}`);
          continue;
        }

        let modified = false;

        // Ensure compilerOptions exists
        if (!tsconfig.compilerOptions) {
          tsconfig.compilerOptions = {};
        }

        // Check if utils is already set
        if (!tsconfig.compilerOptions.lib) {
          // Add default libs including DOM
          tsconfig.compilerOptions.lib = ['ES2022', 'DOM', 'DOM.Iterable'];
          modified = true;
          log.info(`  Added DOM lib to ${tsconfigPath}`);
        } else if (Array.isArray(tsconfig.compilerOptions.lib)) {
          // Check if DOM is already included
          const hasDOM = tsconfig.compilerOptions.lib.some((lib: string) =>
            lib.toUpperCase().includes('DOM')
          );

          if (!hasDOM) {
            // Add DOM libs
            tsconfig.compilerOptions.lib.push('DOM', 'DOM.Iterable');
            modified = true;
            log.info(`  Added DOM lib to existing libs in ${tsconfigPath}`);
          }
        }

        if (modified) {
          await fs.promises.writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2) + '\n');
          log.success(`Fixed: ${tsconfigPath}`);
          fixedCount++;
        }
      } catch (error) {
        log.error(`Failed to fix ${tsconfigPath}: ${error}`);
      }
    }
  }

  log.info(`Fixed ${fixedCount} tsconfig files`);
}

async function main(): Promise<void> {
  console.log('\n=== Adding DOM utils to UI packages ===\n');

  await addDOMLibToUIPackages();

  log.success('\nDOM utils fixes complete!');
  log.info('Next: Run "pnpm typecheck" to verify');
}

main().catch((error) => {
  log.error(`Fatal error: ${error}`);
  process.exit(1);
});
