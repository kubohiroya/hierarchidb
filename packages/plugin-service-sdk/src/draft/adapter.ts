import type { NodeId, Timestamp } from '@hierarchidb/common-types';

export interface EntityDraftAdapter<TEntity> {
  fromEntity(entity: Partial<TEntity>): Partial<TEntity>;
  createDraft(treeNodeId: NodeId, overrides?: Partial<TEntity>): Partial<TEntity>;
  merge(draft: Partial<TEntity>, updates: Partial<TEntity>, timestamp?: Timestamp): Partial<TEntity>;
}

export interface EntityAdapterOptions<TEntity> {
  /**
   * Produce a partial snapshot (draft payload) from the entity.
   * Must include domain fields that should remain mutable in the working copy.
   */
  draftFromEntity(entity: Partial<TEntity>): Partial<TEntity>;
  /**
   * Produce a draft payload for new working copies (create flow).
   */
  draftDefaults(treeNodeId: NodeId, overrides?: Partial<TEntity>): Partial<TEntity>;
  /**
   * Optional hook when creating a working copy from entity.
   */
  finalize?(draft: Partial<TEntity>, source: Partial<TEntity>): Partial<TEntity>;
  /**
   * Optional hook when creating a draft working copy.
   */
  finalizeDraft?(draft: Partial<TEntity>, treeNodeId: NodeId): TEntity;
}
/*
export function createEntityDraftAdapter<TEntity>(
  options: EntityAdapterOptions<TEntity>,
): EntityDraftAdapter<TEntity> {
  const ensureTimestamp = (value: number | undefined, fallback: () => number): Timestamp => (
    (value ?? fallback()) as Timestamp
  );
*/
  /*
  const buildDraftBase = (
    //treeNodeId: NodeId,
    draft: Partial<TEntity>,
    meta: {
      createdAt?: number;
      updatedAt?: number;
      originalVersion?: number;
    },
  ): Partial<TEntity> => {
    const createdAt = ensureTimestamp(meta.createdAt, () => Date.now());
    const updatedAt = ensureTimestamp(meta.updatedAt, () => createdAt);
    return {
      draft,
      createdAt,
      updatedAt,
      originalVersion: meta.originalVersion,
    };
  };

  const markDraftUpdated = (
    draft: Partial<TEntity>,
    updates: Partial<TEntity>,
    timestamp: Timestamp = Date.now() as Timestamp,
  ): Partial<TEntity> => ({
    ...draft,
    draft: { ...draft, ...updates },
    updatedAt: timestamp,
  });

  const buildDraft = (
    treeNodeId: NodeId,
    draft: Partial<TEntity>,
    meta: {
      createdAt?: number;
      updatedAt?: number;
      originalVersion?: number;
    },
  ): Partial<TEntity> => {
    const createdAt = ensureTimestamp(meta.createdAt, () => Date.now());
    const updatedAt = ensureTimestamp(meta.updatedAt, () => createdAt);

    const base = buildDraftBase(
      treeNodeId,
      {
        ...draft,
        createdAt,
        updatedAt,
      },
      {
        createdAt,
        updatedAt,
        originalVersion: meta.originalVersion,
      },
    );

    return {
      ...base,
      ...draft,
    } as Partial<TEntity>;
  };

  return {
    fromEntity(entity: TEntity): Partial<TEntity> {
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

    createDraft(treeNodeId: NodeId, overrides?: Partial<TEntity>): Partial<TEntity> {
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
      draft: Partial<TEntity>,
      updates: Partial<TEntity>,
      timestamp: Timestamp = Date.now() as Timestamp,
    ): Partial<TEntity> {
      return markDraftUpdated(draft, updates, timestamp) as Partial<TEntity>;
    },
  };
}
   */
