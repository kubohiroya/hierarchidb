/**
 * Tree root node type constants
 * These define the special node types that exist in every tree
 */
export const TREE_ROOT_NODE_TYPES = {
  SUPER_ROOT: 'SuperRoot',
  ROOT: 'Root',
  TRASH: 'Trash'
} as const;

/**
 * Type representing valid tree root node types
 */
export type TreeRootNodeType = typeof TREE_ROOT_NODE_TYPES[keyof typeof TREE_ROOT_NODE_TYPES];

/**
 * Regular node type constants for common node types
 */
export const NODE_TYPES = {
  FOLDER: 'folder',
  FILE: 'file',
  // Plugin-specific types will be added dynamically
} as const;

/**
 * Type guard to check if a node type is a tree root type
 */
export function isTreeRootNodeType(nodeType: string): nodeType is TreeRootNodeType {
  return Object.values(TREE_ROOT_NODE_TYPES).includes(nodeType as TreeRootNodeType);
}

/**
 * Type guard to check if a node type is the main root
 */
export function isRootNodeType(nodeType: string): boolean {
  return nodeType === TREE_ROOT_NODE_TYPES.ROOT;
}

/**
 * Type guard to check if a node type is trash
 */
export function isTrashNodeType(nodeType: string): boolean {
  return nodeType === TREE_ROOT_NODE_TYPES.TRASH;
}

/**
 * Type guard to check if a node type is super root
 */
export function isSuperRootNodeType(nodeType: string): boolean {
  return nodeType === TREE_ROOT_NODE_TYPES.SUPER_ROOT;
}