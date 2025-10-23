/**
 * Menu-related type definitions for HierarchiDB
 */

/**
 * React component type without importing React (compatible with React.ComponentType)
 */
export type IconComponent = (props: { [key: string]: unknown }) => unknown;

/**
 * Menu item for creating new nodes
 */
export interface CreateMenuItem {
  nodeType: string;
  label: string;
  description?: string;
  icon?: IconComponent | string; // React component or icon name
  group?: string;
  order?: number;
  onClick: () => void | Promise<void>;
}

/**
 * Menu divider item
 */
export interface MenuDividerItem {
  type: 'divider';
}

/**
 * Combined menu item type for create menus
 */
export type CreateMenuItemOrDivider = CreateMenuItem | MenuDividerItem;

/**
 * Icon spec used by dynamic menu builders in UI (MUI icon name / emoji / color)
 */
export interface PluginMenuIconSpec {
  muiIconName?: string;
  emoji?: string;
  color?: string;
}

/**
 * Minimal create menu entry used by UI's global builders
 */
export interface CreateMenuEntry {
  key: string;
  nodeType: string;
  label: string;
  description?: string;
  icon?: PluginMenuIconSpec;
}

/**
 * Builder signature for global create menu providers
 */
export type CreateMenuBuilder = (treeId?: string) => CreateMenuEntry[];

/**
 * Global builders container placed on globalThis by host application
 */
export interface GlobalMenuBuilders {
  buildMenuItemsForTreeId?: CreateMenuBuilder;
  buildMenuItemsForContext?: CreateMenuBuilder;
}
