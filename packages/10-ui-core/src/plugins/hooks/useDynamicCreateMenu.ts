import { useState, useEffect } from 'react';
import type { NodeId, CreateMenuItem, CreateMenuItemOrDivider, IconComponent } from '@hierarchidb/00-core';
import { getUIPluginRegistry } from '../registry/UIPluginRegistry';
import { NodeDataAdapter } from '../adapters/NodeDataAdapter';

/**
 * Dynamic Create Menu Hook
 *
 * Generates context-aware create menu items based on:
 * - Parent node capabilities
 * - Available plugins
 * - User permissions
 * - Worker-side restrictions
 */
export function useDynamicCreateMenu(
  parentNodeId: NodeId,
  nodeAdapter: NodeDataAdapter
): {
  readonly menuItems: readonly CreateMenuItemOrDivider[];
  readonly loading: boolean;
  readonly error: string | null;
} {
  const [menuItems, setMenuItems] = useState<readonly CreateMenuItemOrDivider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadMenuItems() {
      try {
        setLoading(true);
        setError(null);

        // Get parent node information
        const parentNode = await nodeAdapter.getWorkerAPI().getTreeNode(parentNodeId);
        const parentPlugin = getUIPluginRegistry().get(parentNode.nodeType);

        // Check if parent can have children
        if (!parentPlugin?.capabilities.canHaveChildren) {
          if (!isCancelled) {
            setMenuItems([]);
            setLoading(false);
          }
          return;
        }

        // Get all available plugins
        const allPlugins = getUIPluginRegistry().getAll();

        // Filter for creatable plugins
        const creatablePlugins = allPlugins.filter((plugin) => plugin.capabilities.canCreate);

        // Get allowed child types from Worker layer
        const allowedChildTypes = await getWorkerAllowedChildTypes(
          nodeAdapter,
          parentNode.nodeType
        );

        // Filter plugins by allowed types
        const allowedPlugins = creatablePlugins.filter((plugin) =>
          allowedChildTypes.includes(plugin.nodeType)
        );

        // Check permissions for each plugin
        const permissionCheckedPlugins = await checkPluginPermissions(allowedPlugins, parentNodeId);

        // Build menu items
        const items = permissionCheckedPlugins.map((plugin) => ({
          nodeType: plugin.nodeType,
          label: plugin.displayName,
          description: plugin.description,
          icon: plugin.components.icon,
          group: plugin.menu.group,
          order: plugin.menu.createOrder,
          onClick: () => {
            // This will be provided by the consuming component
            console.log(`Create ${plugin.nodeType} in ${parentNodeId}`);
          },
        }));

        // Sort by order within groups
        items.sort((a, b) => a.order - b.order);

        // Group items with dividers
        const groupedItems = groupMenuItems(items);

        if (!isCancelled) {
          setMenuItems(groupedItems);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading create menu items:', err);
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load menu items');
          setMenuItems([]);
          setLoading(false);
        }
      }
    }

    loadMenuItems();

    return () => {
      isCancelled = true;
    };
  }, [parentNodeId, nodeAdapter]);

  return { menuItems, loading, error };
}

/**
 * Get allowed child types from Worker layer
 */
async function getWorkerAllowedChildTypes(
  nodeAdapter: NodeDataAdapter,
  parentNodeType: string
): Promise<readonly string[]> {
  try {
    // Try to get from Worker API if method exists
    const workerAPI = nodeAdapter.getWorkerAPI();
    if (workerAPI?.getAllowedChildTypes) {
      return await workerAPI.getAllowedChildTypes(parentNodeType);
    }

    // Fallback: allow all plugin types
    const allPlugins = getUIPluginRegistry().getAll();
    return allPlugins.map((p) => p.nodeType);
  } catch (error) {
    console.warn('Failed to get allowed child types, using all plugins:', error);
    const allPlugins = getUIPluginRegistry().getAll();
    return allPlugins.map((p) => p.nodeType);
  }
}

/**
 * Check permissions for each plugin
 */
async function checkPluginPermissions(
  plugins: readonly any[],
  parentNodeId: NodeId
): Promise<readonly any[]> {
  const allowedPlugins: any[] = [];

  for (const plugin of plugins) {
    try {
      // Check plugin-specific permissions
      if (plugin.hooks.beforeShowCreateDialog) {
        const result = await plugin.hooks.beforeShowCreateDialog({
          parentNodeId,
          nodeType: plugin.nodeType,
          context: {
            userId: 'current-user', // TODO: Get from context
            permissions: [],
            currentPath: [],
            selectedNodes: [],
            theme: 'light',
            locale: 'en',
          },
        });

        if (result?.proceed) {
          allowedPlugins.push(plugin);
        }
      } else {
        // No permission check, allow by default
        allowedPlugins.push(plugin);
      }
    } catch (error) {
      console.warn(`Permission check failed for ${plugin.nodeType}:`, error);
      // On error, exclude the plugin for safety
    }
  }

  return allowedPlugins;
}

/**
 * Group menu items by category with dividers
 */
function groupMenuItems(items: readonly CreateMenuItem[]): readonly CreateMenuItemOrDivider[] {
  const groups = ['basic', 'container', 'document', 'advanced'] as const;
  const result: CreateMenuItemOrDivider[] = [];

  for (const group of groups) {
    const groupItems = items.filter((item) => item.group === group);

    if (groupItems.length > 0) {
      // Add divider between groups (except before first group)
      if (result.length > 0) {
        result.push({ type: 'divider' });
      }

      // Add group items
      result.push(...groupItems);
    }
  }

  return result;
}

/**
 * Create Menu Item Component Hook
 *
 * Provides create functionality for menu items
 */
export function useCreateMenuItem(
  _nodeAdapter: NodeDataAdapter,
  unifiedOperations: any // TODO: Type this properly
) {
  return function createMenuItemWithHandler(
    parentNodeId: NodeId,
    nodeType: string
  ): CreateMenuItem {
    const plugin = getUIPluginRegistry().get(nodeType);

    if (!plugin) {
      throw new Error(`Unknown plugin type: ${nodeType}`);
    }

    return {
      nodeType,
      label: plugin.displayName,
      description: plugin.description,
      icon: plugin.components.icon as IconComponent | string | undefined,
      group: plugin.menu.group,
      order: plugin.menu.createOrder,
      onClick: () => unifiedOperations.createNode(parentNodeId, nodeType),
    };
  };
}
