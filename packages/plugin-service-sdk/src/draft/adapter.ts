import type { NodeId, Timestamp } from '@hierarchidb/common-types';

export interface EntityDraftAdapter<TEntity> {
  fromEntity(entity: Partial<TEntity>): Partial<TEntity>;
  createDraft(treeNodeId: NodeId, overrides?: Partial<TEntity>): Partial<TEntity>;
  merge(draft: Partial<TEntity>, updates: Partial<TEntity>, timestamp?: Timestamp): Partial<TEntity>;
}

export interface EntityAdapterOptions<TEntity> {
  /**
   * Produce a partial snapshot (draft payload) from the entity.
   * Must include domain fields that should remain mutable in the draft state.
   */
  draftFromEntity(entity: Partial<TEntity>): Partial<TEntity>;
  /**
   * Produce a draft payload for new draft entries (create flow).
   */
  draftDefaults(treeNodeId: NodeId, overrides?: Partial<TEntity>): Partial<TEntity>;
  /**
   * Optional hook when creating a draft from an entity.
   */
  finalize?(draft: Partial<TEntity>, source: Partial<TEntity>): Partial<TEntity>;
  /**
   * Optional hook when creating a draft node.
   */
  finalizeDraft?(draft: Partial<TEntity>, treeNodeId: NodeId): Partial<TEntity>;
}

type MetaFields = {
  id?: NodeId;
  nodeId?: NodeId;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  version?: number;
};

type DraftEnvelope<TEntity> = Partial<TEntity> & {
  treeNodeId: NodeId;
  draft: Partial<TEntity>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  originalVersion?: number;
};

const ensureTimestamp = (value: number | undefined, fallback: () => number): Timestamp =>
  (value ?? fallback()) as Timestamp;

const resolveNodeId = <TEntity>(payload: Partial<TEntity>, entity: Partial<TEntity>): NodeId => {
  const fromPayload = (payload as Partial<MetaFields>).nodeId ?? (payload as Partial<MetaFields>).id;
  const fromEntity = (entity as Partial<MetaFields>).nodeId ?? (entity as Partial<MetaFields>).id;
  return (fromPayload ?? fromEntity ?? '') as NodeId;
};

const extractMeta = <T>(source: Partial<T>): MetaFields => ({
  id: (source as Partial<MetaFields>).id,
  nodeId: (source as Partial<MetaFields>).nodeId,
  createdAt: (source as Partial<MetaFields>).createdAt,
  updatedAt: (source as Partial<MetaFields>).updatedAt,
  version: (source as Partial<MetaFields>).version,
});

const buildDraft = <TEntity>(
  treeNodeId: NodeId,
  draftPayload: Partial<TEntity>,
  meta: MetaFields
): DraftEnvelope<TEntity> => {
  const createdAt = ensureTimestamp(meta.createdAt, () => Date.now());
  const updatedAt = ensureTimestamp(meta.updatedAt, () => createdAt);
  return {
    treeNodeId,
    draft: { ...draftPayload },
    createdAt,
    updatedAt,
    originalVersion: meta.version,
    ...draftPayload,
  };
};

const markDraftUpdated = <TEntity>(
  draft: Partial<TEntity>,
  updates: Partial<TEntity>,
  timestamp: Timestamp = Date.now() as Timestamp
): DraftEnvelope<TEntity> => {
  const meta = extractMeta(draft);
  const currentDraft =
    (draft as Partial<{ draft?: Partial<TEntity> }>).draft ?? (draft as Partial<TEntity>);
  const treeNodeId = meta.nodeId ?? meta.id ?? (draft as { treeNodeId?: NodeId }).treeNodeId ?? '' as NodeId;
  return {
    ...draft,
    treeNodeId,
    draft: { ...(currentDraft ?? {}), ...updates },
    updatedAt: timestamp,
    createdAt: ensureTimestamp(meta.createdAt, () => Date.now()),
    originalVersion: meta.version,
  };
};

const coerceDraftEnvelope = <TEntity>(
  treeNodeId: NodeId,
  value: Partial<TEntity>,
  meta: MetaFields
): DraftEnvelope<TEntity> => {
  const metaFromValue = extractMeta(value);
  const mergedMeta: MetaFields = {
    ...meta,
    ...metaFromValue,
  };
  const draftPayload =
    (value as Partial<{ draft?: Partial<TEntity> }>).draft ?? (value as Partial<TEntity>);
  return buildDraft(treeNodeId, draftPayload ?? {}, mergedMeta);
};

export function createEntityDraftAdapter<TEntity>(
  options: EntityAdapterOptions<TEntity>
): EntityDraftAdapter<TEntity> {
  return {
    fromEntity(entity: Partial<TEntity>): Partial<TEntity> {
      const draftPayload = options.draftFromEntity(entity);
      const meta = extractMeta(entity);
      const nodeId = resolveNodeId(draftPayload, entity);
      let draftWithMeta = buildDraft(nodeId, draftPayload, meta);
      if (options.finalize) {
        draftWithMeta = coerceDraftEnvelope(
          nodeId,
          options.finalize(draftWithMeta, entity),
          meta
        );
      }
      return draftWithMeta;
    },

    createDraft(treeNodeId: NodeId, overrides?: Partial<TEntity>): Partial<TEntity> {
      const draftPayload = options.draftDefaults(treeNodeId, overrides);
      const meta = extractMeta(draftPayload);
      let draftWithMeta = buildDraft(treeNodeId, draftPayload, meta);
      if (options.finalizeDraft) {
        draftWithMeta = coerceDraftEnvelope(
          treeNodeId,
          options.finalizeDraft(draftWithMeta, treeNodeId),
          meta
        );
      }
      return draftWithMeta;
    },

    merge(
      draft: Partial<TEntity>,
      updates: Partial<TEntity>,
      timestamp: Timestamp = Date.now() as Timestamp
    ): Partial<TEntity> {
      return markDraftUpdated(draft, updates, timestamp);
    },
  };
}
