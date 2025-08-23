#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Packages that need tsconfig fixes
const packagesToFix = [
  'packages/ui-i18n',
  'packages/ui-core',
  'packages/ui-treeconsole-toolbar',
  'packages/ui-treeconsole-speeddial',
  'packages/ui-treeconsole-footer',
  'packages/ui-treeconsole-breadcrumb',
  'packages/ui-treeconsole-trashbin',
  'packages/ui-treeconsole-treetable',
  'packages/ui-treeconsole-base',
];

function fixTsConfig(packagePath) {
  const tsconfigPath = join(rootDir, packagePath, 'tsconfig.json');

  if (!existsSync(tsconfigPath)) {
    console.log(`⚠️  No tsconfig.json found in ${packagePath}`);
    return;
  }

  try {
    let content = readFileSync(tsconfigPath, 'utf-8');
    let modified = false;

    // Fix extends path
    if (content.includes('tsconfig.base.json')) {
      content = content.replace(/["'].*?tsconfig\.base\.json["']/g, '"../../tsconfig.json"');
      modified = true;
    }

    // Parse JSON (handle comments)
    const jsonContent = JSON.parse(content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, ''));

    // Ensure compilerOptions exists
    if (!jsonContent.compilerOptions) {
      jsonContent.compilerOptions = {};
    }

    // Fix incremental and composite issues for tsup
    jsonContent.compilerOptions.composite = false;
    jsonContent.compilerOptions.incremental = false;

    // Ensure proper include pattern
    if (!jsonContent.include || jsonContent.include.length === 0) {
      jsonContent.include = ['src/**/*'];
      modified = true;
    } else if (
      jsonContent.include.includes('src') &&
      !jsonContent.include.some((p) => p.includes('**'))
    ) {
      jsonContent.include = ['src/**/*'];
      modified = true;
    }

    // Add exclude if missing
    if (!jsonContent.exclude) {
      jsonContent.exclude = ['node_modules', 'dist', '**/*.test.ts', '**/*.test.tsx'];
      modified = true;
    }

    // Remove references if empty
    if (jsonContent.references && jsonContent.references.length === 0) {
      delete jsonContent.references;
      modified = true;
    }

    writeFileSync(tsconfigPath, JSON.stringify(jsonContent, null, 2) + '\n');
    console.log(`✅ Fixed tsconfig.json for ${packagePath}`);
  } catch (error) {
    console.error(`❌ Failed to fix ${packagePath}: ${error.message}`);
  }
}

console.log('🔧 Fixing tsconfig.json files...\n');

for (const packagePath of packagesToFix) {
  fixTsConfig(packagePath);
}

console.log('\n✅ Done!');
