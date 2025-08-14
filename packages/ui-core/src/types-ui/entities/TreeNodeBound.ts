/**
 * @file TreeNodeBound.ts
 * @description Interface for entities that are bound to a TreeNode
 */

import type { TreeNodeId } from '../nodes/TreeNodeId';

/**
 * Interface for entities that belong to a specific TreeNode
 */
export interface TreeNodeBound {
  /**
   * The ID of the TreeNode this entity belongs to
   */
  belongsToNode: TreeNodeId;
}
