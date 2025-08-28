/**
 * TreeTypes root node type constants
 * These define the special node types that exist in every tree
 */
export const TREE_ROOT_NODE_TYPES = {
  SUPER_ROOT: 'SuperRoot',
  ROOT: 'Root',
  TRASH: 'Trash',
} as const;

/**
 * Type representing valid tree root node types
 */
export type TreeRootNodeType = (typeof TREE_ROOT_NODE_TYPES)[keyof typeof TREE_ROOT_NODE_TYPES];
