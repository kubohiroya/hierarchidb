/**
 * @file example-usage.ts
 * @description Example usage of PluginIntegrationBuilder
 * This file demonstrates how to use the PluginIntegrationBuilder
 * with the results from Task 2 (PluginDefinitionBuilder) and Task 3 (PluginLoadOrderResolver)
 */

import type { PluginDefinition, NodeType } from '@hierarchidb/common-type';
import { PluginIntegrationBuilder } from './PluginIntegrationBuilder';

/**
 * Example function to demonstrate the integration workflow
 */
export async function integratePlugins(): Promise<void> {
  // Task 2 output: Map<NodeType, PluginDefinition>
  // This would come from PluginDefinitionBuilder.buildAll()
  const pluginDefinitions = new Map<NodeType, PluginDefinition>([
    [
      'folder' as NodeType,
      {
        nodeType: 'folder' as NodeType,
        name: 'folder',
        displayName: 'Folder',
        description: 'Basic folder for organizing content',
        category: {
          treeId: '*',
          menuGroup: 'basic',
          createOrder: 1,
        },
        database: {
          dbName: 'FolderDatabase',
          schema: {
            folders: '++id, nodeId, name',
            bookmarks: '++id, folderId',
            templates: '++id, folderId',
          },
          version: 1,
        },
        dependencies: [],
        priority: 1000,
        version: '1.0.0',
      },
    ],
    [
      'shape' as NodeType,
      {
        nodeType: 'shape' as NodeType,
        name: 'shape',
        displayName: 'Shape',
        description: 'Geographic shape on map',
        category: {
          treeId: 'map' as any,
          menuGroup: 'advanced',
          createOrder: 2,
        },
        database: {
          dbName: 'ShapeDatabase',
          schema: {
            shapes: '++id, nodeId, type, geometry',
          },
          version: 1,
        },
        dependencies: ['folder'],
        priority: 900,
        version: '1.0.0',
      },
    ],
  ]);

  // Task 3 output: NodeType[] (in dependency order)
  // This would come from PluginLoadOrderResolver.resolve()
  const loadOrder: NodeType[] = ['folder' as NodeType, 'shape' as NodeType];

  // Create builder instance
  const builder = new PluginIntegrationBuilder();

  // Build all integrated plugins
  console.log('Starting plugin integration...');
  const integratedPlugins = await builder.buildAll(pluginDefinitions, loadOrder);

  // Display results
  console.log(`\nIntegration complete!`);
  console.log(`Total plugins integrated: ${integratedPlugins.size}`);

  // Check individual plugins
  for (const [nodeType, plugin] of integratedPlugins) {
    console.log(`\n${nodeType}:`);
    console.log(`  - Display Name: ${plugin.displayName}`);
    console.log(`  - Has Entity Handler: ${!!plugin.entityHandler}`);
    console.log(`  - Has Lifecycle: ${!!plugin.lifecycle}`);
    console.log(`  - Has Routing: ${!!plugin.routing}`);
    console.log(`  - Default Action: ${plugin.routing.defaultAction}`);
  }

  // Example: Get a specific plugin
  const folderPlugin = builder.getIntegratedPlugin('folder' as NodeType);
  if (folderPlugin) {
    console.log('\nFolder plugin details:');
    console.log(`  - Actions: ${Object.keys(folderPlugin.routing.actions).join(', ')}`);
    
    // Example: Use the entity handler
    if (folderPlugin.entityHandler) {
      console.log('  - Entity handler is ready for use');
      // In a real scenario, you could use:
      // await folderPlugin.entityHandler.createEntity(nodeId, data);
    }
  }

  // Example: Check for missing plugins
  const missingPlugin = builder.getIntegratedPlugin('nonexistent' as NodeType);
  if (!missingPlugin) {
    console.log('\nPlugin "nonexistent" not found (as expected)');
  }
}

/**
 * Run the example
 * Note: This will fail in actual execution unless the plugin packages exist
 * and are properly configured with worker exports
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  integratePlugins().catch(console.error);
}