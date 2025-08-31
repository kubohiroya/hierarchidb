import type { TreeNode, NodeId, NodeType } from '@hierarchidb/common-type';

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
  beforeMove?: (nodeId: NodeId, oldParentId: NodeId, newParentId: NodeId) => Promise<void> | void;
  afterMove?: (nodeId: NodeId, oldParentId: NodeId, newParentId: NodeId) => Promise<void> | void;

  // Load/Unload hooks
  onLoad?: (nodeId: NodeId) => Promise<void> | void;
  onUnload?: (nodeId: NodeId) => Promise<void> | void;

  // Error handling configuration
  stopOnError?: boolean;
}

/**
 * Context provided to lifecycle hooks
 */
export interface LifecycleContext {
  nodeType: NodeType;
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
  nodeType: NodeType;
  nodeId?: NodeId;
  timestamp: number;
  duration: number;
  success: boolean;
  error?: string;
}
