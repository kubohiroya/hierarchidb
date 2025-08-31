/**
/**
 * @file plugin-registry-api.ts
 * @description Worker API methods for plugin registry access
 */

import { TreeId, NodeType } from '@hierarchidb/common-type';
import type { PluginDefinition } from '@hierarchidb/common-type';
import { PluginRegistryFacade, PluginRepository } from '@hierarchidb/runtime-worker-plugin-registry';

/**
 * Get all registered plugins from the registry
 */
export async function getRegisteredPlugins(): Promise<PluginDefinition[]> {
  const repository = new PluginRepository();
  const registry = new PluginRegistryFacade(repository);
  const plugins: PluginDefinition[] = [];

  // Get all registered plugins
  const allPlugins = await registry.getAllPlugins();
  
  for (const plugin of allPlugins) {
    plugins.push(plugin as any);
  }

  return plugins;
}

/**
 * Get a specific plugin definition by node type
 */
export async function getPluginDefinition(nodeType: string): Promise<PluginDefinition | null> {
  const repository = new PluginRepository();
  const registry = new PluginRegistryFacade(repository);
  return await registry.getPlugin(nodeType as NodeType) || null;
}

/**
 * Check if a node type is registered
 */
export async function isNodeTypeRegistered(nodeType: string): Promise<boolean> {
  const repository = new PluginRepository();
  const registry = new PluginRegistryFacade(repository);
  return await registry.isPluginAvailable(nodeType as NodeType);
}

/**
 * Get all node types that can be created (have UI containers)
 */
export async function getCreatableNodeTypes(): Promise<string[]> {
  const repository = new PluginRepository();
  const registry = new PluginRegistryFacade(repository);
  const creatableTypes: string[] = [];

  const allPlugins = await registry.getAllPlugins();
  for (const plugin of allPlugins) {
    if (plugin?.ui?.dialogComponentPath) {
      creatableTypes.push(plugin.nodeType);
    }
  }

  return creatableTypes;
}

/**
 * Get plugins filtered by tree ID and sorted by create order
 */
export async function getPluginsForTree(
  treeId: TreeId
): Promise<PluginDefinition[]> {
  const repository = new PluginRepository();
  const registry = new PluginRegistryFacade(repository);
  const plugins: PluginDefinition[] = [];

  const allPlugins = await registry.getAllPlugins();

  for (const plugin of allPlugins) {
    if (plugin) {
      // If treeId is '*', return all plugins
      if (treeId === ('*' as TreeId)) {
        plugins.push(plugin as any);
      } else {
        // Check if plugin is available for this tree
        const category = plugin.category;
        if (category && (category.treeId === '*' || category.treeId === treeId)) {
          plugins.push(plugin as any);
        }
      }
    }
  }

  // Sort by menu group and create order
  return plugins.sort((a, b) => {
    const aGroup = a.category.menuGroup || 'basic';
    const bGroup = b.category.menuGroup || 'basic';
    const aOrder = a.category.createOrder || 999;
    const bOrder = b.category.createOrder || 999;

    // Define group priority
    const groupPriority = { basic: 1, container: 2, document: 3, advanced: 4 };
    const aPriority = groupPriority[aGroup] || 999;
    const bPriority = groupPriority[bGroup] || 999;

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    return aOrder - bOrder;
  });
}

/**
 * Get creatable node types for a specific tree ID
 */
export async function getCreatableNodeTypesForTree(treeId: TreeId): Promise<string[]> {
  const plugins = await getPluginsForTree(treeId);
  return plugins
    .filter((plugin) => plugin.ui?.dialogComponentPath)
    .map((plugin) => plugin.nodeType);
}
