import { Dexie, type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-type';
import type { ShapePeerData } from '../types/entities.js';

export type ShapePeerRow = {
  nodeId: NodeId;
  data?: ShapePeerData;
  updatedAt?: number;
  displayMode?: 'normal' | 'maximize' | 'full-screen';
  dialogPosition?: { x: number; y: number } | null;
  dialogSize?: { width: number; height: number } | null;
};
export type ShapeGroupRow = { nodeId: NodeId; id: string; data?: unknown; updatedAt?: number };
export type ShapeRelationRow = {
  srcNodeId: NodeId;
  dstNodeId: NodeId;
  type: string;
  meta?: unknown;
  updatedAt?: number
};

export class ShapeEntitiesDB extends Dexie {
  peerEntities!: Table<ShapePeerRow, NodeId>;
  groupEntities!: Table<ShapeGroupRow, [NodeId, string]>;
  relations!: Table<ShapeRelationRow, [NodeId, string, NodeId]>;

  constructor(name = getDBName('shape-entities-db')) {
    super(name);
    this.version(1).stores({
      peerEntities: '&nodeId, updatedAt',
      groupEntities: '&[nodeId+id], nodeId, id, updatedAt',
      relations: '&[srcNodeId+type+dstNodeId], srcNodeId, dstNodeId, type, updatedAt',
    });
    // Future migrations example (no-op upgrade to document the pattern)
    this.version(2).upgrade(() => {
      // Example: backfill updatedAt if missing or set defaults for new fields
      // Kept empty as a template; implement real transforms when schema changes.
    });
  }
}
