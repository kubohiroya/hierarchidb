import { TreeRootNodeType, TREE_ROOT_NODE_TYPES } from '@hierarchidb/common-type';

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
