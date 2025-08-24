#!/usr/bin/env node

/**
 * Plugin Dependency Validation Script
 * Ensures plugins don't depend on forbidden packages (worker, etc.)
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Forbidden dependencies for plugins
const FORBIDDEN_DEPENDENCIES = [
  '@hierarchidb/runtime-worker',
  '@hierarchidb/app',
];

// Allowed dependencies for plugins
const ALLOWED_DEPENDENCIES = [
  '@hierarchidb/common-core',
  '@hierarchidb/common-api',
  '@hierarchidb/ui-core',
  '@hierarchidb/ui-client',
  '@hierarchidb/ui-*', // UI packages are allowed
];

// Allowed external dependencies
const ALLOWED_EXTERNAL = [
  'react',
  'react-dom',
  '@mui/material',
  '@mui/icons-material',
  '@mui/system',
  '@mui/x-tree-view',
  '@emotion/react',
  '@emotion/styled',
  'maplibre-gl',
  'dexie',
  'comlink',
  'rxjs',
  'notistack',
  'allotment',
  'pako',
  'papaparse',
  'xlsx',
];

/**
 * Get all plugin directories
 */
function getPluginDirs() {
  const pluginsDir = join(__dirname, '../packages/plugins');
  return readdirSync(pluginsDir)
    .filter(name => !name.startsWith('.'))
    .map(name => join(pluginsDir, name))
    .filter(path => statSync(path).isDirectory());
}

/**
 * Check if dependency matches allowed pattern
 */
function isDependencyAllowed(dep) {
  // Check exact matches
  if (ALLOWED_DEPENDENCIES.includes(dep)) return true;
  if (ALLOWED_EXTERNAL.includes(dep)) return true;
  
  // Check patterns (like @hierarchidb/ui-*)
  for (const pattern of ALLOWED_DEPENDENCIES) {
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      if (dep.startsWith(prefix)) return true;
    }
  }
  
  return false;
}

/**
 * Validate package.json dependencies
 */
function validatePackageJson(pluginPath) {
  const packageJsonPath = join(pluginPath, 'package.json');
  const pluginName = pluginPath.split('/').pop();
  
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    const errors = [];
    
    // Check dependencies
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      ...packageJson.peerDependencies
    };
    
    for (const [dep, version] of Object.entries(allDeps)) {
      // Skip non-string values (can happen with overrides)
      if (typeof dep !== 'string') continue;
      
      // Check forbidden dependencies
      if (FORBIDDEN_DEPENDENCIES.includes(dep)) {
        errors.push({
          type: 'FORBIDDEN_DEPENDENCY',
          dependency: dep,
          message: `Plugin "${pluginName}" cannot depend on "${dep}"`
        });
      }
      
      // Check if dependency is allowed
      if (dep.startsWith('@hierarchidb/') && !isDependencyAllowed(dep)) {
        errors.push({
          type: 'INVALID_INTERNAL_DEPENDENCY',
          dependency: dep,
          message: `Plugin "${pluginName}" cannot depend on internal package "${dep}"`
        });
      }
    }
    
    return { pluginName, errors };
    
  } catch (error) {
    return {
      pluginName,
      errors: [{
        type: 'PACKAGE_JSON_ERROR',
        message: `Failed to read package.json: ${error.message}`
      }]
    };
  }
}

/**
 * Validate tsup.config.ts external dependencies
 */
function validateTsupConfig(pluginPath) {
  const tsupConfigPath = join(pluginPath, 'tsup.config.ts');
  const pluginName = pluginPath.split('/').pop();
  
  try {
    const tsupConfig = readFileSync(tsupConfigPath, 'utf-8');
    const errors = [];
    
    // Extract external array from config
    const externalMatches = tsupConfig.match(/external:\s*\[([\s\S]*?)\]/g);
    
    if (externalMatches) {
      for (const match of externalMatches) {
        // Extract dependency strings
        const deps = match.match(/'([^']+)'/g) || [];
        
        for (const depMatch of deps) {
          const dep = depMatch.slice(1, -1); // Remove quotes
          
          if (FORBIDDEN_DEPENDENCIES.includes(dep)) {
            errors.push({
              type: 'FORBIDDEN_EXTERNAL',
              dependency: dep,
              message: `Plugin "${pluginName}" lists forbidden dependency "${dep}" as external in tsup.config.ts`
            });
          }
        }
      }
    }
    
    return { pluginName, errors };
    
  } catch (error) {
    // tsup.config.ts might not exist, which is fine
    return { pluginName, errors: [] };
  }
}

