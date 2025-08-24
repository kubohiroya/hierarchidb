import type { NodeId, TreeId } from '../types/ids';
import { TREE_ROOT_NODE_TYPES } from '../constants/nodeTypes';

/**
 * Node ID generation utilities
 * Provides consistent ID generation for different node types
 * 
 * Note: Currently maintains backward compatibility with existing format (treeId + nodeType)
 * Future versions may migrate to delimiter-based format (treeId:nodeType)
 */
export const NodeIdGenerator = {
  /**
   * Generate ID for the main root node of a tree
   * @param treeId - The tree identifier
   * @returns NodeId in format: treeIdRoot (e.g., 'rRoot')
   */
  rootNode: (treeId: TreeId | string): NodeId => {
    return `${treeId}${TREE_ROOT_NODE_TYPES.ROOT}` as NodeId;
  },
  
  /**
   * Generate ID for the trash root node of a tree
   * @param treeId - The tree identifier
   * @returns NodeId in format: treeIdTrash (e.g., 'rTrash')
   */
  trashNode: (treeId: TreeId | string): NodeId => {
    return `${treeId}${TREE_ROOT_NODE_TYPES.TRASH}` as NodeId;
  },
  
  /**
   * Generate ID for the super root node of a tree
   * @param treeId - The tree identifier
   * @returns NodeId in format: treeIdSuperRoot (e.g., 'rSuperRoot')
   */
  superRootNode: (treeId: TreeId | string): NodeId => {
    return `${treeId}${TREE_ROOT_NODE_TYPES.SUPER_ROOT}` as NodeId;
  },
  
  /**
   * Generate a generic node ID
   * @param parts - Parts to combine into an ID
   * @returns NodeId
   */
  node: (...parts: string[]): NodeId => {
    return parts.join('') as NodeId;
  },
  
  /**
   * Generate a unique node ID using crypto.randomUUID
   * @returns NodeId
   */
  generateUniqueId: (): NodeId => {
    return crypto.randomUUID() as NodeId;
  }
} as const;

/**
 * Node ID validation and parsing utilities
 */
export const NodeIdValidator = {
  /**
   * Check if a node ID represents a root node
   * @param nodeId - The node ID to check
   * @returns true if it's a root node ID
   */
  isRootNode: (nodeId: NodeId | string): boolean => {
    return nodeId.endsWith(TREE_ROOT_NODE_TYPES.ROOT);
  },
  
  /**
   * Check if a node ID represents a trash node
   * @param nodeId - The node ID to check
   * @returns true if it's a trash node ID
   */
  isTrashNode: (nodeId: NodeId | string): boolean => {
    return nodeId.endsWith(TREE_ROOT_NODE_TYPES.TRASH);
  },
  
  /**
   * Check if a node ID represents a super root node
   * @param nodeId - The node ID to check
   * @returns true if it's a super root node ID
   */
  isSuperRootNode: (nodeId: NodeId | string): boolean => {
    return nodeId.endsWith(TREE_ROOT_NODE_TYPES.SUPER_ROOT);
  },
  
  /**
   * Check if a node ID is one of the special root nodes
   * @param nodeId - The node ID to check
   * @returns true if it's any type of root node
   */
  isSpecialRootNode: (nodeId: NodeId | string): boolean => {
    return NodeIdValidator.isRootNode(nodeId) || 
           NodeIdValidator.isTrashNode(nodeId) || 
           NodeIdValidator.isSuperRootNode(nodeId);
  },
  
  /**
   * Extract the tree ID from a root node ID
   * Note: This is a best-effort extraction based on current ID format
   * @param nodeId - The node ID to parse
   * @returns The tree ID if extractable, null otherwise
   */
  extractTreeId: (nodeId: NodeId | string): TreeId | null => {
    // Try to extract tree ID from known patterns
    for (const suffix of Object.values(TREE_ROOT_NODE_TYPES)) {
      if (nodeId.endsWith(suffix)) {
        const treeId = nodeId.slice(0, -suffix.length);
        if (treeId) {
          return treeId as TreeId;
        }
      }
    }
    return null;
  },
  
  /**
   * Validate that a string is a valid node ID format
   * @param value - The value to validate
   * @returns true if valid
   */
  isValidNodeId: (value: unknown): value is NodeId => {
    return typeof value === 'string' && value.length > 0;
  }
};