import type { NodeType } from '@hierarchidb/common-core';

/**
 * Configuration for a node type
 */
export type NodeTypeConfig = {
  icon?: string;
  color?: string;
  displayName?: string;
  allowedChildren?: NodeType[];
  maxChildren?: number;
  canBeRoot?: boolean;
  canBeDeleted?: boolean;
  canBeRenamed?: boolean;
  canBeMoved?: boolean;
  sortOrder?: number;
  metadata?: Record<string, unknown>;
};

/**
 * Registry for managing node type configurations
 */
export type INodeTypeRegistry = {
  registerNodeType(nodeType: NodeType, config: NodeTypeConfig): void;
  unregisterNodeType(nodeType: NodeType): void;
  isRegistered(nodeType: NodeType): boolean;
  getNodeTypeConfig(nodeType: NodeType): NodeTypeConfig | undefined;
  getAllNodeTypes(): NodeType[];
  canAddChild(parentType: NodeType, childType: NodeType): boolean;
  getDefaultIcon(nodeType: NodeType): string;
};
