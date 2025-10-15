/**
 * Build MenuItem arrays for TreeConsole SpeedDial/Menu based on plugin definitions.
 * Sources: virtual:plugin-node-types/meta (generated at build time)
 */

import type { TreeId } from '@hierarchidb/common-types';
import { getPresentation, prefetchAllIcons } from '~/services/plugin-presentation.js';
import { getMenuSpec } from '~/plugin-loader/menu-spec.js';
import { getInstalledPlugins, type InstalledPlugin } from '~/services/plugin-registry.js';

export type TreeContext = 'resources' | 'projects';

export interface PluginMenuItem {
  key: string;
  nodeType: string;
  label: string;
  icon?: {
    muiIconName?: string;
    emoji?: string;
    color?: string;
  };
  group?: 'core' | 'base' | 'geo' | 'tabular-source' | 'project' | string;
  priority: number;
  description: string;
  backgroundColor: string;
}

function createMenuItem(
  plugin: InstalledPlugin,
  group: string,
  priority: number,
): PluginMenuItem {
  const presentation = getPresentation(plugin.nodeType);
  return {
    key: plugin.nodeType,
    nodeType: plugin.nodeType,
    label: presentation?.label ?? plugin.label,
    icon: presentation?.icon ?? plugin.icon,
    group,
    priority,
    description: plugin.description,
    backgroundColor: plugin.backgroundColor,
  };
}

export function buildMenuItemsForContext(treeContext: TreeContext): PluginMenuItem[] {
  const spec = getMenuSpec(treeContext);
  if (!spec) {
    throw new Error(`Unknown treeId: ${treeContext}`);
  }

  const installed = getInstalledPlugins();
  const byNodeType = new Map<string, InstalledPlugin>();
  for (const plugin of installed) {
    byNodeType.set(plugin.nodeType, plugin);
  }

  const used = new Set<string>();
  const items: PluginMenuItem[] = [];

  // First, add items in the explicit order defined by the spec
  spec.order.forEach((nodeType, index) => {
    const plugin = byNodeType.get(nodeType);
    if (!plugin) return;
    const group = spec.groupOf[nodeType] || 'core';
    const priority = spec.groups.indexOf(group) * 100 + index;
    items.push(createMenuItem(plugin, group, priority));
    used.add(nodeType);
  });

  // Append remaining plugins, sorted by createOrder then label
  const remaining = installed.filter((plugin) => !used.has(plugin.nodeType));
  remaining.sort((a, b) => {
    if (a.createOrder !== b.createOrder) {
      return a.createOrder - b.createOrder;
    }
    return a.label.localeCompare(b.label);
  });

  const baseOffset = spec.order.length;
  remaining.forEach((plugin, idx) => {
    const fallbackGroup = spec.groups.length > 0 ? spec.groups[spec.groups.length - 1] : 'core';
    const group = spec.groupOf[plugin.nodeType] || plugin.menuGroup || fallbackGroup;
    const priority = spec.groups.indexOf(group) * 100 + baseOffset + idx;
    items.push(createMenuItem(plugin, group, priority));
  });

  return items;
}

export function buildMenuItemsForTreeId(treeId?: TreeId | null): PluginMenuItem[] {
  const t = (treeId || '').toLowerCase();
  const ctx: TreeContext = t === 'r' ? 'resources' : 'projects';
  return buildMenuItemsForContext(ctx);
}

export async function prefetchIconsForAllContexts() {
  try {
    await prefetchAllIcons();
  } catch {
    // ignore
  }
}
