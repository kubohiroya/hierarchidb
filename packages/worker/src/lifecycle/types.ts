import type { TreeNodeId, TreeNode, TreeNodeType } from '@hierarchidb/core';

/**
 * Lifecycle hooks for node operations
 */
export interface NodeLifecycleHooks {
  // Creation hooks
  beforeCreate?: (parentId: TreeNodeId, nodeData: Partial<TreeNode>) => Promise<void> | void;
  afterCreate?: (nodeId: TreeNodeId) => Promise<void> | void;

  // Update hooks
  beforeUpdate?: (nodeId: TreeNodeId, updates: Partial<TreeNode>) => Promise<void> | void;
  afterUpdate?: (nodeId: TreeNodeId, updates: Partial<TreeNode>) => Promise<void> | void;

  // Deletion hooks
  beforeDelete?: (nodeId: TreeNodeId) => Promise<void> | void;
  afterDelete?: (nodeId: TreeNodeId) => Promise<void> | void;

  // Move hooks
  beforeMove?: (
    nodeId: TreeNodeId,
    oldParentId: TreeNodeId,
    newParentId: TreeNodeId
  ) => Promise<void> | void;
  afterMove?: (
    nodeId: TreeNodeId,
    oldParentId: TreeNodeId,
    newParentId: TreeNodeId
  ) => Promise<void> | void;

  // Load/Unload hooks
  onLoad?: (nodeId: TreeNodeId) => Promise<void> | void;
  onUnload?: (nodeId: TreeNodeId) => Promise<void> | void;

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
  nodeId?: TreeNodeId;
  timestamp: number;
  duration: number;
  success: boolean;
  error?: string;
}
