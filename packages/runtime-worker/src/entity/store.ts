import type { NodeId } from '@hierarchidb/common-types';

interface DialogWindowState {
  mode?: 'normal' | 'maximize' | 'full-screen';
  position?: { x: number; y: number } | null;
  size?: { width: number; height: number } | null;
}

interface DialogProgressState {
  /**
   * 1-based index of the last active step when the dialog was persisted.
   */
  activeStepIndex: number;
}

/**
 * Abstractions for plugin entity stores (Peer/Group/Relational).
 * Implementations should wrap per-plugin Dexie databases that expose
 * the same logical table names:
 *   - peerEntities
 *   - groupEntities
 *   - relations
 *
 * Each plugin provides its own DB instance (e.g. `<pluginName>-entities`),
 * keeping table names consistent so that shared handlers/utilities can be reused.
 */

// Peer: 1:1 with TreeNode; primary key is nodeId
export interface PeerEntity<TData = unknown> {
  nodeId: NodeId;
  // Domain data only; UI-facing fields (name/description) live in TreeNode
  data?: TData;
  updatedAt?: number;
  // Persisted dialog window state (mode/position/size)
  dialogWindow?: DialogWindowState | null;
  // Minimal multi-step dialog progress snapshot
  dialogProgress?: DialogProgressState | null;
}

export interface PeerStore<TData = unknown> {
  get(nodeId: NodeId): Promise<PeerEntity<TData> | undefined>;

  put(entity: PeerEntity<TData>): Promise<void>;

  delete(nodeId: NodeId): Promise<void>;

  // Optional fast-path for bulk upsert
  bulkUpsert?(entities: PeerEntity<TData>[]): Promise<void>;
}

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
