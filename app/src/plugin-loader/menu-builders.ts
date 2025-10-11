/**
 * Build MenuItem arrays for TreeConsole SpeedDial/Menu based on plugin definitions.
 * Sources: virtual:plugin-definitions (generated at build time)
 */

// Vite virtual module (types are declared in src/types/shims.d.ts)
import type { TreeId } from '@hierarchidb/common-types';
import pluginDefinitions from 'virtual:plugin-definitions';
import { getPresentation, prefetchAllIcons } from '~/services/plugin-presentation.js';
import { getMenuSpec } from '~/plugin-loader/menu-spec.js';

export type TreeContext = 'resources' | 'projects';

/**
 * Map app-level TreeId to logical menu context.
 * - 'r' => resources
 * - 't' or 'p' => projects (accept both to be tolerant of typos)
 */
// TreeId → context mapping is now localized at call-sites as needed

export interface PluginMenuItem {
  key: string; // unique key (nodeType)
  nodeType: string;
  label: string;
  icon?: {
    muiIconName?: string;
    emoji?: string;
    color?: string;
  };
  group?: 'core' | 'base' | 'geo' | 'tabular-source' | 'project' | string;
  priority: number; // lower first
}

type VMDef = {
  name: string;
  version: string;
  packageName: string;
  nodeType: string;
  priority: number;
  config?: any;
};

function toArray(): VMDef[] {
  return (pluginDefinitions as VMDef[]) || [];
}

/*
// Category string to default context mapping (fallback when treeId is not provided)
const CATEGORY_TO_CONTEXT: Record<string, TreeContext | '*'> = {
  core: '*',
  geographic: 'resources',
  data: 'resources',
  project: 'projects',
};

// Derive menuGroup from category if missing
const CATEGORY_TO_GROUP: Record<string, PluginMenuItem['group']> = {
  core: 'basic',
  geographic: 'advanced',
  data: 'document',
  project: 'container',
};

function isForContext(def: VMDef, context: TreeContext): boolean {
  const cfg = def.config || {};
  const category = cfg.category;

  // Explicit object form: { treeId, menuGroup, createOrder }
  if (category && typeof category === 'object') {
    const treeId = category.treeId as TreeContext | '*';
    if (!treeId || treeId === '*') return true;
    return treeId === context;
  }

  // String category (e.g., 'core', 'geographic', 'data', 'project')
  if (typeof category === 'string') {
    const mapped = CATEGORY_TO_CONTEXT[category];
    if (!mapped || mapped === '*') return true; // default to both
    return mapped === context;
  }

  // No category => default available in both contexts
  return true;
}

function getPriority(def: VMDef): number {
  const cfg = def.config || {};
  const category = cfg.category;
  const createOrder = typeof category === 'object' ? category.createOrder : undefined;
  const p = createOrder ?? cfg.priority ?? def.priority ?? 1000;
  // Ensure folder is always first unless overridden
  return def.nodeType === 'folder' ? Math.min(1, p) : p;
}

function getGroup(def: VMDef): PluginMenuItem['group'] {
  const cfg = def.config || {};
  const category = cfg.category;
  if (typeof category === 'object') return category.menuGroup || 'basic';
  if (typeof category === 'string') return CATEGORY_TO_GROUP[category] || 'basic';
  return 'basic';
}

// Presentation (label/icon) is sourced from the generic service by nodeType

type MenuSpec = {
  groups: Array<NonNullable<PluginMenuItem['group']>>;
  order: string[]; // list of nodeType in display order
  groupOf: Record<string, NonNullable<PluginMenuItem['group']>>; // nodeType -> group
};
 */

export function buildMenuItemsForContext(treeContext: TreeContext): PluginMenuItem[] {
  const spec = getMenuSpec(treeContext);
  if(!spec){
    throw new Error(`Unknown treeId: ${treeContext}`);
  }
  const defs = toArray();
  const defByType = Object.fromEntries(defs.map((d) => [d.nodeType, d] as const));

  const items: PluginMenuItem[] = [];
  for (const nodeType of spec.order) {
    const d = defByType[nodeType];
    const group = spec.groupOf[nodeType] || 'core';
    if (d) {
      const pres = getPresentation(d.nodeType);
      items.push({
        key: d.nodeType,
        nodeType: d.nodeType,
        label: pres?.label || d.nodeType,
        icon: pres?.icon,
        group,
        // Encode group and index into priority for stable sort
        priority: spec.groups.indexOf(group) * 100 + spec.order.indexOf(nodeType),
      });
    } else {
      // Fallback stub when plugin definition is absent
      const iconName = nodeType === 'folder'
        ? 'Folder'
        : nodeType === 'timeline'
          ? 'AccessTime'
          : nodeType === 'linker'
            ? 'AccountTree'
            : 'Extension';
      items.push({
        key: nodeType,
        nodeType,
        label: nodeType,
        icon: { muiIconName: iconName },
        group,
        priority: spec.groups.indexOf(group) * 100 + spec.order.indexOf(nodeType),
      });
    }
  }

  return items;
}

/**
 * Convenience: build using TreeId directly (e.g., 'r' or 't')
 */
export function buildMenuItemsForTreeId(treeId?: TreeId | null): PluginMenuItem[] {
  const t = (treeId || '').toLowerCase();
  const ctx: TreeContext = t === 'r' ? 'resources' : 'projects';
  return buildMenuItemsForContext(ctx);
}

/**
 * Utility to precompute icons for both contexts (used by root.tsx preload)
 */
export async function prefetchIconsForAllContexts() {
  try {
    // Reuse generic service that already aggregates all plugin icons
    await prefetchAllIcons();
  } catch {
    // ignore
  }
}
