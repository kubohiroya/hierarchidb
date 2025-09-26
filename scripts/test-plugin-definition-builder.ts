#!/usr/bin/env node

import { PluginDefinitionBuilder, type PluginManifestContent } from './plugin-definition-builder.js';
import * as fs from 'fs';
import * as path from 'path';
import { loadPluginManifestFromFile } from '../tools/plugin-manifest-loader.js';

const repoRoot = path.resolve(process.cwd());

// Plugin manifest reader (utility for manual verification)
class MockPluginManifestReader {
  async readAllPluginManifests(): Promise<Map<string, PluginManifestContent | undefined>> {
    const packages = new Map<string, PluginManifestContent | undefined>();

    const pluginPackages = [
      'folder-plugin',
      'basemap-plugin',
      'shape-plugin',
      'location-plugin',
      'route-plugin',
      'resolver-plugin',
      'styler-plugin',
      'linker-plugin',
      'timeline-plugin',
      'spreadsheet-plugin',
    ];

    for (const pkg of pluginPackages) {
      const manifestPath = path.join(
        repoRoot,
        'packages',
        'plugins',
        pkg,
        'src',
        'extension',
        'plugin-manifest.ts'
      );

      if (fs.existsSync(manifestPath)) {
        try {
          const manifest = loadPluginManifestFromFile(manifestPath, { silent: true }) as PluginManifestContent | undefined;
          packages.set(`@hierarchidb/plugins-${pkg}`, manifest);
        } catch (error) {
          console.error(`Failed to load manifest ${manifestPath}:`, error);
        }
      } else {
        console.warn(`Manifest not found for ${pkg} (${manifestPath})`);
        packages.set(`@hierarchidb/plugins-${pkg}`, undefined);
      }
    }

    return packages;
  }
}

async function runTest() {
  console.log('=== PluginDefinitionBuilder Test ===\n');
  
  // Read manifests
  const reader = new MockPluginManifestReader();
  const packages = await reader.readAllPluginManifests();
  
  console.log(`Found ${packages.size} plugin packages\n`);
  
  //  PluginDefinitionBuilder
  const builder = new PluginDefinitionBuilder();
  const definitions = builder.buildDefinitions(packages);
  
  console.log(`\n=== Generated Plugin Definitions ===\n`);
  
    for (const [nodeType, definition] of definitions.entries()) {
    console.log(`\n[${nodeType}]`);
    console.log(`  Name: ${definition.name}`);
    console.log(`  Display Name: ${definition.displayName}`);
    console.log(`  Version: ${definition.version}`);
    console.log(`  Priority: ${definition.priority}`);
    
    if (definition.icon) {
      console.log(`  Icon:`);
      console.log(`    - MUI: ${definition.icon.muiIconName}`);
      console.log(`    - Emoji: ${definition.icon.emoji}`);
      console.log(`    - Color: ${definition.icon.color}`);
    }
    
    console.log(`  Category:`);
    console.log(`    - TreeId: ${definition.category.treeId}`);
    console.log(`    - Menu Group: ${definition.category.menuGroup}`);
    console.log(`    - Create Order: ${definition.category.createOrder}`);
    
    console.log(`  Database:`);
    console.log(`    - DB Name: ${definition.database.dbName}`);
    console.log(`    - Schema: ${JSON.stringify(definition.database.schema)}`);
    console.log(`    - Version: ${definition.database.version}`);
    
    console.log(`  Dependencies: ${definition.dependencies.join(', ') || '(none)'}`);
    
    if (definition.extends) {
      console.log(`  Extends: ${definition.extends}`);
    }
    
    if (definition.validation) {
      console.log(`  Validation:`);
      if (definition.validation.namePattern) {
        console.log(`    - Name Pattern: ${definition.validation.namePattern}`);
      }
      if (definition.validation.maxChildren !== undefined) {
        console.log(`    - Max Children: ${definition.validation.maxChildren}`);
      }
      if (definition.validation.allowedChildTypes) {
        console.log(`    - Allowed Child Types: ${definition.validation.allowedChildTypes.join(', ')}`);
      }
    }
  }
  
    console.log('\n=== Validation Results ===\n');
  
  //  1. PluginDefinition
  const convertedCount = definitions.size;
  const expectedCount = Array.from(packages.values()).filter((m): m is PluginManifestContent => !!m).length;
  console.log(`✓ Converted ${convertedCount}/${expectedCount} plugins`);
  
  //  2. folderfolder
  let folderDependencyCheck = true;
  for (const [nodeType, definition] of definitions.entries()) {
    if (nodeType !== 'folder' as any && nodeType !== 'folder-plugin' as any) {
      if (!definition.dependencies.includes('folder') && !definition.dependencies.includes('folder-plugin')) {
        console.log(`✗ ${nodeType} is missing folder dependency`);
        folderDependencyCheck = false;
      }
    }
  }
  if (folderDependencyCheck) {
    console.log('✓ All non-folder plugins have folder dependency');
  }
  
  //  3.
  let defaultValuesCheck = true;
  for (const [nodeType, definition] of definitions.entries()) {
    if (!definition.name || !definition.displayName || !definition.version) {
      console.log(`✗ ${nodeType} is missing required fields`);
      defaultValuesCheck = false;
    }
    if (!definition.icon || !definition.category || !definition.database) {
      console.log(`✗ ${nodeType} is missing default configuration`);
      defaultValuesCheck = false;
    }
  }
  if (defaultValuesCheck) {
    console.log('✓ All plugins have required fields and default values');
  }
  
  //  4.
  let schemaCheck = true;
  for (const [nodeType, definition] of definitions.entries()) {
    const schema = Object.values(definition.database.schema)[0];
    if (!schema || !schema.includes('&id') || !schema.includes('nodeId')) {
      console.log(`✗ ${nodeType} has invalid database schema: ${schema}`);
      schemaCheck = false;
    }
  }
  if (schemaCheck) {
    console.log('✓ All plugins have valid database schemas');
  }
  
  console.log('\n=== Test Complete ===');
  
    return {
    totalPackages: packages.size,
    convertedCount: definitions.size,
    hasAllDependencies: folderDependencyCheck,
    hasAllDefaults: defaultValuesCheck,
    hasValidSchemas: schemaCheck
  };
}

runTest().catch(console.error);
