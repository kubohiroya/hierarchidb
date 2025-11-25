export type MenuGroup = 'core' | 'base' | 'geo' | 'tabular' | 'project';

export interface MenuSpec {
  groups: MenuGroup[];
  order: string[];
  groupOf: Record<string, MenuGroup>;
}

import { getInstalledPlugins } from '../plugin-host/plugin-registry.ts';

const RESOURCES_GROUPS: MenuGroup[] = ['core', 'base', 'geo', 'tabular'];
const PROJECTS_GROUPS: MenuGroup[] = ['core', 'project'];

function buildMenuSpec(groups: MenuGroup[]): MenuSpec {
  const allowed = new Set(groups);
  const groupRank = new Map<MenuGroup, number>();
  groups.forEach((group, index) => {
    groupRank.set(group, index);
  });

  const installed = getInstalledPlugins().filter((plugin) =>
    allowed.has(plugin.menuGroup as MenuGroup)
  );
  installed.sort((a, b) => {
    const groupA = (a.menuGroup ?? groups[0]) as MenuGroup;
    const groupB = (b.menuGroup ?? groups[0]) as MenuGroup;
    const rankA = groupRank.get(groupA) ?? groups.length;
    const rankB = groupRank.get(groupB) ?? groups.length;
    if (rankA !== rankB) {
      return rankA - rankB;
    }

    const orderA = Number.isFinite(a.createOrder)
      ? a.createOrder
      : Number.isFinite(a.manifest?.priority)
        ? Number(a.manifest?.priority)
        : Number.POSITIVE_INFINITY;
    const orderB = Number.isFinite(b.createOrder)
      ? b.createOrder
      : Number.isFinite(b.manifest?.priority)
        ? Number(b.manifest?.priority)
        : Number.POSITIVE_INFINITY;
    if (orderA !== orderB) {
      return orderA - orderB;
    }

    return a.label.localeCompare(b.label);
  });

  const order: string[] = [];
  const groupOf: Record<string, MenuGroup> = {};
  for (const plugin of installed) {
    const group = (plugin.menuGroup ?? groups[0]) as MenuGroup;
    if (!allowed.has(group)) continue;
    order.push(plugin.nodeType);
    groupOf[plugin.nodeType] = group;
  }

  return {
    groups,
    order,
    groupOf,
  };
}

export const MENU_SPEC: Record<'resources' | 'projects', MenuSpec> = {
  resources: buildMenuSpec(RESOURCES_GROUPS),
  projects: buildMenuSpec(PROJECTS_GROUPS),
};

type MenuSpecOverrides = Partial<Record<'resources' | 'projects', Partial<MenuSpec>>>;
type MenuSpecGlobal = typeof globalThis & {
  __HDB_MENU_SPEC__?: MenuSpecOverrides;
};

export function getMenuSpec(context: 'resources' | 'projects'): MenuSpec {
  try {
    const overrides = (globalThis as MenuSpecGlobal).__HDB_MENU_SPEC__ ?? {};
    const base = MENU_SPEC[context];
    const override = overrides[context] || {};
    return {
      groups: override.groups || base.groups,
      order: override.order || base.order,
      groupOf: { ...base.groupOf, ...(override.groupOf || {}) },
    };
  } catch {
    return MENU_SPEC[context];
  }
}
