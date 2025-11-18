/**
 * Build MenuItem arrays for TreeConsole SpeedDial/Menu based on plugin definitions.
 * Sources: ~/plugin-registry (generated at build time)
 */

import type { TreeId } from '@hierarchidb/common-types';
import { getMenuSpec, type MenuGroup } from '../plugin-loader/menu-spec.ts';
import { getPresentation, prefetchAllIcons } from '../services/plugin-presentation.ts';
import { getInstalledPlugins, type InstalledPlugin } from '../services/plugin-registry.ts';

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
  group?: MenuGroup | string;
  priority: number;
  description: string;
  backgroundColor: string;
}

function createMenuItem(plugin: InstalledPlugin, group: string, priority: number): PluginMenuItem {
  const presentation = getPresentation(plugin.nodeType);
  const localizedDescription = presentation?.description?.trim();
  return {
    key: plugin.nodeType,
    nodeType: plugin.nodeType,
    label: presentation?.label ?? plugin.label,
    icon: presentation?.icon ?? plugin.icon,
    group,
    priority,
    description: localizedDescription && localizedDescription.length > 0 ? localizedDescription : plugin.description,
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
  const allowedGroups = new Set(spec.groups);
  const remaining = installed.filter((plugin) => {
    if (used.has(plugin.nodeType)) return false;
    const group = (spec.groupOf[plugin.nodeType] ?? plugin.menuGroup) as MenuGroup | undefined;
    return group ? allowedGroups.has(group) : false;
  });
  remaining.sort((a, b) => {
    if (a.createOrder !== b.createOrder) {
      return a.createOrder - b.createOrder;
    }
    return a.label.localeCompare(b.label);
  });

  const baseOffset = spec.order.length;
  remaining.forEach((plugin, idx) => {
    const fallbackGroup = spec.groups.length > 0 ? spec.groups[spec.groups.length - 1] : 'core';
    const group = (spec.groupOf[plugin.nodeType] ?? plugin.menuGroup ?? fallbackGroup) as string;
    const groupIndex = Math.max(spec.groups.indexOf(group as (typeof spec.groups)[number]), 0);
    const priority = groupIndex * 100 + baseOffset + idx;
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
