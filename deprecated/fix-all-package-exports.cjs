#!/usr/bin/env node

/**
 * Fix all package.json export configurations to match actual dist output
 */

const fs = require('fs');
const path = require('path');

function fixPackageJson(packageDir) {
  const packageJsonPath = path.join(packageDir, 'package.json');
  const distDir = path.join(packageDir, 'dist');
  
  if (!fs.existsSync(packageJsonPath) || !fs.existsSync(distDir)) {
    return null;
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const packageName = packageJson.name;
  
  // Check what files actually exist in dist
  const distFiles = fs.readdirSync(distDir)
    .filter(f => f.startsWith('index.') && !f.includes('.map') && !f.includes('.d.'));
  
  if (distFiles.length === 0) return null;
  
  // Determine the pattern
  const hasCJS = distFiles.includes('index.cjs');
  const hasJS = distFiles.includes('index.js');
  const hasMJS = distFiles.includes('index.mjs');
  
  let pattern = null;
  let updates = {};
  
  if (hasCJS && hasJS && !hasMJS) {
    // Pattern 1: index.cjs (CommonJS) + index.js (ESM)
    pattern = 'cjs+js';
    updates = {
      main: 'dist/index.cjs',
      module: 'dist/index.js',
      exports: {
        '.': {
          types: './dist/index.d.ts',
          import: './dist/index.js',
          require: './dist/index.cjs'
        }
      }
    };
  } else if (!hasCJS && hasJS && hasMJS) {
    // Pattern 2: index.js (CommonJS) + index.mjs (ESM)
    pattern = 'js+mjs';
    updates = {
      main: 'dist/index.js',
      module: 'dist/index.mjs',
      exports: {
        '.': {
          types: './dist/index.d.ts',
          import: './dist/index.mjs',
          require: './dist/index.js'
        }
      }
    };
  } else if (hasCJS && !hasJS && hasMJS) {
    // Pattern 3: index.cjs (CommonJS) + index.mjs (ESM) - like core package
    pattern = 'cjs+mjs';
    updates = {
      main: './dist/index.cjs',
      module: './dist/index.mjs',
      exports: {
        '.': {
          types: './dist/index.d.ts',
          import: './dist/index.mjs',
          require: './dist/index.cjs',
          default: './dist/index.mjs'
        }
      }
    };
  } else {
    console.log(`  ⚠️  Unknown pattern for ${packageName}: ${distFiles.join(', ')}`);
    return null;
  }
  
  // Apply updates
  if (updates.main) packageJson.main = updates.main;
  if (updates.module) packageJson.module = updates.module;
  if (updates.exports) {
    // Preserve other exports if they exist
    if (packageJson.exports && typeof packageJson.exports === 'object') {
      packageJson.exports['.'] = updates.exports['.'];
    } else {
      packageJson.exports = updates.exports;
    }
  }
  
  // Write back
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  
  return { package: packageName, pattern, distFiles };
}

// Find all packages
const packagesDir = path.join(__dirname, '..', 'packages');

function findPackages(dir) {
  const packages = [];
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const packageDir = path.join(dir, entry.name);
      
      if (fs.existsSync(path.join(packageDir, 'package.json'))) {
        packages.push(packageDir);
      }
      
      // Check for nested packages
      const subEntries = fs.readdirSync(packageDir, { withFileTypes: true });
      for (const subEntry of subEntries) {
        if (subEntry.isDirectory()) {
          const subPackageDir = path.join(packageDir, subEntry.name);
          if (fs.existsSync(path.join(subPackageDir, 'package.json'))) {
            packages.push(subPackageDir);
          }
        }
      }
    }
  }
  
  return packages;
}

console.log('Fixing all package.json export configurations...\n');

const packages = findPackages(packagesDir);
const results = packages.map(fixPackageJson).filter(Boolean);

const byPattern = {};
results.forEach(r => {
  if (!byPattern[r.pattern]) byPattern[r.pattern] = [];
  byPattern[r.pattern].push(r.package);
});

console.log('📊 Fixed packages by pattern:\n');
Object.entries(byPattern).forEach(([pattern, pkgs]) => {
  console.log(`  ${pattern}: ${pkgs.length} packages`);
  pkgs.slice(0, 3).forEach(p => console.log(`    - ${p}`));
  if (pkgs.length > 3) console.log(`    ... and ${pkgs.length - 3} more`);
  console.log();
});

console.log(`✅ Total packages fixed: ${results.length}`);
console.log('\nDone! All package.json files have been updated to match their dist outputs.');