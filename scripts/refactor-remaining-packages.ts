#!/usr/bin/env node
/**
 * Script to refactor remaining packages (node-type, runtime)
 * - Update imports from common-core to common-type for type definitions
 * - Remove unnecessary common-core dependencies from package.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Packages to process
const packagesToProcess = [
  // node-type packages
  'packages/node-type/basemap-plugin',
  'packages/node-type/folder-plugin',
  'packages/node-type/shape-plugin',
  'packages/node-type/spreadsheet-plugin',
  'packages/node-type/stylemap-plugin',
  // runtime packages
  'packages/runtime/plugin-dialog',
  'packages/runtime/plugin-registry',
  'packages/runtime/worker',
];

interface Replacement {
  pattern: RegExp;
  replacement: string | ((match: string, ...args: any[]) => string);
}

// Type imports that should come from common-type
const typeImports = [
  'NodeType', 'NodeId', 'TreeId', 'EntityId', 'TreeNode', 'Tree',
  'WorkingCopy', 'WorkingCopyId', 'WorkingCopyProperties',
  'EntityMetadata', 'EntityType', 'PeerEntity', 'GroupEntity', 'RelationalEntity',
  'Timestamp', 'Seq', 'SubscriptionId', 'TreeNodeEvent', 'TreeChangeEvent',
  'ClipboardData', 'TreeViewState', 'CommitResult', 'EntityReferenceHints',
  'ISimpleNodeTypeRegistry', 'NodeTypeConfig', 'IPluginRegistry',
  'PluginDefinition', 'NodeTypeDefinition', 'EntityHandler',
  'SubscriptionFilter', 'CommandEnvelope', 'ObserveNodePayload'
];

// Functions/utilities that are being removed or need special handling
const utilityImports = ['generateNodeId', 'generateEntityId'];

// Classes and other runtime imports that stay in common-core
const coreImports = [
  'SingletonMixin', 'BaseNodeTypeRegistry', 'NodeDefinitionRegistry',
  'serializeTreeNode', 'deserializeTreeNode', 'EntityHandler as BaseEntityHandler'
];

function processTypeScriptFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;
  
  // Process each import statement from common-core
  const importRegex = /import\s+(?:type\s+)?{([^}]+)}\s+from\s+['"]@hierarchidb\/common-core['"];?/g;
  const importTypeRegex = /import\s+type\s+{([^}]+)}\s+from\s+['"]@hierarchidb\/common-core['"];?/g;
  
  const allImports: { types: Set<string>, core: Set<string>, utils: Set<string> } = {
    types: new Set(),
    core: new Set(),
    utils: new Set()
  };
  
  // Collect all imports
  content.replace(importRegex, (match, imports) => {
    const importList = imports.split(',').map((s: string) => s.trim());
    importList.forEach((imp: string) => {
      // Handle 'as' aliases
      const baseName = imp.split(' as ')[0].trim();
      
      if (typeImports.includes(baseName)) {
        allImports.types.add(imp);
      } else if (utilityImports.includes(baseName)) {
        allImports.utils.add(imp);
      } else if (coreImports.some(ci => ci === imp || ci.startsWith(baseName))) {
        allImports.core.add(imp);
      } else {
        // Default to type if it looks like a type (starts with capital or I)
        if (/^[A-Z]/.test(baseName)) {
          allImports.types.add(imp);
        } else {
          allImports.utils.add(imp);
        }
      }
    });
    return match;
  });
  
  // Remove all common-core imports
  content = content.replace(/import\s+(?:type\s+)?{[^}]+}\s+from\s+['"]@hierarchidb\/common-core['"];?\n?/g, '');
  
  // Add new imports at the top of the file (after any leading comments)
  let newImports = '';
  
  if (allImports.types.size > 0) {
    newImports += `import type { ${Array.from(allImports.types).join(', ')} } from '@hierarchidb/common-type';\n`;
  }
  
  // For generate functions, add them to common-type import temporarily
  // (they should be moved to common-type or a utility package)
  if (allImports.utils.size > 0) {
    const utilsArray = Array.from(allImports.utils);
    if (utilsArray.some(u => u.includes('generate'))) {
      // Add generate functions to type import for now
      newImports += `import { ${utilsArray.join(', ')} } from '@hierarchidb/common-type';\n`;
    }
  }
  
  if (allImports.core.size > 0) {
    newImports += `import { ${Array.from(allImports.core).join(', ')} } from '@hierarchidb/common-core';\n`;
  }
  
  // Insert new imports after the first line if it's a comment, otherwise at the beginning
  if (content.startsWith('//') || content.startsWith('/*')) {
    const firstNewline = content.indexOf('\n');
    content = content.slice(0, firstNewline + 1) + newImports + content.slice(firstNewline + 1);
  } else {
    content = newImports + content;
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
  
  // Check if we need common-type
  const srcDir = path.join(packageDir, 'src');
  let needsCommonType = false;
  let needsCommonCore = false;
  
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
        if (content.includes('@hierarchidb/common-type')) needsCommonType = true;
        if (content.includes('@hierarchidb/common-core')) needsCommonCore = true;
      }
    }
  }
  
  checkFiles(srcDir);
  
  // Update dependencies
  if (packageJson.dependencies) {
    // Add common-type if needed
    if (needsCommonType && !packageJson.dependencies['@hierarchidb/common-type']) {
      packageJson.dependencies['@hierarchidb/common-type'] = 'workspace:*';
      modified = true;
    }
    
    // Remove common-core if not needed
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
        processTypeScriptFile(filePath);
      }
    }
  }
  
  const srcDir = path.join(rootDir, packageDir, 'src');
  processDirectory(srcDir);
  
  // Update package.json
  updatePackageJson(path.join(rootDir, packageDir));
}

// Main execution
console.log('🚀 Starting refactoring for remaining packages...\n');

for (const packagePath of packagesToProcess) {
  processPackage(packagePath);
}

console.log('\n✨ Refactoring complete!');
console.log('\nNext steps:');
console.log('1. Run: pnpm install');
console.log('2. Run: pnpm typecheck');
console.log('3. Run: pnpm build');