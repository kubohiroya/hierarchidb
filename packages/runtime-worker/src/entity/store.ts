/**
 * Abstractions for plugin entity stores (Group/Relational).
 * Implementations should wrap per-plugin Dexie databases that expose
 * the same logical table names:
 *   - groupEntities
 *   - relations
 *
 * Each plugin provides its own DB instance (e.g. `<pluginName>-entities`),
 * keeping table names consistent so that shared handlers/utilities can be reused.
 */

// Group: 1:N under a node; primary key is [nodeId + id]
export interface GroupItemBase<TItemData = unknown> {
  id: string; // stable item id
  data?: TItemData;
  updatedAt?: number;
}

export interface GroupStore<TItem extends GroupItemBase = GroupItemBase> {
  // Read items under a node (needed for duplication/import)
  list(nodeId: NodeId): Promise<TItem[]>;

  bulkUpsert(nodeId: NodeId, items: TItem[]): Promise<void>;

  bulkDelete(nodeId: NodeId, itemIds: string[]): Promise<void>;
}

// Relational: N:N between nodes; primary key is [srcNodeId + type + dstNodeId]
export interface RelationBase<TRelMeta = unknown> {
  srcNodeId: NodeId;
  dstNodeId: NodeId;
  type: string;
  meta?: TRelMeta;
  updatedAt?: number;
}

export interface RelationStore<TRel extends RelationBase = RelationBase> {
  // Read relations originating from a node (srcNodeId)
  listByNode(nodeId: NodeId): Promise<TRel[]>;

  bulkUpsert(rels: TRel[]): Promise<void>;

  bulkDelete(rels: TRel[]): Promise<void>;
}
