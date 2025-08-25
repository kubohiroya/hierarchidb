#!/usr/bin/env node

/**
 * Package Hierarchy Migration Script
 *
 * This script automates the migration of packages to the new hierarchical structure
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Package mapping configuration
const PACKAGE_MAPPINGS = [
  // Core層 (00-09)
  { old: 'packages/core', new: 'packages/00-core', name: '@hierarchidb/common-core' },
  { old: 'packages/api', new: 'packages/01-api', name: '@hierarchidb/common-api' },
  { old: 'packages/worker', new: 'packages/02-worker', name: '@hierarchidb/runtime-worker' },

  // UI Foundation層 (10)
  {
    old: 'packages/ui/theme',
    new: 'packages/10-ui-foundation/theme',
    name: '@hierarchidb/ui-foundation-theme',
    oldName: '@hierarchidb/ui-theme',
  },
  {
    old: 'packages/ui/i18n',
    new: 'packages/10-ui-foundation/i18n',
    name: '@hierarchidb/ui-foundation-i18n',
    oldName: '@hierarchidb/ui-i18n',
  },
  {
    old: 'packages/ui/core',
    new: 'packages/10-ui-foundation/core',
    name: '@hierarchidb/ui-foundation-core',
    oldName: '@hierarchidb/ui-core',
  },

  // UI Common層 (11)
  {
    old: 'packages/ui/auth',
    new: 'packages/11-ui-common/auth',
    name: '@hierarchidb/ui-common-auth',
    oldName: '@hierarchidb/ui-auth',
  },
  {
    old: 'packages/ui/layout',
    new: 'packages/11-ui-common/layout',
    name: '@hierarchidb/ui-common-layout',
    oldName: '@hierarchidb/ui-layout',
  },
  {
    old: 'packages/ui/navigation',
    new: 'packages/11-ui-common/navigation',
    name: '@hierarchidb/ui-common-navigation',
    oldName: '@hierarchidb/ui-navigation',
  },
  {
    old: 'packages/ui/routing',
    new: 'packages/11-ui-common/routing',
    name: '@hierarchidb/ui-common-routing',
    oldName: '@hierarchidb/ui-routing',
  },
  {
    old: 'packages/ui/usermenu',
    new: 'packages/11-ui-common/usermenu',
    name: '@hierarchidb/ui-common-usermenu',
    oldName: '@hierarchidb/ui-usermenu',
  },

  // UI Features層 (12) - TreeConsole
  {
    old: 'packages/ui/treeconsole/base',
    new: 'packages/12-ui-features/treeconsole/00-base',
    name: '@hierarchidb/ui-features-treeconsole-base',
    oldName: '@hierarchidb/ui-treeconsole-base',
  },
  {
    old: 'packages/ui/treeconsole/breadcrumb',
    new: 'packages/12-ui-features/treeconsole/01-parts/breadcrumb',
    name: '@hierarchidb/ui-features-treeconsole-parts-breadcrumb',
    oldName: '@hierarchidb/ui-treeconsole-breadcrumb',
  },
  {
    old: 'packages/ui/treeconsole/toolbar',
    new: 'packages/12-ui-features/treeconsole/01-parts/toolbar',
    name: '@hierarchidb/ui-features-treeconsole-parts-toolbar',
    oldName: '@hierarchidb/ui-treeconsole-toolbar',
  },
  {
    old: 'packages/ui/treeconsole/speeddial',
    new: 'packages/12-ui-features/treeconsole/01-parts/speeddial',
    name: '@hierarchidb/ui-features-treeconsole-parts-speeddial',
    oldName: '@hierarchidb/ui-treeconsole-speeddial',
  },
  {
    old: 'packages/ui/treeconsole/footer',
    new: 'packages/12-ui-features/treeconsole/01-parts/footer',
    name: '@hierarchidb/ui-features-treeconsole-parts-footer',
    oldName: '@hierarchidb/ui-treeconsole-footer',
  },
  {
    old: 'packages/ui/treeconsole/trashbin',
    new: 'packages/12-ui-features/treeconsole/01-parts/trashbin',
    name: '@hierarchidb/ui-features-treeconsole-parts-trashbin',
    oldName: '@hierarchidb/ui-treeconsole-trashbin',
  },
  {
    old: 'packages/ui/treeconsole/treetable',
    new: 'packages/12-ui-features/treeconsole/01-parts/treetable',
    name: '@hierarchidb/ui-features-treeconsole-parts-treetable',
    oldName: '@hierarchidb/ui-treeconsole-treetable',
  },

  // UI Features層 (12) - その他
  {
    old: 'packages/ui/import-export',
    new: 'packages/12-ui-features/import-export',
    name: '@hierarchidb/ui-features-import-export',
    oldName: '@hierarchidb/ui-import-export',
  },
  {
    old: 'packages/ui/file',
    new: 'packages/12-ui-features/file',
    name: '@hierarchidb/ui-features-file',
    oldName: '@hierarchidb/ui-file',
  },
  {
    old: 'packages/ui/guide',
    new: 'packages/12-ui-features/guide',
    name: '@hierarchidb/ui-features-guide',
    oldName: '@hierarchidb/ui-guide',
  },
  {
    old: 'packages/ui/monitoring',
    new: 'packages/12-ui-features/monitoring',
    name: '@hierarchidb/ui-features-monitoring',
    oldName: '@hierarchidb/ui-monitoring',
  },
  {
    old: 'packages/ui/tour',
    new: 'packages/12-ui-features/tour',
    name: '@hierarchidb/ui-features-tour',
    oldName: '@hierarchidb/ui-tour',
  },
  {
    old: 'packages/ui/landingpage',
    new: 'packages/12-ui-features/landingpage',
    name: '@hierarchidb/ui-features-landingpage',
    oldName: '@hierarchidb/ui-landingpage',
  },

  // UI Client層 (13)
  { old: 'packages/ui/client', new: 'packages/13-ui-client', name: '@hierarchidb/ui-client' },

  // UI Widgets層 (15)
  {
    old: 'packages/ui-accordion-config',
    new: 'packages/15-ui-widgets/accordion-config',
    name: '@hierarchidb/ui-widgets-accordion-config',
    oldName: '@hierarchidb/ui-accordion-config',
  },
  {
    old: 'packages/ui-country-select',
    new: 'packages/15-ui-widgets/country-select',
    name: '@hierarchidb/ui-widgets-country-select',
    oldName: '@hierarchidb/ui-country-select',
  },
  {
    old: 'packages/ui-csv-extract',
    new: 'packages/15-ui-widgets/csv-extract',
    name: '@hierarchidb/ui-widgets-csv-extract',
    oldName: '@hierarchidb/ui-csv-extract',
  },
  {
    old: 'packages/ui-datasource',
    new: 'packages/15-ui-widgets/datasource',
    name: '@hierarchidb/ui-widgets-datasource',
    oldName: '@hierarchidb/ui-datasource',
  },
  {
    old: 'packages/ui-dialog',
    new: 'packages/15-ui-widgets/dialog',
    name: '@hierarchidb/ui-widgets-dialog',
    oldName: '@hierarchidb/ui-dialog',
  },
  {
    old: 'packages/ui-lru-splitview',
    new: 'packages/15-ui-widgets/lru-splitview',
    name: '@hierarchidb/ui-widgets-lru-splitview',
    oldName: '@hierarchidb/ui-lru-splitview',
  },
  {
    old: 'packages/ui-map',
    new: 'packages/15-ui-widgets/map',
    name: '@hierarchidb/ui-widgets-map',
    oldName: '@hierarchidb/ui-map',
  },
  {
    old: 'packages/ui-validation',
    new: 'packages/15-ui-widgets/validation',
    name: '@hierarchidb/ui-widgets-validation',
    oldName: '@hierarchidb/ui-validation',
  },

  // Plugin層 (20)
  {
    old: 'packages/plugins/basemap',
    new: 'packages/20-plugins/basemap',
    name: '@hierarchidb/plugin-basemap',
  },
  {
    old: 'packages/plugins/stylemap',
    new: 'packages/20-plugins/stylemap',
    name: '@hierarchidb/plugin-stylemap',
  },
  {
    old: 'packages/plugins/folder',
    new: 'packages/20-plugins/folder',
    name: '@hierarchidb/plugin-folder',
  },
  {
    old: 'packages/plugins/project',
    new: 'packages/20-plugins/project',
    name: '@hierarchidb/plugin-project',
  },
  {
    old: 'packages/plugins/import-export',
    new: 'packages/20-plugins/import-export',
    name: '@hierarchidb/plugin-import-export',
  },
  {
    old: 'packages/plugins/shapes',
    new: 'packages/20-plugins/shapes',
    name: '@hierarchidb/plugin-shapes',
  },
  {
    old: 'packages/plugins/spreadsheet',
    new: 'packages/20-plugins/spreadsheet',
    name: '@hierarchidb/plugin-spreadsheet',
  },

  // Backend層 (30)
  { old: 'packages/backend/bff', new: 'packages/30-backend/bff', name: '@hierarchidb/backend-bff' },
  {
    old: 'packages/backend/cors-proxy',
    new: 'packages/30-backend/cors-proxy',
    name: '@hierarchidb/backend-cors-proxy',
  },

  // App層 (99)
  { old: 'packages/_app', new: 'packages/99-_app', name: '@hierarchidb/app' },
];

// Phase 1: Create new directory structure
function createDirectoryStructure() {
  console.log('📁 Creating new directory structure...');

  const directories = [
    'packages/00-core',
    'packages/01-api',
    'packages/02-worker',
    'packages/10-ui-foundation',
    'packages/11-ui-common',
    'packages/12-ui-features/treeconsole/00-base',
    'packages/12-ui-features/treeconsole/01-parts',
    'packages/12-ui-features/treeconsole/02-panel',
    'packages/13-ui-client',
    'packages/15-ui-widgets',
    'packages/20-plugins',
    'packages/30-backend',
    'packages/99-_app',
  ];

  directories.forEach((dir) => {
    const fullPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`  ✅ Created: ${dir}`);
    }
  });
}

// Phase 2: Move packages to new locations
function movePackages(dryRun = true) {
  console.log(`\n📦 ${dryRun ? '[DRY RUN] Would move' : 'Moving'} packages...`);

  PACKAGE_MAPPINGS.forEach((mapping) => {
    const oldPath = path.join(process.cwd(), mapping.old);
    const newPath = path.join(process.cwd(), mapping.new);

    if (fs.existsSync(oldPath)) {
      if (dryRun) {
        console.log(`  📋 Would move: ${mapping.old} → ${mapping.new}`);
      } else {
        // Create parent directory if needed
        const parentDir = path.dirname(newPath);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }

        // Use git mv to preserve history
        try {
          execSync(`git mv "${mapping.old}" "${mapping.new}"`, { stdio: 'pipe' });
          console.log(`  ✅ Moved: ${mapping.old} → ${mapping.new}`);
        } catch (e) {
          // If git mv fails, try regular move
          fs.renameSync(oldPath, newPath);
          console.log(`  ✅ Moved (no git): ${mapping.old} → ${mapping.new}`);
        }
      }
    } else {
      console.log(`  ⚠️  Not found: ${mapping.old}`);
    }
  });
}

// Phase 3: Update package.json files
function updatePackageJsonFiles(dryRun = true) {
  console.log(`\n📝 ${dryRun ? '[DRY RUN] Would update' : 'Updating'} package.json files...`);

  PACKAGE_MAPPINGS.forEach((mapping) => {
    const packageJsonPath = path.join(process.cwd(), mapping.new, 'package.json');

    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const oldName = packageJson.name;

      // Update package name if it changed
      if (mapping.oldName && packageJson.name === mapping.oldName) {
        packageJson.name = mapping.name;

        if (dryRun) {
          console.log(`  📋 Would update: ${oldName} → ${mapping.name}`);
        } else {
          fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
          console.log(`  ✅ Updated: ${oldName} → ${mapping.name}`);
        }
      }
    }
  });
}

// Phase 4: Update import statements
function updateImports(dryRun = true) {
  console.log(`\n🔄 ${dryRun ? '[DRY RUN] Would update' : 'Updating'} import statements...`);

  const allFiles = [];

  // Find all TypeScript and JavaScript files
  function findFiles(dir) {
    const files = fs.readdirSync(dir);
    files.forEach((file) => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (
        stat.isDirectory() &&
        !file.startsWith('.') &&
        file !== 'node_modules' &&
        file !== 'dist' &&
        file !== 'build'
      ) {
        findFiles(fullPath);
      } else if (file.match(/\.(ts|tsx|js|jsx)$/)) {
        allFiles.push(fullPath);
      }
    });
  }

  findFiles(path.join(process.cwd(), 'packages'));

  // Update imports in each file
  let updatedCount = 0;
  allFiles.forEach((file) => {
    let content = fs.readFileSync(file, 'utf8');
    let updated = false;

    PACKAGE_MAPPINGS.forEach((mapping) => {
      if (mapping.oldName) {
        const regex = new RegExp(`(['"])${mapping.oldName}(['"/])`, 'g');
        if (content.match(regex)) {
          content = content.replace(regex, `$1${mapping.name}$2`);
          updated = true;
        }
      }
    });

    if (updated) {
      if (dryRun) {
        console.log(`  📋 Would update imports in: ${path.relative(process.cwd(), file)}`);
      } else {
        fs.writeFileSync(file, content);
        console.log(`  ✅ Updated imports in: ${path.relative(process.cwd(), file)}`);
      }
      updatedCount++;
    }
  });

  console.log(`  📊 ${dryRun ? 'Would update' : 'Updated'} ${updatedCount} files`);
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');

  console.log('🚀 Package Hierarchy Migration Script');
  console.log('=====================================');

  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made');
    console.log('   Use --execute flag to actually perform migration\n');
  }

  // Phase 1: Create directories
  if (!dryRun) {
    createDirectoryStructure();
  }

  // Phase 2: Move packages
  movePackages(dryRun);

  // Phase 3: Update package.json files
  updatePackageJsonFiles(dryRun);

  // Phase 4: Update imports
  updateImports(dryRun);

  console.log('\n✨ Migration script completed!');

  if (dryRun) {
    console.log('\n📌 To execute the migration, run:');
    console.log('   node scripts/migrate-package-hierarchy.js --execute');
  } else {
    console.log('\n📌 Next steps:');
    console.log('   1. Update pnpm-workspace.yaml');
    console.log('   2. Run pnpm install');
    console.log('   3. Run pnpm build');
    console.log('   4. Run tests');
  }
}

// Run the script
main();
