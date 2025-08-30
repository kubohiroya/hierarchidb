#!/usr/bin/env tsx

/**
 * Fix tsconfig.json relative paths after hierarchy restructuring
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

interface PathFix {
  pattern: string;
  oldDepth: number;
  newDepth: number;
}

// Define path fixes based on package moves
const PATH_FIXES: PathFix[] = [
  // Packages that moved from packages/XX to packages/NN-XX (same depth)
  { pattern: 'packages/[0-9][0-9]-*', oldDepth: 2, newDepth: 2 },
  
  // UI packages that moved from packages/ui/XX to packages/NN-ui-XX (depth decreased)
  { pattern: 'packages/10-ui-*', oldDepth: 3, newDepth: 2 },
  { pattern: 'packages/11-ui-*', oldDepth: 3, newDepth: 2 },
  { pattern: 'packages/12-ui-treeconsole-*', oldDepth: 4, newDepth: 2 },
  { pattern: 'packages/13-ui-treeconsole-*', oldDepth: 3, newDepth: 2 },
  
  // Plugin packages that moved from packages/plugins/XX to packages/20-plugin-XX (depth decreased)
  { pattern: 'packages/20-plugin-*', oldDepth: 3, newDepth: 2 },
  
  // Backend packages that moved from packages/backend/XX to packages/40-backend-XX (depth decreased)
  { pattern: 'packages/40-backend-*', oldDepth: 3, newDepth: 2 },
];

function getPackageDepth(packagePath: string): number {
  // Count the number of directories from root to package
  const parts = packagePath.split(path.sep);
  return parts.length;
}

function getRelativePathToRoot(fromPath: string): string {
  const depth = getPackageDepth(fromPath);
  return '../'.repeat(depth);
}

async function fixTsConfigPaths(): Promise<void> {
  log.info('Finding all tsconfig.json files...');
  
  const tsconfigs = await glob('packages/**/tsconfig*.json', {
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
  });
  
  let fixedCount = 0;
  
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
      const packageDir = path.dirname(tsconfigPath);
      const relativePath = path.relative(process.cwd(), packageDir);
      
      // Determine the correct depth
      let currentDepth = 2; // Default for packages/XX
      
      // Check if this is a numbered package
      if (/packages\/\d{2}-/.test(relativePath)) {
        currentDepth = 2;
      }
      // Check if this is in ui/ subdirectory
      else if (relativePath.includes('packages/ui/')) {
        if (relativePath.includes('packages/ui/treeconsole/')) {
          currentDepth = 4;
        } else {
          currentDepth = 3;
        }
      }
      // Check if this is in plugins/ subdirectory
      else if (relativePath.includes('packages/plugins/')) {
        currentDepth = 3;
      }
      // Check if this is in backend/ subdirectory
      else if (relativePath.includes('packages/backend/')) {
        currentDepth = 3;
      }
      
      // Fix extends path
      if (tsconfig.extends) {
        const oldExtends = tsconfig.extends;
        
        // Calculate correct relative path
        if (oldExtends.includes('tsconfig.base.json')) {
          const correctPath = '../'.repeat(currentDepth) + 'tsconfig.base.json';
          if (oldExtends !== correctPath) {
            tsconfig.extends = correctPath;
            modified = true;
            log.info(`  Fixed extends in ${tsconfigPath}: ${oldExtends} → ${correctPath}`);
          }
        } else if (oldExtends.includes('tsconfig.strict.json')) {
          const correctPath = '../'.repeat(currentDepth) + 'tsconfig.strict.json';
          if (oldExtends !== correctPath) {
            tsconfig.extends = correctPath;
            modified = true;
            log.info(`  Fixed extends in ${tsconfigPath}: ${oldExtends} → ${correctPath}`);
          }
        }
      }
      
      // Fix references paths
      if (tsconfig.references) {
        const newReferences = tsconfig.references.map((ref: { path: string }) => {
          let newPath = ref.path;
          
          // Fix relative paths to other packages
          if (ref.path.startsWith('../')) {
            // Count how many ../ there are
            const upCount = (ref.path.match(/\.\.\//g) || []).length;
            const remainingPath = ref.path.replace(/^(\.\.\/)*/g, '');
            
            // Adjust based on depth change
            let newUpCount = upCount;
            
            // If moving from deeper to shallower, reduce ../ count
            if (currentDepth === 2 && upCount > 2) {
              newUpCount = 2;
            }
            
            // Reconstruct path
            newPath = '../'.repeat(newUpCount) + remainingPath;
            
            if (newPath !== ref.path) {
              modified = true;
              log.info(`  Fixed reference in ${tsconfigPath}: ${ref.path} → ${newPath}`);
            }
          }
          
          return { path: newPath };
        });
        
        if (modified) {
          tsconfig.references = newReferences;
        }
      }
      
      // Fix compilerOptions.paths if they contain relative paths
      if (tsconfig.compilerOptions?.paths) {
        const newPaths: Record<string, string[]> = {};
        let pathsModified = false;
        
        for (const [key, value] of Object.entries(tsconfig.compilerOptions.paths as Record<string, string[]>)) {
          const newValue = value.map(v => {
            if (v.startsWith('../')) {
              const upCount = (v.match(/\.\.\//g) || []).length;
              const remainingPath = v.replace(/^(\.\.\/)*/g, '');
              
              // Adjust based on depth
              let newUpCount = upCount;
              if (currentDepth === 2 && upCount > 2) {
                newUpCount = 2;
              }
              
              const newV = '../'.repeat(newUpCount) + remainingPath;
              if (newV !== v) {
                pathsModified = true;
                log.info(`  Fixed path in ${tsconfigPath}: ${v} → ${newV}`);
              }
              return newV;
            }
            return v;
          });
          
          newPaths[key] = newValue;
        }
        
        if (pathsModified) {
          tsconfig.compilerOptions.paths = newPaths;
          modified = true;
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
  
  log.info(`Fixed ${fixedCount} tsconfig files`);
}

async function main(): Promise<void> {
  console.log('\n=== Fixing tsconfig.json Relative Paths ===\n');
  
  await fixTsConfigPaths();
  
  log.success('\nPath fixes complete!');
  log.info('Next: Run "pnpm typecheck" to verify');
}

main().catch(error => {
  log.error(`Fatal error: ${error}`);
  process.exit(1);
});