/**
 * @file plugin-registry-api.ts
 * @description Worker API methods for plugin registry access
 */

import { UnifiedNodeTypeRegistry } from './UnifiedNodeTypeRegistry';
import type { PluginDefinition } from './plugin';
import type { TreeId } from '@hierarchidb/common-core';

/**
 * Get all registered plugins from the registry
 */
export async function getRegisteredPlugins(): Promise<PluginDefinition<any, any, any>[]> {
  const registry = UnifiedNodeTypeRegistry.getInstance();
  const plugins: PluginDefinition<any, any, any>[] = [];
  
  // Get all registered node types
  const nodeTypes = registry.getAllNodeTypes();
  
  for (const nodeType of nodeTypes) {
    const definition = registry.get(nodeType);
    if (definition) {
      plugins.push(definition);
    }
  }
  
  return plugins;
}

/**
 * Get a specific plugin definition by node type
 */
export async function getPluginDefinition(
  nodeType: string
): Promise<PluginDefinition<any, any, any> | null> {
  const registry = UnifiedNodeTypeRegistry.getInstance();
  return registry.get(nodeType) || null;
}

/**
 * Check if a node type is registered
 */
export async function isNodeTypeRegistered(nodeType: string): Promise<boolean> {
  const registry = UnifiedNodeTypeRegistry.getInstance();
  return registry.has(nodeType);
}

/**
 * Get all node types that can be created (have UI containers)
 */
export async function getCreatableNodeTypes(): Promise<string[]> {
  const registry = UnifiedNodeTypeRegistry.getInstance();
  const creatableTypes: string[] = [];
  
  const nodeTypes = registry.getAllNodeTypes();
  for (const nodeType of nodeTypes) {
    const definition = registry.get(nodeType);
    if (definition?.ui?.dialogComponentPath) {
      creatableTypes.push(nodeType);
    }
  }
  
  return creatableTypes;
}

/**
 * Get plugins filtered by tree ID and sorted by create order
 */
export async function getPluginsForTree(treeId: TreeId): Promise<PluginDefinition<any, any, any>[]> {
  const registry = UnifiedNodeTypeRegistry.getInstance();
  const plugins: PluginDefinition<any, any, any>[] = [];
  
  const nodeTypes = registry.getAllNodeTypes();
  
  for (const nodeType of nodeTypes) {
    const definition = registry.get(nodeType);
    if (definition) {
      // Check if plugin is available for this tree
      const category = definition.category;
      if (category && (category.treeId === '*' || category.treeId === treeId)) {
        plugins.push(definition);
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
    .filter(plugin => plugin.ui?.dialogComponentPath)
    .map(plugin => plugin.nodeType);
}