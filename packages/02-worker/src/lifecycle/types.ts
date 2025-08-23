import type { TreeNode, NodeId, TreeNodeType } from '@hierarchidb/00-core';

/**
 * Lifecycle hooks for node operations
 */
export interface NodeLifecycleHooks {
  // Creation hooks
  beforeCreate?: (parentId: NodeId, nodeData: Partial<TreeNode>) => Promise<void> | void;
  afterCreate?: (nodeId: NodeId) => Promise<void> | void;

  // Update hooks
  beforeUpdate?: (nodeId: NodeId, updates: Partial<TreeNode>) => Promise<void> | void;
  afterUpdate?: (nodeId: NodeId, updates: Partial<TreeNode>) => Promise<void> | void;

  // Deletion hooks
  beforeDelete?: (nodeId: NodeId) => Promise<void> | void;
  afterDelete?: (nodeId: NodeId) => Promise<void> | void;

  // Move hooks
  beforeMove?: (
    nodeId: NodeId,
    oldParentId: NodeId,
    newParentId: NodeId
  ) => Promise<void> | void;
  afterMove?: (
    nodeId: NodeId,
    oldParentId: NodeId,
    newParentId: NodeId
  ) => Promise<void> | void;

  // Load/Unload hooks
  onLoad?: (nodeId: NodeId) => Promise<void> | void;
  onUnload?: (nodeId: NodeId) => Promise<void> | void;

  // Error handling configuration
  stopOnError?: boolean;
}

/**
 * Node type definition with lifecycle hooks
 */
export interface NodeTypeDefinition {
  nodeType: TreeNodeType;
  displayName?: string;
  icon?: string;
  color?: string;
  lifecycle?: NodeLifecycleHooks;
  validation?: {
    namePattern?: RegExp;
    allowedChildTypes?: TreeNodeType[];
    maxChildren?: number;
    customValidators?: Array<{
      validate: (node: TreeNode) => Promise<{ valid: boolean; message?: string }>;
    }>;
  };
}

/**
 * Context provided to lifecycle hooks
 */
export interface LifecycleContext {
  nodeType: TreeNodeType;
  userId?: string;
  timestamp: number;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Lifecycle event for tracking
 */
export interface LifecycleEvent {
  type: keyof NodeLifecycleHooks;
  nodeType: TreeNodeType;
  nodeId?: NodeId;
  timestamp: number;
  duration: number;
  success: boolean;
  error?: string;
}
