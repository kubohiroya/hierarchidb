#!/usr/bin/env node

/**
 * Script to migrate the entire project from dual ESM/CJS to ESM-only
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Find all tsup.config.ts files
function findTsupConfigs(dir) {
  const configs = [];
  const files = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory() && !file.name.startsWith('.') && file.name !== 'node_modules' && file.name !== 'dist') {
      configs.push(...findTsupConfigs(fullPath));
    } else if (file.name === 'tsup.config.ts' || file.name === 'tsup.config.js') {
      configs.push(fullPath);
    }
  }
  
  return configs;
}

// Update tsup config to ESM only
function updateTsupConfig(configPath) {
  console.log(`Updating tsup config: ${configPath}`);
  
  let content = fs.readFileSync(configPath, 'utf-8');
  
  // Replace format array to ESM only
  content = content.replace(
    /format:\s*\[[^\]]*\]/g,
    "format: ['esm']"
  );
  
  // Update outExtension to use .js for ESM (modern standard)
  content = content.replace(
    /outExtension:[^,}]+[,}]/g,
    (match) => {
      const ending = match[match.length - 1];
      return `outExtension: ({ format }) => ({ js: '.js' })${ending}`;
    }
  );
  
  // If no outExtension exists, keep default (.js for ESM)
  
  fs.writeFileSync(configPath, content);
  console.log(`✓ Updated ${configPath}`);
}

// Update package.json for ESM
function updatePackageJson(packagePath) {
  const packageJsonPath = path.join(packagePath, 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    return;
  }
  
  console.log(`Updating package.json: ${packageJsonPath}`);
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  
  // Add type: module for ESM
  packageJson.type = 'module';
  
  // Update main/module fields
  if (packageJson.main) {
    // Remove main field (CJS) or update to ESM
    if (packageJson.module) {
      delete packageJson.main;
    } else {
      // Convert main to ESM path
      packageJson.main = packageJson.main
        .replace('.cjs', '.js')
        .replace('/index.js', '/index.js');
    }
  }
  
  // Update module field to .js (instead of .mjs)
  if (packageJson.module) {
    packageJson.module = packageJson.module.replace('.mjs', '.js');
  }
  
  // Update exports
  if (packageJson.exports) {
    for (const key in packageJson.exports) {
      const exportConfig = packageJson.exports[key];
      
      if (typeof exportConfig === 'object' && exportConfig !== null) {
        // Remove require field
        delete exportConfig.require;
        
        // Update import field to use .js
        if (exportConfig.import) {
          exportConfig.import = exportConfig.import.replace('.mjs', '.js');
        }
        
        // Ensure types come first (best practice)
        const types = exportConfig.types;
        const importPath = exportConfig.import || exportConfig.default;
        
        if (types && importPath) {
          packageJson.exports[key] = {
            types: types,
            import: importPath.replace('.mjs', '.js'),
            default: importPath.replace('.mjs', '.js')
          };
        }
      }
    }
  }
  
  // Clean up old bundled files from .mjs configs  
  const dir = path.dirname(packageJsonPath);
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    if (file.startsWith('tsup.config.bundled_') && file.endsWith('.mjs')) {
      fs.unlinkSync(path.join(dir, file));
      console.log(`  Removed bundled file: ${file}`);
    }
  });
  
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log(`✓ Updated ${packageJsonPath}`);
}

// Find all packages
function findPackages(dir) {
  const packages = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
      const packageJsonPath = path.join(fullPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        packages.push(fullPath);
      }
      // Recurse for nested packages (like ui/*)
      if (item.name === 'ui' || item.name === 'plugins' || item.name === 'treeconsole') {
        packages.push(...findPackages(fullPath));
      }
    }
  }
  
  return packages;
}

// Main execution
async function main() {
  console.log('Starting ESM migration...\n');
  
  // Update all tsup configs
  console.log('=== Updating tsup configs ===');
  const configs = findTsupConfigs(path.join(rootDir, 'packages'));
  for (const config of configs) {
    updateTsupConfig(config);
  }
  
  console.log('\n=== Updating package.json files ===');
  const packages = findPackages(path.join(rootDir, 'packages'));
  for (const pkg of packages) {
    updatePackageJson(pkg);
  }
  
  // Update root package.json
  console.log('\n=== Updating root package.json ===');
  updatePackageJson(rootDir);
  
  console.log('\n✅ ESM migration complete!');
  console.log('\nNext steps:');
  console.log('1. Run: pnpm install');
  console.log('2. Run: pnpm build');
  console.log('3. Run: pnpm test');
}

main().catch(console.error);