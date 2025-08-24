#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Packages to migrate to tsup
const packagesToMigrate = [
  // UI packages
  'packages/ui-core',
  'packages/registry',
  'packages/ui-auth',
  'packages/ui-i18n',
  'packages/ui-layout',
  'packages/ui-navigation',
  'packages/ui-routing',
  'packages/ui-file',
  'packages/ui-monitoring',
  'packages/ui-theme',
  'packages/ui-tour',
  'packages/ui-landingpage',

  // Plugin packages
  'packages/plugins/folder',
  'packages/plugins/basemap',
  'packages/plugins/_shapes_buggy',
  'packages/plugins/stylemap',
];

// Packages that should keep existing build tools
const skipPackages = [
  'packages/_app', // React Router + Vite
  'packages/bff', // Wrangler
  'packages/cors-proxy', // Wrangler
  'packages/ui-treeconsole-*', // Already using tsup
];

function createTsupConfig(packagePath) {
  const packageJson = JSON.parse(readFileSync(join(packagePath, 'package.json'), 'utf-8'));
  const isReactPackage = packageJson.dependencies?.react || packageJson.peerDependencies?.react;

  const config = `import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  outDir: 'dist',
  external: [
    ${isReactPackage ? "'react',\n    'react-dom',\n    '@mui/material',\n    '@mui/icons-material',\n    '@emotion/react',\n    '@emotion/styled'," : ''}
    'dexie',
    'comlink',
    'rxjs',
    /^@hierarchidb\\//
  ].filter(Boolean),
});`;

  writeFileSync(join(packagePath, 'tsup.config.ts'), config);
  console.log(`✅ Created tsup.config.ts for ${packagePath}`);
}

function updatePackageJson(packagePath) {
  const packageJsonPath = join(packagePath, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

  // Update exports
  if (packageJson.exports?.['.']) {
    packageJson.module = packageJson.module || './dist/index.mjs';
    packageJson.exports['.'] = {
      types: './dist/index.d.ts',
      import: './dist/index.mjs',
      require: './dist/index.cjs',
      default: './dist/index.mjs',
    };
  }

  // Update scripts
  if (packageJson.scripts) {
    // Keep old build script as build:tsc
    if (packageJson.scripts.build && !packageJson.scripts.build.includes('tsup')) {
      packageJson.scripts['build:tsc'] = packageJson.scripts.build;
      packageJson.scripts.build = 'tsup';
    }

    // Update dev script
    if (packageJson.scripts.dev && !packageJson.scripts.dev.includes('tsup')) {
      packageJson.scripts['dev:tsc'] = packageJson.scripts.dev;
      packageJson.scripts.dev = 'tsup --watch';
    }
  }

  // Add tsup to devDependencies
  if (!packageJson.devDependencies) {
    packageJson.devDependencies = {};
  }
  packageJson.devDependencies.tsup = '^8.3.5';

  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log(`✅ Updated package.json for ${packagePath}`);
}

async function migratePackage(packagePath) {
  const fullPath = join(rootDir, packagePath);

  if (!existsSync(fullPath)) {
    console.log(`⚠️  Skipping ${packagePath} - directory not found`);
    return;
  }

  console.log(`\n📦 Migrating ${packagePath}...`);

  try {
    // Create tsup config
    createTsupConfig(fullPath);

    // Update package.json
    updatePackageJson(fullPath);

    console.log(`✅ Migration complete for ${packagePath}`);
  } catch (error) {
    console.error(`❌ Failed to migrate ${packagePath}:`, error.message);
  }
}

async function main() {
  console.log('🚀 Starting migration to tsup...\n');

  for (const packagePath of packagesToMigrate) {
    await migratePackage(packagePath);
  }

  console.log('\n✅ Migration script complete!');
  console.log('\n📋 Next steps:');
  console.log('1. Run: pnpm install');
  console.log('2. Test build: pnpm build');
  console.log('3. Verify output in dist directories');
}

main().catch(console.error);
