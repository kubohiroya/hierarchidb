/**
 * Build MenuItem arrays for TreeConsole SpeedDial/Menu based on plugin definitions.
 * Sources: ~/plugin-loaders (generated at stage time)
 */

import type { TreeId } from '@hierarchidb/core-types';
import { getShapePresetMenuEntries } from '../features/shape/shapeCreatePresets.ts';
import { getPresentation, prefetchAllIcons } from '../plugin-runtime/plugin-presentation.ts';
import { getInstalledPlugins, type InstalledPlugin } from '../plugin-runtime/plugin-registry.ts';
import { getMenuSpec, type MenuGroup } from './menu-spec.ts';

export type TreeContext = 'resources' | 'projects';

export interface PluginMenuItem {
  key: string;
  nodeType: string;
  createType?: string;
  label: string;
  labelKey?: string;
  icon?: {
    muiIconName?: string;
    emoji?: string;
    color?: string;
  };
  group?: MenuGroup | string;
  priority: number;
  description: string;
  descriptionKey?: string;
  backgroundColor: string;
  children?: PluginMenuItem[];
}

function createMenuItem(plugin: InstalledPlugin, group: string, priority: number): PluginMenuItem {
  const presentation = getPresentation(plugin.nodeType);
  const localizedDescription = presentation?.description?.trim();
  const item: PluginMenuItem = {
    key: plugin.nodeType,
    nodeType: plugin.nodeType,
    createType: plugin.nodeType,
    label: presentation?.label ?? plugin.label,
    icon: presentation?.icon ?? plugin.icon,
    group,
    priority,
    description:
      localizedDescription && localizedDescription.length > 0
        ? localizedDescription
        : plugin.description,
    backgroundColor: plugin.backgroundColor,
  };
  if (plugin.nodeType === 'shape') {
    const shapePresetChildren = getShapePresetMenuEntries().map((preset, index) => ({
      key: preset.key,
      nodeType: preset.nodeType,
      createType: preset.createType,
      label: preset.label,
      labelKey: preset.labelKey,
      description: preset.description,
      descriptionKey: preset.descriptionKey,
      icon: item.icon,
      group,
      priority: priority + index + 1,
      backgroundColor: plugin.backgroundColor,
    }));
    item.children = shapePresetChildren;
  }
  return item;
}

export function buildMenuItemsForContext(treeContext: TreeContext): PluginMenuItem[] {
  const spec = getMenuSpec(treeContext);
  if (!spec) {
    throw new Error(`Unknown treeId: ${treeContext}`);
  }

  const installed = getInstalledPlugins();
  const visiblePlugins = installed.filter((plugin) => !plugin.manifest?.visibility?.hidden);
  const byNodeType = new Map<string, InstalledPlugin>();
  for (const plugin of visiblePlugins) {
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
  const remaining = visiblePlugins.filter((plugin) => {
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
