/**
 * @file ResourceEntity.ts
 * @description Base interfaces for resource entities
 */

import type { TreeNodeId } from '@hierarchidb/core';
import type { Timestamped } from './Timestamped';
import type { WorkingCopyProperties } from './TreeEntity';

/**
 * Base interface for all resources that have a 1:1 relationship with TreeNode
 */
export interface ResourceEntity extends Timestamped, WorkingCopyProperties {
  /**
   * Unique identifier for this secondary entity
   */
  id?: string;
  nodeId: TreeNodeId; // Unique identifier for the entity within the tree
  // Resources are bound to tree nodes and support working copies
}
