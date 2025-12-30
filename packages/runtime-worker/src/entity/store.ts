import type { NodeId } from '@hierarchidb/common-types';

/**
 * Abstractions for plugin entity stores (Feature/VectorTile/Relational).
 * Implementations should wrap per-plugin Dexie databases that expose
 * the same logical table names:
 *   - features
 *   - vectorTiles
 *   - relations
 *
 * Each plugin provides its own DB instance (e.g. `<pluginName>-entities`),
 * keeping table names consistent so that shared handlers/utilities can be reused.
 */

// Feature: 1:N under a node; primary key is [nodeId + id]
export interface FeatureItemBase<TItemData = unknown> {
  id: string | number; // stable item id (string or auto-increment)
  data?: TItemData;
  updatedAt?: number;
}

export interface FeatureStore<TItem extends FeatureItemBase = FeatureItemBase> {
  // Read items under a node (needed for duplication/import)
  list(nodeId: NodeId): Promise<TItem[]>;

  bulkUpsert(nodeId: NodeId, items: TItem[]): Promise<void>;

  bulkDelete(nodeId: NodeId, itemIds: Array<TItem['id']>): Promise<void>;
}

// VectorTile: 1:N under a node; primary key is [nodeId + z + x + y] (or tileId)
export interface VectorTileItemBase {
  id: string;
  data?: ArrayBuffer | Uint8Array;
  updatedAt?: number;
}

export interface VectorTileStore<TItem extends VectorTileItemBase = VectorTileItemBase> {
  list(nodeId: NodeId): Promise<TItem[]>;

  bulkUpsert(nodeId: NodeId, items: TItem[]): Promise<void>;

  bulkDelete(nodeId: NodeId, itemIds: Array<TItem['id']>): Promise<void>;
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
