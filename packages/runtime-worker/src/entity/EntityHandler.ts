import type { NodeId } from '@hierarchidb/core-types';

export interface EntityHandler {
  // Peer
  copyPeer?(originalId: NodeId, wcId: NodeId): Promise<void>;

  upsertPeer?(targetId: NodeId, fromWcId: NodeId): Promise<void>;

  deletePeer?(nodeId: NodeId): Promise<void>;

  // Group
  copyGroup?(originalId: NodeId, wcId: NodeId): Promise<void>;

  upsertGroup?(targetId: NodeId, fromWcId: NodeId): Promise<void>;

  deleteGroup?(nodeId: NodeId): Promise<void>;

  // Relations
  // For base skeleton, keep optional
  copyRelations?(idMap: Map<NodeId, NodeId>): Promise<void>;

  rebindRelations?(idMap: Map<NodeId, NodeId>): Promise<void>;

  deleteRelations?(nodeId: NodeId): Promise<void>;
}
