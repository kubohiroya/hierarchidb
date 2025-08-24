#!/usr/bin/env node

/**
 * Package Hierarchy Migration Tool using jscodeshift
 * 
 * This tool uses codemods to safely update all imports across the codebase
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const glob = require('glob');

// Package directory mappings
const DIRECTORY_MAPPINGS = [
  // 00-level: Core foundations
  { old: 'packages/core', new: 'packages/00-core' },
  { old: 'packages/api', new: 'packages/01-api' },
  { old: 'packages/worker', new: 'packages/02-worker' },
  
  // 10-level: UI Core
  { old: 'packages/ui/core', new: 'packages/10-ui-core' },
  { old: 'packages/ui/client', new: 'packages/10-ui-client' },
  { old: 'packages/ui/auth', new: 'packages/10-ui-auth' },
  { old: 'packages/ui/i18n', new: 'packages/10-ui-i18n' },
  { old: 'packages/ui/routing', new: 'packages/10-ui-routing' },
  
  // 11-level: UI Components
  { old: 'packages/ui/layout', new: 'packages/11-ui-layout' },
  { old: 'packages/ui/navigation', new: 'packages/11-ui-navigation' },
  { old: 'packages/ui/file', new: 'packages/11-ui-file' },
  { old: 'packages/ui/monitoring', new: 'packages/11-ui-monitoring' },
  { old: 'packages/ui/tour', new: 'packages/11-ui-tour' },
  { old: 'packages/ui/usermenu', new: 'packages/11-ui-usermenu' },
  
  // 12-level: TreeConsole
  { old: 'packages/ui/treeconsole/base', new: 'packages/12-ui-treeconsole-base' },
  { old: 'packages/ui/treeconsole/simple', new: 'packages/12-ui-treeconsole-simple' },
  
  // 20-level: Plugins
  { old: 'packages/plugins/basemap', new: 'packages/20-plugin-basemap' },
  { old: 'packages/plugins/stylemap', new: 'packages/20-plugin-stylemap' },
  { old: 'packages/plugins/_shapes_buggy', new: 'packages/20-plugin-shapes' },
  { old: 'packages/plugins/import-export', new: 'packages/20-plugin-import-export' },
  
  // 30-level: Application
  { old: 'packages/_app', new: 'packages/30-_app' },
  
  // 40-level: Backend
  { old: 'packages/backend/bff', new: 'packages/40-backend-bff' },
  { old: 'packages/backend/cors-proxy', new: 'packages/40-backend-cors-proxy' }
];

// Package name mappings
const PACKAGE_NAME_MAPPINGS = {
  '@hierarchidb/core': '@hierarchidb/00-core',
  '@hierarchidb/api': '@hierarchidb/01-api',
  '@hierarchidb/worker': '@hierarchidb/02-worker',
  '@hierarchidb/ui-core': '@hierarchidb/10-ui-core',
  '@hierarchidb/ui-client': '@hierarchidb/10-ui-client',
  '@hierarchidb/ui-auth': '@hierarchidb/10-ui-auth',
  '@hierarchidb/ui-i18n': '@hierarchidb/10-ui-i18n',
  '@hierarchidb/ui-routing': '@hierarchidb/10-ui-routing',
  '@hierarchidb/ui-layout': '@hierarchidb/11-ui-layout',
  '@hierarchidb/ui-navigation': '@hierarchidb/11-ui-navigation',
  '@hierarchidb/ui-file': '@hierarchidb/11-ui-file',
  '@hierarchidb/ui-monitoring': '@hierarchidb/11-ui-monitoring',
  '@hierarchidb/ui-tour': '@hierarchidb/11-ui-tour',
  '@hierarchidb/ui-usermenu': '@hierarchidb/11-ui-usermenu',
  '@hierarchidb/ui-treeconsole-base': '@hierarchidb/12-ui-treeconsole-base',
  '@hierarchidb/ui-treeconsole-simple': '@hierarchidb/12-ui-treeconsole-simple',
  '@hierarchidb/plugin-basemap': '@hierarchidb/20-plugin-basemap',
  '@hierarchidb/plugin-stylemap': '@hierarchidb/20-plugin-stylemap',
  '@hierarchidb/plugin-shapes': '@hierarchidb/20-plugin-shapes',
  '@hierarchidb/plugin-import-export': '@hierarchidb/20-plugin-import-export',
  '@hierarchidb/app': '@hierarchidb/30-_app',
  '@hierarchidb/backend-bff': '@hierarchidb/bff',
  '@hierarchidb/backend-cors-proxy': '@hierarchidb/cors-proxy'
};

function log(message, type = 'info') {
  const prefix = {
    info: '📘',
    success: '✅',
    warning: '⚠️',
    error: '❌',
    step: '🔧'
  };
  console.log(`${prefix[type] || '•'} ${message}`);
}

// Step 1: Move directories
function moveDirectories(dryRun = false) {
  log('Step 1: Moving directories', 'step');
  
  DIRECTORY_MAPPINGS.forEach(({ old: oldPath, new: newPath }) => {
    if (!fs.existsSync(oldPath)) {
      log(`Skipping ${oldPath} (not found)`, 'warning');
      return;
    }
    
    if (dryRun) {
      log(`[DRY RUN] Would move: ${oldPath} → ${newPath}`);
    } else {
      try {
        // Create parent directory if needed
        const parentDir = path.dirname(newPath);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }
        
        // Use git mv to preserve history
        execSync(`git mv "${oldPath}" "${newPath}"`, { stdio: 'pipe' });
        log(`Moved: ${oldPath} → ${newPath}`, 'success');
      } catch (error) {
        // Fallback to regular move if git mv fails
        fs.renameSync(oldPath, newPath);
        log(`Moved (no git): ${oldPath} → ${newPath}`, 'success');
      }
    }
  });
}

// Step 2: Update package.json files
function updatePackageJsonFiles(dryRun = false) {
  log('Step 2: Updating package.json files', 'step');
  
  DIRECTORY_MAPPINGS.forEach(({ old: oldPath, new: newPath }) => {
    const packageJsonPath = path.join(dryRun ? oldPath : newPath, 'package.json');
    
    if (!fs.existsSync(packageJsonPath)) {
      return;
    }
    
    const content = fs.readFileSync(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(content);
    
    // Get old package name from path
    const oldPackageName = '@hierarchidb/' + oldPath.split('/').pop().replace('_shapes_buggy', 'plugin-shapes');
    const newPackageName = PACKAGE_NAME_MAPPINGS[oldPackageName];
    
    if (newPackageName && packageJson.name === oldPackageName) {
      packageJson.name = newPackageName;
      
      // Update dependencies
      ['dependencies', 'devDependencies', 'peerDependencies'].forEach(depType => {
        if (packageJson[depType]) {
          const newDeps = {};
          Object.entries(packageJson[depType]).forEach(([dep, version]) => {
            const newDep = PACKAGE_NAME_MAPPINGS[dep] || dep;
            newDeps[newDep] = version;
          });
          packageJson[depType] = newDeps;
        }
      });
      
      if (dryRun) {
        log(`[DRY RUN] Would update: ${packageJsonPath}`);
      } else {
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
        log(`Updated: ${packageJsonPath}`, 'success');
      }
    }
  });
}

// Step 3: Run codemod to update imports
function runCodemod(dryRun = false) {
  log('Step 3: Running codemod to update imports', 'step');
  
  const codemodPath = path.join(__dirname, 'codemods', 'update-package-imports.cjs');
  
  // Find all source files
  const patterns = [
    'packages/**/*.{ts,tsx,js,jsx,mjs,cjs}',
    'e2e/**/*.{ts,tsx,js,jsx}',
    'scripts/**/*.{js,mjs,cjs}'
  ];
  
  const files = patterns.flatMap(pattern => 
    glob.sync(pattern, {
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**'],
      nodir: true
    })
  );
  
  log(`Found ${files.length} files to process`);
  
  if (dryRun) {
    log('[DRY RUN] Would run jscodeshift on all source files');
    
    // Show a sample of files that would be processed
    files.slice(0, 10).forEach(file => {
      log(`  Would process: ${file}`);
    });
    if (files.length > 10) {
      log(`  ... and ${files.length - 10} more files`);
    }
  } else {
    try {
      // Run jscodeshift
      const fileList = files.join(' ');
      const cmd = `npx jscodeshift -t ${codemodPath} ${fileList} --parser tsx`;
      
      log('Running jscodeshift transform...');
      execSync(cmd, { stdio: 'inherit' });
      log('Codemod completed successfully', 'success');
    } catch (error) {
      log(`Codemod failed: ${error.message}`, 'error');
    }
  }
}

