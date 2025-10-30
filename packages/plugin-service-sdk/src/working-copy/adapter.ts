import type { NodeId, Timestamp } from '@hierarchidb/common-types';
import { createDraftWorkingCopyBase, markWorkingCopyUpdated } from './helpers.js';
import type { WorkingCopyDraft } from '@hierarchidb/plugin-service-api';

export interface EntityWorkingCopyAdapter<TEntity, TWorkingCopy extends WorkingCopyDraft<TEntity>> {
  fromEntity(entity: TEntity): TWorkingCopy;
  createDraft(treeNodeId: NodeId, overrides?: Partial<TEntity>): TWorkingCopy;
  merge(workingCopy: TWorkingCopy, updates: Partial<TEntity>, timestamp?: Timestamp): TWorkingCopy;
}

export interface EntityAdapterOptions<TEntity, TWorkingCopy extends WorkingCopyDraft<TEntity>> {
  /**
   * Produce a partial snapshot (draft payload) from the entity.
   * Must include domain fields that should remain mutable in the working copy.
   */
  draftFromEntity(entity: TEntity): Partial<TEntity>;
  /**
   * Produce a draft payload for new working copies (create flow).
   */
  draftDefaults(treeNodeId: NodeId, overrides?: Partial<TEntity>): Partial<TEntity>;
  /**
   * Optional hook when creating a working copy from entity.
   */
  finalize?(workingCopy: TWorkingCopy, source: TEntity): TWorkingCopy;
  /**
   * Optional hook when creating a draft working copy.
   */
  finalizeDraft?(workingCopy: TWorkingCopy, treeNodeId: NodeId): TWorkingCopy;
}

export function createEntityWorkingCopyAdapter<TEntity, TWorkingCopy extends WorkingCopyDraft<TEntity>>(
  options: EntityAdapterOptions<TEntity, TWorkingCopy>,
): EntityWorkingCopyAdapter<TEntity, TWorkingCopy> {
  const ensureTimestamp = (value: number | undefined, fallback: () => number): Timestamp => (
    (value ?? fallback()) as Timestamp
  );

  const buildWorkingCopy = (
    treeNodeId: NodeId,
    draft: Partial<TEntity>,
    meta: {
      createdAt?: number;
      updatedAt?: number;
      originalVersion?: number;
    },
  ): TWorkingCopy => {
    const createdAt = ensureTimestamp(meta.createdAt, () => Date.now());
    const updatedAt = ensureTimestamp(meta.updatedAt, () => createdAt);

    const base = createDraftWorkingCopyBase<TEntity>({
      draft: {
        ...draft,
        createdAt,
        updatedAt,
      },
      meta: {
        treeNodeId,
        createdAt,
        updatedAt,
        originalVersion: meta.originalVersion,
      },
    });

    return {
      ...base,
      ...draft,
    } as unknown as TWorkingCopy;
  };

  return {
    fromEntity(entity: TEntity): TWorkingCopy {
      const draft = options.draftFromEntity(entity);
      const nodeId = (draft as { nodeId?: NodeId }).nodeId ?? (entity as { nodeId?: NodeId }).nodeId ?? (entity as any).id;
      let workingCopy = buildWorkingCopy(nodeId, draft, {
        createdAt: (entity as any).createdAt,
        updatedAt: (entity as any).updatedAt,
        originalVersion: (entity as any).version,
      });
      if (options.finalize) {
        workingCopy = options.finalize(workingCopy, entity);
      }
      return workingCopy;
    },

    createDraft(treeNodeId: NodeId, overrides?: Partial<TEntity>): TWorkingCopy {
      const draft = options.draftDefaults(treeNodeId, overrides);
      let workingCopy = buildWorkingCopy(treeNodeId, draft, {
        createdAt: (draft as any)?.createdAt,
        updatedAt: (draft as any)?.updatedAt,
        originalVersion: (draft as any)?.version,
      });
      if (options.finalizeDraft) {
        workingCopy = options.finalizeDraft(workingCopy, treeNodeId);
      }
      return workingCopy;
    },

    merge(workingCopy: TWorkingCopy, updates: Partial<TEntity>, timestamp: Timestamp = Date.now() as Timestamp): TWorkingCopy {
      const base = markWorkingCopyUpdated<TEntity>(workingCopy, updates, timestamp);
      const mergedDraft = {
        ...workingCopy,
        ...workingCopy.draft,
        ...updates,
        updatedAt: timestamp,
      } as Partial<TEntity>;
      return {
        ...workingCopy,
        ...base,
        ...mergedDraft,
      } as TWorkingCopy;
    },
  };
}
