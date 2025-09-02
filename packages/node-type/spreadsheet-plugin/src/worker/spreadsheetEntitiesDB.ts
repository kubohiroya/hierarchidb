import Dexie, { type Table } from 'dexie';
import type { NodeId } from '@hierarchidb/common-type';
import type { SpreadsheetPeerData, SpreadsheetGroupItemData, SpreadsheetRelationMeta } from '../types/entities';

export type SheetPeerRow = { nodeId: NodeId; data?: SpreadsheetPeerData; updatedAt?: number };
export type SheetGroupRow = { nodeId: NodeId; id: string; data?: SpreadsheetGroupItemData; updatedAt?: number };
export type SheetRelationRow = { srcNodeId: NodeId; dstNodeId: NodeId; type: string; meta?: SpreadsheetRelationMeta; updatedAt?: number };

export class SpreadsheetEntitiesDB extends Dexie {
  peerEntities!: Table<SheetPeerRow, NodeId>;
  groupEntities!: Table<SheetGroupRow, [NodeId, string]>;
  relations!: Table<SheetRelationRow, [NodeId, string, NodeId]>;

  constructor(name = 'spreadsheet-plugin-entities') {
    super(name);
    this.version(1).stores({
      peerEntities: '&nodeId, updatedAt',
      groupEntities: '&[nodeId+id], nodeId, id, updatedAt',
      relations: '&[srcNodeId+type+dstNodeId], srcNodeId, dstNodeId, type, updatedAt',
    });
  }
}

