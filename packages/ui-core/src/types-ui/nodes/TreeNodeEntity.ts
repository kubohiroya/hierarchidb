import type { TreeNodeId, TreeNodeType } from '@hierarchidb/core';

/**
 * Basic node name type
 */
export type NodeName = string;

/**
 * Core node interface that all nodes in the system must implement
 * This represents the base structure for hierarchical data
 */
export interface TreeNodeEntity {
  id: TreeNodeId;
  type: TreeNodeType;
  name: NodeName;
  parentId: TreeNodeId;
  description?: string;
  createdAt: number;
  updatedAt: number;
  removedAt?: number;
  originalName?: NodeName;
  originalParentId?: TreeNodeId;
  /**
   * Cached flag indicating whether this node has any children.
   * This is used to avoid expensive grandchildren queries during tree rendering.
   * Updated automatically when children are added or removed.
   */
  hasChildren?: boolean;

  isDraft: boolean;
  workingCopyOf?: TreeNodeId; // ID of the original entity if this is a working copy
  copiedAt?: number; // Timestamp when the working copy was created
}
