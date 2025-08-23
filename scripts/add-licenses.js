#!/usr/bin/env node

import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// List of all package.json files to update (excluding node_modules)
const packageFiles = [
  'packages/api/package.json',
  'packages/app/package.json',
  'packages/bff/package.json',
  'packages/core/package.json',
  'packages/cors-proxy/package.json',
  'packages/plugins/basemap/package.json',
  'packages/plugins/_shapes_buggy/package.json',
  'packages/plugins/stylemap/package.json',
  'packages/ui-auth/package.json',
  'packages/registry/package.json',
  'packages/ui-core/package.json',
  'packages/ui-file/package.json',
  'packages/ui-i18n/package.json',
  'packages/ui-landingpage/package.json',
  'packages/ui-layout/package.json',
  'packages/ui-monitoring/package.json',
  'packages/ui-navigation/package.json',
  'packages/ui-routing/package.json',
  'packages/ui-theme/package.json',
  'packages/ui-tour/package.json',
  'packages/worker/package.json',
];

async function addLicenseToPackageJson(filePath) {
  try {
    const fullPath = join(rootDir, filePath);
    const content = await readFile(fullPath, 'utf8');
    const pkg = JSON.parse(content);

    // Add MIT license if not already present
    if (!pkg.license) {
      pkg.license = 'MIT';

      // Write back with proper formatting
      await writeFile(fullPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
      console.log(`✅ Added MIT license to ${filePath}`);
    } else if (pkg.license !== 'MIT') {
      pkg.license = 'MIT';
      await writeFile(fullPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
      console.log(`✅ Updated license to MIT in ${filePath}`);
    } else {
      console.log(`✓ ${filePath} already has MIT license`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
}

async function main() {
  console.log('Adding MIT license to all package.json files...\n');

  for (const file of packageFiles) {
    await addLicenseToPackageJson(file);
  }

  // Also check and update root package.json
  await addLicenseToPackageJson('package.json');

  console.log('\n✅ License update complete!');
}

main().catch(console.error);
