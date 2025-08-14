import type { TreeNodeType } from '@hierarchidb/core';

/**
 * Configuration for a node type
 */
export interface NodeTypeConfig {
  icon?: string;
  color?: string;
  displayName?: string;
  allowedChildren?: TreeNodeType[];
  maxChildren?: number;
  canBeRoot?: boolean;
  canBeDeleted?: boolean;
  canBeRenamed?: boolean;
  canBeMoved?: boolean;
  sortOrder?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Registry for managing node type configurations
 */
export interface INodeTypeRegistry {
  registerNodeType(nodeType: TreeNodeType, config: NodeTypeConfig): void;
  unregisterNodeType(nodeType: TreeNodeType): void;
  isRegistered(nodeType: TreeNodeType): boolean;
  getNodeTypeConfig(nodeType: TreeNodeType): NodeTypeConfig | undefined;
  getAllNodeTypes(): TreeNodeType[];
  canAddChild(parentType: TreeNodeType, childType: TreeNodeType): boolean;
  getDefaultIcon(nodeType: TreeNodeType): string;
}
