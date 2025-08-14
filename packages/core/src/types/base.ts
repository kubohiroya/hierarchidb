export type UUID = string;
export type TreeId = string;
export type Timestamp = number;

export const TreeRootNodeTypes = {
  SuperRoot: 'SuperRoot',
  Root: 'Root' ,
  Trash: 'Trash',
} as const;
export type TreeRootNodeType = keyof typeof TreeRootNodeTypes;

export const TreeNodeTypes = {
  ...TreeRootNodeTypes,
  folder: 'folder',
}
export type TreeNodeType = keyof typeof TreeNodeTypes;

export type TreeRootNodeId = UUID;
export type TreeNodeId = TreeRootNodeId | UUID;
