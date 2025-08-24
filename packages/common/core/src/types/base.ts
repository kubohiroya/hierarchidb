export type Timestamp = number;

/**
 * Type identifier for tree nodes (e.g., 'folder', 'document', 'stylemap', etc.)
 */
export type NodeType = string;

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
