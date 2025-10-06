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

export type WorkingCopyDraft<TEntity> = WorkingCopyBase<TEntity>;
