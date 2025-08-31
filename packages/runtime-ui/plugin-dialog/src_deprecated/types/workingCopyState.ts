import type { NodeId } from '@hierarchidb/common-type';

/**
 * Working copy state
 */
export interface WorkingCopyState<T = any> {
  /**
   * Working copy ID
   */
  id: string;

  /**
   * Original node ID (for edit mode)
   */
  originalNodeId?: NodeId;

  /**
   * Working copy data
   */
  data: T;

  /**
   * Whether the working copy has unsaved changes
   */
  isDirty: boolean;

  /**
   * Whether this is a draft
   */
  isDraft?: boolean;

  /**
   * Version number for optimistic locking
   */
  version: number;

  /**
   * Creation timestamp
   */
  createdAt: number;

  /**
   * Last update timestamp
   */
  updatedAt: number;
}
