import Dexie, { type Table } from 'dexie';
import type { NodeId } from '@hierarchidb/common-type';

export type ShapePeerRow = { nodeId: NodeId; data?: unknown; updatedAt?: number };
export type ShapeGroupRow = { nodeId: NodeId; id: string; data?: unknown; updatedAt?: number };
export type ShapeRelationRow = { srcNodeId: NodeId; dstNodeId: NodeId; type: string; meta?: unknown; updatedAt?: number };

export class ShapeEntitiesDB extends Dexie {
  peerEntities!: Table<ShapePeerRow, NodeId>;
  groupEntities!: Table<ShapeGroupRow, [NodeId, string]>;
  relations!: Table<ShapeRelationRow, [NodeId, string, NodeId]>;

  constructor(name = 'shape-plugin-entities') {
    super(name);
    this.version(1).stores({
      peerEntities: '&nodeId, updatedAt',
      groupEntities: '&[nodeId+id], nodeId, id, updatedAt',
      relations: '&[srcNodeId+type+dstNodeId], srcNodeId, dstNodeId, type, updatedAt',
    });
  }
}

