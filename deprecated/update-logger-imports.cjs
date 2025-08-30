#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

// Find all TS/TSX/JS/JSX files that might import logger
const files = glob.sync('packages/**/*.{ts,tsx,js,jsx}', {
  cwd: '/Users/hiroya/WebstormProjects/hierarchidb',
  ignore: ['**/node_modules/**', '**/dist/**', '**/logger.{ts,js}']
});

console.log(`Found ${files.length} files to check for logger imports`);

let updatedCount = 0;

files.forEach(file => {
  const fullPath = path.join('/Users/hiroya/WebstormProjects/hierarchidb', file);
  
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    let updatedContent = content;
    let hasChanges = false;

    // Replace relative logger imports with common-core import
    const patterns = [
      // Relative imports from utils/logger
      /import\s*\{\s*([^}]+)\s*\}\s*from\s*['"][.\/]*utils\/logger['"];?/g,
      // Relative imports from ../utils/logger or ../../utils/logger
      /import\s*\{\s*([^}]+)\s*\}\s*from\s*['"][.\/]*[.\/]+utils\/logger['"];?/g,
    ];

    patterns.forEach(pattern => {
      if (pattern.test(content)) {
        hasChanges = true;
        updatedContent = updatedContent.replace(pattern, (match, imports) => {
          console.log(`Updating ${file}: ${match.trim()}`);
          return `import { ${imports.trim()} } from '@hierarchidb/common-core';`;
        });
      }
    });

    // Update ui-core logger references
    if (file.includes('packages/ui/core/')) {
      const corePattern = /import\s*\{\s*([^}]*createLogger[^}]*)\s*\}\s*from\s*['"]\.\/utils\/logger['"];?/g;
      if (corePattern.test(content)) {
        hasChanges = true;
        updatedContent = updatedContent.replace(corePattern, (match, imports) => {
          console.log(`Updating ui-core ${file}: ${match.trim()}`);
          return `import { ${imports.trim()} } from '@hierarchidb/common-core';`;
        });
      }
    }

    if (hasChanges) {
      fs.writeFileSync(fullPath, updatedContent, 'utf8');
      updatedCount++;
      console.log(`✓ Updated: ${file}`);
    }

  } catch (error) {
    console.error(`✗ Error processing ${file}:`, error.message);
  }
});

console.log(`\nCompleted: Updated logger imports in ${updatedCount} files`);