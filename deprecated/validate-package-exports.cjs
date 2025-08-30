#!/usr/bin/env node

/**
 * Validate package.json export configurations match actual dist output
 */

const fs = require('fs');
const path = require('path');

function validatePackage(packageDir) {
  const packageJsonPath = path.join(packageDir, 'package.json');
  const distDir = path.join(packageDir, 'dist');
  
  if (!fs.existsSync(packageJsonPath)) return null;
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const packageName = packageJson.name;
  
  // Skip packages without dist directory
  if (!fs.existsSync(distDir)) {
    return null;
  }
  
  const errors = [];
  
  // Check if exports configuration exists
  if (packageJson.exports && packageJson.exports['.']) {
    const exports = packageJson.exports['.'];
    
    // Check import field
    if (exports.import) {
      const importPath = path.join(packageDir, exports.import);
      if (!fs.existsSync(importPath)) {
        errors.push(`Missing import file: ${exports.import}`);
      }
    }
    
    // Check require field
    if (exports.require) {
      const requirePath = path.join(packageDir, exports.require);
      if (!fs.existsSync(requirePath)) {
        errors.push(`Missing require file: ${exports.require}`);
      }
    }
  }
  
  // Check main field
  if (packageJson.main) {
    const mainPath = path.join(packageDir, packageJson.main);
    if (!fs.existsSync(mainPath)) {
      errors.push(`Missing main file: ${packageJson.main}`);
    }
  }
  
  // Check module field
  if (packageJson.module) {
    const modulePath = path.join(packageDir, packageJson.module);
    if (!fs.existsSync(modulePath)) {
      errors.push(`Missing module file: ${packageJson.module}`);
    }
  }
  
  // Check what files actually exist in dist
  if (fs.existsSync(distDir)) {
    const distFiles = fs.readdirSync(distDir)
      .filter(f => f.startsWith('index.') && !f.includes('.map') && !f.includes('.d.'));
    
    return {
      package: packageName,
      distFiles,
      errors,
      exports: packageJson.exports?.['.'],
      main: packageJson.main,
      module: packageJson.module,
    };
  }
  
  return errors.length > 0 ? { package: packageName, errors } : null;
}

// Find all packages
const packagesDir = path.join(__dirname, '..', 'packages');

function findPackages(dir) {
  const packages = [];
  
  // Direct packages
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const packageDir = path.join(dir, entry.name);
      
      // Check if it's a package directory
      if (fs.existsSync(path.join(packageDir, 'package.json'))) {
        packages.push(packageDir);
      }
      
      // Check for nested packages (like ui-treeconsole/*)
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

const packages = findPackages(packagesDir);
const results = packages.map(validatePackage).filter(Boolean);

console.log('Package Export Validation Report');
console.log('================================\n');

const packagesWithErrors = results.filter(r => r.errors && r.errors.length > 0);
const validPackages = results.filter(r => !r.errors || r.errors.length === 0);

if (packagesWithErrors.length > 0) {
  console.log('❌ Packages with errors:\n');
  packagesWithErrors.forEach(({ package: pkg, errors, distFiles }) => {
    console.log(`  ${pkg}:`);
    errors.forEach(err => console.log(`    - ${err}`));
    if (distFiles) {
      console.log(`    Available files: ${distFiles.join(', ')}`);
    }
    console.log();
  });
}

console.log('✅ Valid packages:', validPackages.length);
console.log('\n📊 Summary:');
console.log(`  Total packages: ${results.length}`);
console.log(`  Valid: ${validPackages.length}`);
console.log(`  With errors: ${packagesWithErrors.length}`);

// Show dist file patterns
console.log('\n📁 Dist file patterns found:');
const patterns = new Map();
results.forEach(r => {
  if (r.distFiles) {
    const pattern = r.distFiles.sort().join(', ');
    if (!patterns.has(pattern)) {
      patterns.set(pattern, []);
    }
    patterns.get(pattern).push(r.package);
  }
});

patterns.forEach((packages, pattern) => {
  console.log(`\n  Pattern: ${pattern}`);
  console.log(`  Packages (${packages.length}):`);
  packages.slice(0, 5).forEach(p => console.log(`    - ${p}`));
  if (packages.length > 5) {
    console.log(`    ... and ${packages.length - 5} more`);
  }
});

process.exit(packagesWithErrors.length > 0 ? 1 : 0);