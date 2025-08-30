#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

// Find all vitest.setup.ts files (excluding the base file and already updated ones)
const setupFiles = glob.sync('**/vitest.setup.ts', {
  cwd: '/Users/hiroya/WebstormProjects/hierarchidb',
  ignore: ['node_modules/**', 'dist/**', 'vitest.setup.menu.ts']
});

console.log(`Found ${setupFiles.length} vitest setup files to update`);

setupFiles.forEach(setupFile => {
  const fullPath = path.join('/Users/hiroya/WebstormProjects/hierarchidb', setupFile);
  
  // Skip already updated files
  if (setupFile.includes('ui/core/vitest.setup.ts') || 
      setupFile.includes('runtime/worker/vitest.setup.ts')) {
    console.log(`Skipping already updated: ${setupFile}`);
    return;
  }
  
  console.log(`Updating: ${setupFile}`);
  
  // Determine relative path to base setup
  const depth = setupFile.split('/').length - 1;
  const relativePath = '../'.repeat(depth) + 'vitest.setup.base';
  
  // Create simple setup that imports base
  const newContent = `/**
 * ${setupFile.split('/').slice(-2, -1)[0] || 'Package'} Test Setup
 * Uses base vitest setup configuration
 */

// Import base setup (includes common mocks and utilities)
import '${relativePath}';

// Package-specific setup can be added here if needed
`;
  
  try {
    fs.writeFileSync(fullPath, newContent, 'utf8');
    console.log(`✓ Updated: ${setupFile}`);
  } catch (error) {
    console.error(`✗ Failed to update ${setupFile}:`, error.message);
  }
});

console.log(`\nCompleted updating ${setupFiles.length} vitest setup files`);