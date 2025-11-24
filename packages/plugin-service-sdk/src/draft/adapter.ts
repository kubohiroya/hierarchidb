import type { NodeId, Timestamp } from '@hierarchidb/common-types';
import { createDraftBase, markDraftUpdated } from './helpers.js';
import type { DraftBase } from '@hierarchidb/plugin-service-api';

export interface EntityDraftAdapter<TEntity, TDraft extends DraftBase<TEntity>> {
  fromEntity(entity: TEntity): TDraft;
  createDraft(treeNodeId: NodeId, overrides?: Partial<TEntity>): TDraft;
  merge(draft: TDraft, updates: Partial<TEntity>, timestamp?: Timestamp): TDraft;
}

export interface EntityAdapterOptions<TEntity, TDraft extends DraftBase<TEntity>> {
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
  finalize?(draft: TDraft, source: TEntity): TDraft;
  /**
   * Optional hook when creating a draft working copy.
   */
  finalizeDraft?(draft: TDraft, treeNodeId: NodeId): TDraft;
}

export function createEntityDraftAdapter<TEntity, TDraft extends DraftBase<TEntity>>(
  options: EntityAdapterOptions<TEntity, TDraft>,
): EntityDraftAdapter<TEntity, TDraft> {
  const ensureTimestamp = (value: number | undefined, fallback: () => number): Timestamp => (
    (value ?? fallback()) as Timestamp
  );

  const buildDraft = (
    treeNodeId: NodeId,
    draft: Partial<TEntity>,
    meta: {
      createdAt?: number;
      updatedAt?: number;
      originalVersion?: number;
    },
  ): TDraft => {
    const createdAt = ensureTimestamp(meta.createdAt, () => Date.now());
    const updatedAt = ensureTimestamp(meta.updatedAt, () => createdAt);

    const base = createDraftBase<TEntity>({
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
    } as unknown as TDraft;
  };

  return {
    fromEntity(entity: TEntity): TDraft {
      const draftPayload = options.draftFromEntity(entity);
      const nodeId =
        (draftPayload as { nodeId?: NodeId }).nodeId ??
        (entity as { nodeId?: NodeId }).nodeId ??
        (entity as any).id;
      let draftWithMeta = buildDraft(nodeId, draftPayload, {
        createdAt: (entity as any).createdAt,
        updatedAt: (entity as any).updatedAt,
        originalVersion: (entity as any).version,
      });
      if (options.finalize) {
        draftWithMeta = options.finalize(draftWithMeta, entity);
      }
      return draftWithMeta;
    },

    createDraft(treeNodeId: NodeId, overrides?: Partial<TEntity>): TDraft {
      const draftPayload = options.draftDefaults(treeNodeId, overrides);
      let draftWithMeta = buildDraft(treeNodeId, draftPayload, {
        createdAt: (draftPayload as any)?.createdAt,
        updatedAt: (draftPayload as any)?.updatedAt,
        originalVersion: (draftPayload as any)?.version,
      });
      if (options.finalizeDraft) {
        draftWithMeta = options.finalizeDraft(draftWithMeta, treeNodeId);
      }
      return draftWithMeta;
    },

    merge(
      draft: TDraft,
      updates: Partial<TEntity>,
      timestamp: Timestamp = Date.now() as Timestamp,
    ): TDraft {
      const base = markDraftUpdated<TEntity>(draft, updates, timestamp);
      const mergedDraft = {
        ...draft,
        ...draft.draft,
        ...updates,
        updatedAt: timestamp,
      } as Partial<TEntity>;
      return {
        ...draft,
        ...base,
        ...mergedDraft,
      } as TDraft;
    },
  };
}
