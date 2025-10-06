import type { NodeId, Timestamp } from '@hierarchidb/common-type';

/**
 * Base information retained for any working copy.
 * Working copies keep a partial entity snapshot in `draft` while preserving tree metadata.
 */
export interface WorkingCopyBase<TEntity> {
  treeNodeId: NodeId;
  draft: Partial<TEntity>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  originalVersion?: number;
}

/**
 * Convenience type: working copy that also exposes draft fields at the top level for ease of access.
 */
export type WorkingCopyDraft<TEntity> = WorkingCopyBase<TEntity> & Partial<TEntity>;
