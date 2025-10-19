import type { NodeId, Timestamp } from '@hierarchidb/common-types';
import type { WorkingCopyBase, WorkingCopyDraft } from '@hierarchidb/plugin-api';

export interface CreateDraftWorkingCopyParams<TEntity> {
  draft: Partial<TEntity>;
  meta: {
    treeNodeId: NodeId;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    originalVersion?: number;
  };
}

export function createDraftWorkingCopyBase<TEntity>(
  params: CreateDraftWorkingCopyParams<TEntity>,
): WorkingCopyBase<TEntity> {
  const now = Date.now() as Timestamp;
  return {
    treeNodeId: params.meta.treeNodeId,
    draft: params.draft,
    createdAt: params.meta.createdAt ?? now,
    updatedAt: params.meta.updatedAt ?? now,
    originalVersion: params.meta.originalVersion,
  };
}

export function markWorkingCopyUpdated<TEntity>(
  workingCopy: WorkingCopyDraft<TEntity>,
  updates: Partial<TEntity>,
  timestamp: Timestamp = Date.now() as Timestamp,
): WorkingCopyDraft<TEntity> {
  const draft = {
    ...workingCopy.draft,
    ...updates,
  };

  return {
    treeNodeId: workingCopy.treeNodeId,
    draft,
    createdAt: workingCopy.createdAt,
    updatedAt: timestamp,
    originalVersion: workingCopy.originalVersion,
  } satisfies WorkingCopyDraft<TEntity>;
}