// Step 4: Update configuration files
function updateConfigFiles(dryRun = false) {
  log('Step 4: Updating configuration files', 'step');
  
  // Update pnpm-workspace.yaml
  const workspacePath = 'pnpm-workspace.yaml';
  if (fs.existsSync(workspacePath)) {
    let content = fs.readFileSync(workspacePath, 'utf8');
    
    // Update workspace paths
    content = content
      .replace(/- 'packages\/core'/g, "- 'packages/00-core'")
      .replace(/- 'packages\/api'/g, "- 'packages/01-api'")
      .replace(/- 'packages\/worker'/g, "- 'packages/02-worker'")
      .replace(/- 'packages\/ui\/\*'/g, "- 'packages/1*-ui-*'")
      .replace(/- 'packages\/ui\/treeconsole\/\*'/g, "- 'packages/12-ui-treeconsole-*'")
      .replace(/- 'packages\/plugins\/\*'/g, "- 'packages/20-plugin-*'")
      .replace(/- 'packages\/app'/g, "- 'packages/30-_app'")
      .replace(/- 'packages\/backend\/\*'/g, "- 'packages/40-backend-*'");
    
    if (dryRun) {
      log('[DRY RUN] Would update pnpm-workspace.yaml');
    } else {
      fs.writeFileSync(workspacePath, content);
      log('Updated pnpm-workspace.yaml', 'success');
    }
  }
  
  // Update tsconfig files
  const tsconfigs = glob.sync('**/tsconfig*.json', {
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
  });
  
  tsconfigs.forEach(tsconfigPath => {
    try {
      const content = fs.readFileSync(tsconfigPath, 'utf8');
      const tsconfig = JSON.parse(content);
      let modified = false;
      
      // Update paths
      if (tsconfig.compilerOptions?.paths) {
        const newPaths = {};
        Object.entries(tsconfig.compilerOptions.paths).forEach(([key, value]) => {
          const newKey = PACKAGE_NAME_MAPPINGS[key.replace('/*', '')] 
            ? PACKAGE_NAME_MAPPINGS[key.replace('/*', '')] + (key.endsWith('/*') ? '/*' : '')
            : key;
          
          const newValue = value.map(v => {
            let newV = v;
            DIRECTORY_MAPPINGS.forEach(({ old: oldPath, new: newPath }) => {
              if (v.includes(oldPath)) {
                newV = v.replace(oldPath, newPath);
                modified = true;
              }
            });
            return newV;
          });
          
          newPaths[newKey] = newValue;
        });
        
        if (modified) {
          tsconfig.compilerOptions.paths = newPaths;
        }
      }
      
      // Update references
      if (tsconfig.references) {
        tsconfig.references = tsconfig.references.map(ref => {
          let newPath = ref.path;
          DIRECTORY_MAPPINGS.forEach(({ old: oldPath, new: newPath }) => {
            if (ref.path.includes(oldPath)) {
              newPath = ref.path.replace(oldPath, newPath);
              modified = true;
            }
          });
          return { path: newPath };
        });
      }
      
      if (modified) {
        if (dryRun) {
          log(`[DRY RUN] Would update: ${tsconfigPath}`);
        } else {
          fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2) + '\n');
          log(`Updated: ${tsconfigPath}`, 'success');
        }
      }
    } catch (error) {
      log(`Failed to update ${tsconfigPath}: ${error.message}`, 'error');
    }
  });
}

// Main function
function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');
  
  console.log('\n========================================');
  console.log('  Package Hierarchy Migration (Codemod)');
  console.log('========================================\n');
  
  if (dryRun) {
    log('DRY RUN MODE - No changes will be made', 'warning');
    log('Use --execute flag to perform the actual migration\n');
  } else {
    log('EXECUTING MIGRATION - This will modify your project!', 'warning');
    log('Make sure you have committed all changes first.\n');
  }
  
  // Execute migration steps
  moveDirectories(dryRun);
  updatePackageJsonFiles(dryRun);
  runCodemod(dryRun);
  updateConfigFiles(dryRun);
  
  console.log('\n========================================');
  
  if (dryRun) {
    log('Dry run completed!', 'success');
    log('\nTo execute the migration, run:');
    log('  node scripts/migrate-packages-with-codemod.js --execute');
  } else {
    log('Migration completed!', 'success');
    log('\nNext steps:');
    log('  1. Run: pnpm install');
    log('  2. Run: pnpm typecheck');
    log('  3. Run: pnpm build');
    log('  4. Run: pnpm test');
    log('  5. Commit the changes');
  }
}

// Run the migration
main();