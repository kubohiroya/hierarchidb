import type { TreeNodeId } from '@hierarchidb/core';

/**
 * Base interface for secondary entities (bulk data)
 * Secondary entities store the actual data associated with a resource
 */
export interface SecondaryResourceEntity {
  /**
   * Unique identifier for this secondary entity
   */
  id?: number;
  /**
   * The ID of the TreeNode this entity belongs to
   */
  nodeId: TreeNodeId;
}
