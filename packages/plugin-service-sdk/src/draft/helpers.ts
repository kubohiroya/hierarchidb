import type { NodeId, Timestamp } from '@hierarchidb/common-types';
import type { DraftBase } from '@hierarchidb/plugin-service-api';

export interface CreateDraftBaseParams<TEntity> {
  draft: Partial<TEntity>;
  meta: {
    treeNodeId: NodeId;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    originalVersion?: number;
  };
}

/**
 * Helper to construct a draft working copy with common metadata populated.
 */
export function createDraftBase<TEntity>(
  params: CreateDraftBaseParams<TEntity>,
): DraftBase<TEntity> {
  const now = Date.now() as Timestamp;
  return {
    treeNodeId: params.meta.treeNodeId,
    draft: params.draft,
    createdAt: params.meta.createdAt ?? now,
    updatedAt: params.meta.updatedAt ?? now,
    originalVersion: params.meta.originalVersion,
  };
}

export function markDraftUpdated<TEntity>(
  draft: DraftBase<TEntity>,
  updates: Partial<TEntity>,
  timestamp: Timestamp = Date.now() as Timestamp,
): DraftBase<TEntity> {
  const mergedDraft = {
    ...draft.draft,
    ...updates,
  };

  return {
    ...draft,
    draft: mergedDraft,
    ...mergedDraft,
    updatedAt: timestamp,
  } satisfies DraftBase<TEntity>;
}
