#!/usr/bin/env node

import { PluginDefinitionBuilder, type PackageJsonContent } from './plugin-definition-builder';
import * as fs from 'fs';
import * as path from 'path';

// テスト用のPackageJsonReaderの実装
class MockPackageJsonReader {
  async readAllPluginPackageJsons(): Promise<Map<string, PackageJsonContent>> {
    const packages = new Map<string, PackageJsonContent>();
    
    // 実際のプラグインパッケージを読み込む
    const pluginPackages = [
      'folder-plugin',
      'shape-plugin',
      'location-plugin',
      'basemap-plugin',
      'project-plugin',
      'route-plugin',
      'propertyresolver-plugin',
      'stylemap-plugin'
    ];
    
    for (const pkg of pluginPackages) {
      const packagePath = path.join(
        process.cwd(),
        '..',
        'packages',
        'node-type',
        pkg,
        'package.json'
      );
      
      if (fs.existsSync(packagePath)) {
        try {
          const content = fs.readFileSync(packagePath, 'utf-8');
          const packageJson = JSON.parse(content) as PackageJsonContent;
          packages.set(`@hierarchidb/node-type-${pkg}`, packageJson);
        } catch (error) {
          console.error(`Failed to read ${packagePath}:`, error);
        }
      }
    }
    
    return packages;
  }
}

async function runTest() {
  console.log('=== PluginDefinitionBuilder Test ===\n');
  
  // PackageJsonReaderのモック実装を使用
  const reader = new MockPackageJsonReader();
  const packages = await reader.readAllPluginPackageJsons();
  
  console.log(`Found ${packages.size} plugin packages\n`);
  
  // PluginDefinitionBuilderを使用
  const builder = new PluginDefinitionBuilder();
  const definitions = builder.buildDefinitions(packages);
  
  console.log(`\n=== Generated Plugin Definitions ===\n`);
  
  // 各プラグイン定義の詳細を表示
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
  
  // 検証結果
  console.log('\n=== Validation Results ===\n');
  
  // 1. すべてのプラグインがPluginDefinitionに変換されたか
  const convertedCount = definitions.size;
  const expectedCount = packages.size;
  console.log(`✓ Converted ${convertedCount}/${expectedCount} plugins`);
  
  // 2. folder以外のプラグインにfolder依存が追加されているか
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
  
  // 3. 必須フィールドに既定値が設定されているか
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
  
  // 4. データベーススキーマが正しく生成されているか
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
  
  // 詳細なテスト結果を返す
  return {
    totalPackages: packages.size,
    convertedCount: definitions.size,
    hasAllDependencies: folderDependencyCheck,
    hasAllDefaults: defaultValuesCheck,
    hasValidSchemas: schemaCheck
  };
}

runTest().catch(console.error);