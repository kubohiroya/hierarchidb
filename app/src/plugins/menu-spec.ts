export type MenuGroup = 'core' | 'base' | 'geo' | 'tabular' | 'project';

export interface MenuSpec {
  groups: MenuGroup[];
  order: string[];
  groupOf: Record<string, MenuGroup>;
}

export const MENU_SPEC: Record<'resources' | 'projects', MenuSpec> = {
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
    order: ['folder', 'linker', 'timeline'],
    groupOf: {
      folder: 'core',
      linker: 'project',
      timeline: 'project',
    },
  },
};

export function getMenuSpec(context: 'resources' | 'projects'): MenuSpec {
  try {
    const overrides: Partial<Record<'resources' | 'projects', Partial<MenuSpec>>> =
      (globalThis as any).__HDB_MENU_SPEC__ || {};
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
