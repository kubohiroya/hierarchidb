import type { NodeId } from '@hierarchidb/common-type';

/**
 * Abstractions for plugin entity stores (Peer/Group/Relational).
 * Implementations should wrap Dexie tables with the same logical names:
 * - peerEntities
 * - groupEntities
 * - relations
 */

// Peer: 1:1 with TreeNode; primary key is nodeId
export interface PeerEntity {
  nodeId: NodeId;
  // Domain data only; UI-facing fields (name/description) live in TreeNode
  data?: unknown;
  updatedAt?: number;
}

export interface PeerStore {
  get(nodeId: NodeId): Promise<PeerEntity | undefined>;
  put(entity: PeerEntity): Promise<void>;
  delete(nodeId: NodeId): Promise<void>;
}

// Group: 1:N under a node; primary key is [nodeId + id]
export interface GroupItemBase {
  id: string; // stable item id
  updatedAt?: number;
}

export interface GroupStore<TItem extends GroupItemBase> {
  bulkUpsert(nodeId: NodeId, items: TItem[]): Promise<void>;
  bulkDelete(nodeId: NodeId, itemIds: string[]): Promise<void>;
}

// Relational: N:N between nodes; primary key is [srcNodeId + type + dstNodeId]
export interface RelationBase {
  srcNodeId: NodeId;
  dstNodeId: NodeId;
  type: string;
  updatedAt?: number;
}

export interface RelationStore<TRel extends RelationBase> {
  bulkUpsert(rels: TRel[]): Promise<void>;
  bulkDelete(rels: TRel[]): Promise<void>;
}

