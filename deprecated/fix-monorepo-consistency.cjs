#!/usr/bin/env node

/**
 * Fix monorepo consistency issues:
 * 1. Update React to v19
 * 2. Ensure ES2022 target
 * 3. Remove redundant tsconfig settings
 * 4. Fix package.json dependencies
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all package.json files
function findPackageJsonFiles() {
  return glob.sync('packages/**/package.json', {
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
  });
}

// Find all tsconfig.json files
function findTsConfigFiles() {
  return glob.sync('packages/**/tsconfig.json', {
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
  });
}

// Find all tsup.config.ts files
function findTsupConfigFiles() {
  return glob.sync('packages/**/tsup.config.ts', {
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
  });
}

// Update package.json for React 19
function updatePackageJson(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const pkg = JSON.parse(content);
  let modified = false;

  // Update dependencies
  if (pkg.dependencies) {
    if (pkg.dependencies.react) {
      pkg.dependencies.react = '^19.1.1';
      modified = true;
    }
    if (pkg.dependencies['react-dom']) {
      pkg.dependencies['react-dom'] = '^19.1.1';
      modified = true;
    }
  }

  // Update devDependencies
  if (pkg.devDependencies) {
    if (pkg.devDependencies.react) {
      pkg.devDependencies.react = '^19.1.1';
      modified = true;
    }
    if (pkg.devDependencies['react-dom']) {
      pkg.devDependencies['react-dom'] = '^19.1.1';
      modified = true;
    }
    if (pkg.devDependencies['@types/react']) {
      pkg.devDependencies['@types/react'] = '^19.1.1';
      modified = true;
    }
    if (pkg.devDependencies['@types/react-dom']) {
      pkg.devDependencies['@types/react-dom'] = '^19.1.1';
      modified = true;
    }
  }

  // Update peerDependencies - use range for libraries
  if (pkg.peerDependencies) {
    if (pkg.peerDependencies.react) {
      // For libraries, support React 18 and 19
      pkg.peerDependencies.react = '>=18.0.0';
      modified = true;
    }
    if (pkg.peerDependencies['react-dom']) {
      pkg.peerDependencies['react-dom'] = '>=18.0.0';
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`✅ Updated: ${filePath}`);
  }
}

// Simplify tsconfig.json
function updateTsConfig(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let lines = content.split('\n');
  
  // Check if it extends base config
  const extendsBase = content.includes('tsconfig.base.json');
  if (!extendsBase) {
    return; // Skip if it doesn't extend base
  }

  try {
    const tsconfig = JSON.parse(content);
    let modified = false;

    // Remove redundant settings that are in base
    const redundantSettings = [
      'declaration',
      'declarationMap',
      'sourceMap',
      'strict',
      'noImplicitAny',
      'noUncheckedIndexedAccess',
      'noImplicitReturns',
      'noFallthroughCasesInSwitch',
      'noUnusedLocals',
      'noUnusedParameters',
      'skipLibCheck',
      'esModuleInterop',
      'allowSyntheticDefaultImports',
      'forceConsistentCasingInFileNames',
      'resolveJsonModule',
      'isolatedModules'
    ];

    if (tsconfig.compilerOptions) {
      // Remove target if it's not ES2022
      if (tsconfig.compilerOptions.target && tsconfig.compilerOptions.target !== 'ES2022') {
        delete tsconfig.compilerOptions.target;
        modified = true;
      }

      // Remove redundant settings
      redundantSettings.forEach(setting => {
        if (tsconfig.compilerOptions[setting] !== undefined) {
          delete tsconfig.compilerOptions[setting];
          modified = true;
        }
      });

      // Keep only essential overrides
      const essentialKeys = ['outDir', 'rootDir', 'baseUrl', 'paths', 'composite', 'incremental', 'noEmit', 'allowImportingTsExtensions'];
      const compilerKeys = Object.keys(tsconfig.compilerOptions);
      
      compilerKeys.forEach(key => {
        if (!essentialKeys.includes(key) && !key.startsWith('jsx') && key !== 'target') {
          if (redundantSettings.includes(key)) {
            delete tsconfig.compilerOptions[key];
            modified = true;
          }
        }
      });
    }

    if (modified) {
      fs.writeFileSync(filePath, JSON.stringify(tsconfig, null, 2) + '\n');
      console.log(`✅ Simplified: ${filePath}`);
    }
  } catch (e) {
    console.error(`❌ Error processing ${filePath}: ${e.message}`);
  }
}

// Update tsup.config.ts to use ES2022
function updateTsupConfig(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Update target to es2022
  if (content.includes('target:')) {
    // Replace any target setting with es2022
    content = content.replace(/target:\s*['"`](?:es\d+|esnext)['"`]/gi, "target: 'es2022'");
    modified = true;
  } else if (content.includes('defineConfig({')) {
    // Add target if not present
    content = content.replace(
      /defineConfig\(\{/,
      "defineConfig({\n  target: 'es2022',"
    );
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Updated tsup config: ${filePath}`);
  }
}

// Main execution
console.log('🔧 Fixing monorepo consistency...\n');

console.log('📦 Updating package.json files...');
const packageFiles = findPackageJsonFiles();
packageFiles.forEach(updatePackageJson);

console.log('\n📝 Simplifying tsconfig.json files...');
const tsconfigFiles = findTsConfigFiles();
tsconfigFiles.forEach(updateTsConfig);

console.log('\n⚙️ Updating tsup.config.ts files...');
const tsupFiles = findTsupConfigFiles();
tsupFiles.forEach(updateTsupConfig);

console.log('\n✨ Done! Run "pnpm install" to update dependencies.');