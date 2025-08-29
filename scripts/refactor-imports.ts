#!/usr/bin/env node
/**
 * Script to refactor imports and update package dependencies
 * - Replace devLog/devError/devWarn with console
 * - Update formatBytes and validateExternalURL imports to @hierarchidb/util
 * - Remove ResourceProjectToggle from ui-core
 * - Update package.json dependencies
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Packages to process
const packagesToProcess = [
  'packages/ui/auth',
  'packages/ui/core',
  'packages/ui/file',
  'packages/ui/i18n',
  'packages/ui/monitoring',
  'packages/ui/csv-extract',
  'packages/ui/dialog',
  'packages/ui/map',
  'packages/ui/navigation',
];

interface Replacement {
  pattern: RegExp;
  replacement: string | ((match: string, ...args: any[]) => string);
}

// Define replacements for each file type
const logReplacements: Replacement[] = [
  // Remove import statement
  {
    pattern: /import\s*\{[^}]*(?:devLog|devError|devWarn|devInfo|devDebug)[^}]*\}\s*from\s*['"]@hierarchidb\/common-core['"];?\n?/g,
    replacement: ''
  },
  // Replace devLog calls
  {
    pattern: /(\s*)devLog\((.*?)\);/g,
    replacement: '$1if (import.meta.env.DEV) {\n$1  console.log($2);\n$1}'
  },
  // Replace devError calls
  {
    pattern: /(\s*)devError\((.*?)\);/g,
    replacement: '$1if (import.meta.env.DEV) {\n$1  console.error($2);\n$1}'
  },
  // Replace devWarn calls
  {
    pattern: /(\s*)devWarn\((.*?)\);/g,
    replacement: '$1if (import.meta.env.DEV) {\n$1  console.warn($2);\n$1}'
  },
  // Replace devInfo calls
  {
    pattern: /(\s*)devInfo\((.*?)\);/g,
    replacement: '$1if (import.meta.env.DEV) {\n$1  console.info($2);\n$1}'
  },
  // Replace devDebug calls
  {
    pattern: /(\s*)devDebug\((.*?)\);/g,
    replacement: '$1if (import.meta.env.DEV) {\n$1  console.debug($2);\n$1}'
  },
];

const utilReplacements: Replacement[] = [
  // Replace formatBytes import
  {
    pattern: /import\s*\{([^}]*)\}\s*from\s*['"]@hierarchidb\/common-core['"];?/g,
    replacement: (match, imports) => {
      const importList = imports.split(',').map((s: string) => s.trim());
      const utilImports = importList.filter((imp: string) => 
        ['formatBytes', 'validateExternalURL', 'clampPercentage', 'getMemorySeverity'].includes(imp)
      );
      const otherImports = importList.filter((imp: string) => 
        !['formatBytes', 'validateExternalURL', 'clampPercentage', 'getMemorySeverity'].includes(imp) &&
        !['devLog', 'devError', 'devWarn', 'devInfo', 'devDebug'].includes(imp)
      );
      
      let result = '';
      if (utilImports.length > 0) {
        result += `import { ${utilImports.join(', ')} } from '@hierarchidb/util';\n`;
      }
      if (otherImports.length > 0) {
        result += `import { ${otherImports.join(', ')} } from '@hierarchidb/common-core';\n`;
      }
      return result || '';
    }
  },
];

function processFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;
  
  // First apply util replacements
  for (const { pattern, replacement } of utilReplacements) {
    content = content.replace(pattern, replacement as any);
  }
  
  // Then apply log replacements
  for (const { pattern, replacement } of logReplacements) {
    content = content.replace(pattern, replacement as any);
  }
  
  // Clean up empty lines
  content = content.replace(/\n\n\n+/g, '\n\n');
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Updated: ${filePath}`);
  }
}

function updatePackageJson(packageDir: string) {
  const packageJsonPath = path.join(packageDir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) return;
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  let modified = false;
  
  // Check if we need to add @hierarchidb/util
  const srcDir = path.join(packageDir, 'src');
  let needsUtil = false;
  let needsCommonCore = false;
  let needsCommonType = false;
  
  // Recursively check all source files
  function checkFiles(dir: string) {
    if (!fs.existsSync(dir)) return;
    
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        checkFiles(filePath);
      } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        const content = fs.readFileSync(filePath, 'utf-8');
        if (content.includes('@hierarchidb/util')) needsUtil = true;
        if (content.includes('@hierarchidb/common-core')) needsCommonCore = true;
        if (content.includes('@hierarchidb/common-type')) needsCommonType = true;
      }
    }
  }
  
  checkFiles(srcDir);
  
  // Update dependencies
  if (packageJson.dependencies) {
    if (needsUtil && !packageJson.dependencies['@hierarchidb/util']) {
      packageJson.dependencies['@hierarchidb/util'] = 'workspace:*';
      modified = true;
    }
    if (needsCommonType && !packageJson.dependencies['@hierarchidb/common-type']) {
      packageJson.dependencies['@hierarchidb/common-type'] = 'workspace:*';
      modified = true;
    }
    if (!needsCommonCore && packageJson.dependencies['@hierarchidb/common-core']) {
      delete packageJson.dependencies['@hierarchidb/common-core'];
      modified = true;
    }
  }
  
  if (modified) {
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    console.log(`✅ Updated package.json: ${packageJsonPath}`);
  }
}

function processPackage(packageDir: string) {
  console.log(`\n📦 Processing ${packageDir}...`);
  
  // Process all TypeScript files
  function processDirectory(dir: string) {
    if (!fs.existsSync(dir)) return;
    
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory() && file !== 'node_modules' && file !== 'dist') {
        processDirectory(filePath);
      } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        processFile(filePath);
      }
    }
  }
  
  const srcDir = path.join(rootDir, packageDir, 'src');
  processDirectory(srcDir);
  
  // Update package.json
  updatePackageJson(path.join(rootDir, packageDir));
}

// Main execution
console.log('🚀 Starting refactoring...\n');

for (const packagePath of packagesToProcess) {
  processPackage(packagePath);
}

// Special handling for ui-core to remove ResourceProjectToggle
const resourceTogglePath = path.join(rootDir, 'packages/ui/core/src/components/ResourceProjectToggle');
if (fs.existsSync(resourceTogglePath)) {
  fs.rmSync(resourceTogglePath, { recursive: true, force: true });
  console.log('\n✅ Removed ResourceProjectToggle from ui-core');
}

// Update ui-core index to remove ResourceProjectToggle export
const uiCoreIndexPath = path.join(rootDir, 'packages/ui/core/src/index.ts');
if (fs.existsSync(uiCoreIndexPath)) {
  let content = fs.readFileSync(uiCoreIndexPath, 'utf-8');
  content = content.replace(/export.*ResourceProjectToggle.*\n/g, '');
  fs.writeFileSync(uiCoreIndexPath, content);
  console.log('✅ Updated ui-core index.ts');
}

console.log('\n✨ Refactoring complete!');
console.log('\nNext steps:');
console.log('1. Run: pnpm install');
console.log('2. Run: pnpm typecheck');
console.log('3. Run: pnpm build');