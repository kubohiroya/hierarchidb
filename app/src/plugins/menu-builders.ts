/**
 * Build MenuItem arrays for TreeConsole SpeedDial/Menu based on plugin definitions.
 * Sources: virtual:plugin-definitions (generated at build time)
 */

// Vite virtual module (types are declared in src/types/shims.d.ts)
// @ts-ignore
import pluginDefinitions from 'virtual:plugin-definitions';

export type TreeContext = 'resources' | 'projects';

/**
 * Map app-level TreeId to logical menu context.
 * - 'r' => resources
 * - 't' or 'p' => projects (accept both to be tolerant of typos)
 */
export function normalizeContextFromTreeId(treeId?: string | null): TreeContext {
  const t = (treeId || '').toLowerCase();
  if (t === 'r') return 'resources';
  if (t === 't' || t === 'p') return 'projects';
  // default to resources to keep menus usable in unknown contexts
  return 'resources';
}

export interface PluginMenuItem {
  key: string; // unique key (nodeType)
  nodeType: string;
  label: string;
  icon?: {
    muiIconName?: string;
    emoji?: string;
    color?: string;
  };
  group?: 'basic' | 'container' | 'document' | 'advanced' | string;
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

function toArray(): VMDef[] {
  return (pluginDefinitions as VMDef[]) || [];
}

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

function getIcon(def: VMDef): PluginMenuItem['icon'] {
  const icon = def.config?.icon || {};
  return {
    muiIconName: icon.mui || icon.muiIconName || 'Extension',
    emoji: icon.emoji,
    color: icon.color,
  };
}

function getLabel(def: VMDef): string {
  return def.config?.displayName || def.config?.name || def.nodeType;
}

export function buildMenuItemsForContext(context: TreeContext): PluginMenuItem[] {
  // Explicit menu spec from product owner
  // resources (r): groups and order
  const SPEC: Record<TreeContext, { groups: string[]; order: string[]; groupOf: Record<string, string> }> = {
    resources: {
      groups: ['core', 'base', 'geo', 'tabular'],
      order: ['folder', 'basemap', 'shape', 'location', 'route', 'spreadsheet', 'styler', 'resolver'],
      groupOf: {
        folder: 'core',
        basemap: 'base',
        shape: 'geo',
        location: 'geo',
        route: 'geo',
        spreadsheet: 'tabular',
        styler: 'tabular',
        resolver: 'tabular',
      },
    },
    projects: {
      groups: ['core', 'project'],
      order: ['folder', 'project'],
      groupOf: {
        folder: 'core',
        project: 'project',
      },
    },
  } as const;

  const spec = SPEC[context];
  const defs = toArray();
  const defByType = Object.fromEntries(defs.map((d) => [d.nodeType, d] as const));

  const items: PluginMenuItem[] = [];
  for (const nodeType of spec.order) {
    const d = defByType[nodeType];
    const group = spec.groupOf[nodeType] || 'core';
    if (d) {
      items.push({
        key: d.nodeType,
        nodeType: d.nodeType,
        label: getLabel(d),
        icon: getIcon(d),
        group,
        // Encode group and index into priority for stable sort
        priority: spec.groups.indexOf(group) * 100 + spec.order.indexOf(nodeType),
      });
    } else {
      // Fallback stub when plugin definition is absent (e.g., spreadsheet/resolver)
      items.push({
        key: nodeType,
        nodeType,
        label: nodeType,
        icon: { muiIconName: nodeType === 'folder' ? 'Folder' : 'Extension' },
        group,
        priority: spec.groups.indexOf(group) * 100 + spec.order.indexOf(nodeType),
      });
    }
  }

  return items;
}

export function buildResourcesMenuItems(): PluginMenuItem[] {
  return buildMenuItemsForContext('resources');
}

export function buildProjectsMenuItems(): PluginMenuItem[] {
  return buildMenuItemsForContext('projects');
}

/**
 * Convenience: build using TreeId directly (e.g., 'r' or 't')
 */
export function buildMenuItemsForTreeId(treeId?: string | null): PluginMenuItem[] {
  return buildMenuItemsForContext(normalizeContextFromTreeId(treeId));
}

/**
 * Utility to precompute icons for both contexts (used by root.tsx preload)
 */
export async function prefetchIconsForAllContexts() {
  try {
    const { prefetchMuiIcons } = await import('@hierarchidb/ui-icon');
    const r = buildMenuItemsForContext('resources');
    const p = buildMenuItemsForContext('projects');
    const names = [...r, ...p].map((i) => i.icon?.muiIconName);
    await prefetchMuiIcons(names);
  } catch {
    // ignore
  }
}
