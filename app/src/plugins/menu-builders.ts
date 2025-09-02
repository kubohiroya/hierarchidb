/**
 * Build MenuItem arrays for TreeConsole SpeedDial/Menu based on plugin definitions.
 * Sources: virtual:plugin-definitions (generated at build time)
 */

// Vite virtual module (types are declared in src/types/shims.d.ts)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import pluginDefinitions from 'virtual:plugin-definitions';

export type TreeContext = 'resources' | 'projects';

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
  const defs = toArray().filter((d) => isForContext(d, context));

  const items: PluginMenuItem[] = defs.map((d) => ({
    key: d.nodeType,
    nodeType: d.nodeType,
    label: getLabel(d),
    icon: getIcon(d),
    group: getGroup(d),
    priority: getPriority(d),
  }));

  // Sort by priority asc, then label
  items.sort((a, b) => (a.priority - b.priority) || a.label.localeCompare(b.label));
  return items;
}

export function buildResourcesMenuItems(): PluginMenuItem[] {
  return buildMenuItemsForContext('resources');
}

export function buildProjectsMenuItems(): PluginMenuItem[] {
  return buildMenuItemsForContext('projects');
}