/**
 * Validate source code imports
 */
function validateSourceImports(pluginPath) {
  const pluginName = pluginPath.split('/').pop();
  const srcPath = join(pluginPath, 'src');
  const errors = [];
  
  if (!statSync(srcPath).isDirectory()) {
    return { pluginName, errors: [] };
  }
  
  function scanDirectory(dir) {
    const entries = readdirSync(dir);
    
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
        try {
          const content = readFileSync(fullPath, 'utf-8');
          
          // Find import statements
          const importMatches = content.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g) || [];
          
          for (const importMatch of importMatches) {
            const depMatch = importMatch.match(/from\s+['"]([^'"]+)['"]/);
            if (depMatch) {
              const dep = depMatch[1];
              
              if (FORBIDDEN_DEPENDENCIES.includes(dep)) {
                const relativePath = fullPath.replace(pluginPath + '/', '');
                errors.push({
                  type: 'FORBIDDEN_IMPORT',
                  dependency: dep,
                  file: relativePath,
                  message: `Plugin "${pluginName}" imports forbidden dependency "${dep}" in ${relativePath}`
                });
              }
            }
          }
        } catch (error) {
          // Skip files that can't be read
        }
      }
    }
  }
  
  scanDirectory(srcPath);
  return { pluginName, errors };
}

/**
 * Main validation function
 */
async function validatePluginDependencies() {
  console.log('🔍 Validating plugin dependencies...\n');
  
  const pluginDirs = getPluginDirs();
  const allErrors = [];
  
  for (const pluginDir of pluginDirs) {
    console.log(`📦 Validating ${pluginDir.split('/').pop()}...`);
    
    // Validate package.json
    const packageResult = validatePackageJson(pluginDir);
    if (packageResult.errors.length > 0) {
      allErrors.push(...packageResult.errors);
    }
    
    // Validate tsup.config.ts
    const tsupResult = validateTsupConfig(pluginDir);
    if (tsupResult.errors.length > 0) {
      allErrors.push(...tsupResult.errors);
    }
    
    // Validate source imports
    const sourceResult = validateSourceImports(pluginDir);
    if (sourceResult.errors.length > 0) {
      allErrors.push(...sourceResult.errors);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('🔍 PLUGIN DEPENDENCY VALIDATION REPORT');
  console.log('='.repeat(80));
  
  if (allErrors.length === 0) {
    console.log('\n✅ All plugins follow dependency rules correctly!\n');
    return true;
  }
  
  console.log(`\n❌ Found ${allErrors.length} dependency violations:\n`);
  
  // Group errors by type
  const errorsByType = {};
  for (const error of allErrors) {
    if (!errorsByType[error.type]) {
      errorsByType[error.type] = [];
    }
    errorsByType[error.type].push(error);
  }
  
  for (const [type, errors] of Object.entries(errorsByType)) {
    console.log(`## ${type} (${errors.length} errors)`);
    for (const error of errors) {
      console.log(`   ❌ ${error.message}`);
      if (error.file) {
        console.log(`      📁 File: ${error.file}`);
      }
      if (error.dependency) {
        console.log(`      📦 Dependency: ${error.dependency}`);
      }
    }
    console.log();
  }
  
  console.log('🔧 How to fix these issues:');
  console.log('   1. Remove forbidden dependencies from package.json');
  console.log('   2. Remove forbidden externals from tsup.config.ts');
  console.log('   3. Replace forbidden imports with allowed alternatives:');
  console.log('      ❌ @hierarchidb/worker → ✅ @hierarchidb/api');
  console.log('      ❌ Direct worker imports → ✅ Plugin patterns from @hierarchidb/core');
  console.log();
  
  return false;
}

// Generate ESLint rule for import restrictions
function generateESlintRule() {
  return {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@hierarchidb/runtime-worker'],
            message: 'Plugins cannot import from @hierarchidb/worker. Use @hierarchidb/api or @hierarchidb/core instead.'
          },
          {
            group: ['@hierarchidb/app'],
            message: 'Plugins cannot import from @hierarchidb/app.'
          }
        ]
      }
    ]
  };
}

// Export for use in other scripts
export { validatePluginDependencies, generateESlintRule, FORBIDDEN_DEPENDENCIES, ALLOWED_DEPENDENCIES };

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  validatePluginDependencies()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Validation failed:', error);
      process.exit(1);
    });
}