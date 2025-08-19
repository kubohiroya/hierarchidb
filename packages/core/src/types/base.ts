export type UUID = string;
export type TreeId = string;
export type Timestamp = number;

export const TreeRootNodeTypes = {
  SuperRoot: 'SuperRoot',
  Root: 'Root',
  Trash: 'Trash',
} as const;
export type TreeRootNodeType = keyof typeof TreeRootNodeTypes;

export const TreeNodeTypes = {
  ...TreeRootNodeTypes,
  folder: 'folder',
  file: 'file',
  customType: 'customType',
  persistentType: 'persistentType',
};
export type TreeNodeType = keyof typeof TreeNodeTypes;

export type TreeRootNodeId = UUID;
export type TreeNodeId = TreeRootNodeId | UUID;

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
