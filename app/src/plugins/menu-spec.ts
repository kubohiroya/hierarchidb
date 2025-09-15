export type MenuGroup = 'core' | 'base' | 'geo' | 'tabular' | 'project';

export interface MenuSpec {
  groups: MenuGroup[];
  order: string[]; // nodeType order
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
    // Temporarily remove 'linker' until it is re-implemented
    order: ['folder', 'timeline'],
    groupOf: {
      folder: 'core',
      timeline: 'project',
    },
  },
};

// Optional runtime override via global variable for project-level customization
// window.__HDB_MENU_SPEC__ = { resources?: Partial<MenuSpec>, projects?: Partial<MenuSpec> }
export function getMenuSpec(context: 'resources' | 'projects'): MenuSpec {
  try {
    const g: any = (globalThis as any).__HDB_MENU_SPEC__;
    const base = MENU_SPEC[context];
    const override = g?.[context] || {};
    return {
      groups: override.groups || base.groups,
      order: override.order || base.order,
      groupOf: { ...base.groupOf, ...(override.groupOf || {}) },
    };
  } catch {
    return MENU_SPEC[context];
  }
}
