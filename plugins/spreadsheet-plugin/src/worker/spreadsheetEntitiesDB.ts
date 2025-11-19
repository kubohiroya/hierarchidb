import { Dexie, type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-types';
import type { SpreadsheetGroupItemData, SpreadsheetRelationMeta } from '../common/types/entities.js';

export type SheetGroupRow = { nodeId: NodeId; id: string; data?: SpreadsheetGroupItemData; updatedAt?: number };
export type SheetRelationRow = {
  srcNodeId: NodeId;
  dstNodeId: NodeId;
  type: string;
  meta?: SpreadsheetRelationMeta;
  updatedAt?: number
};

export class SpreadsheetEntitiesDB extends Dexie {
  groupEntities!: Table<SheetGroupRow, [NodeId, string]>;
  relations!: Table<SheetRelationRow, [NodeId, string, NodeId]>;

  constructor(name = getDBName('spreadsheet-entities-db')) {
    super(name);
    this.version(1).stores({
      groupEntities: '&[nodeId+id], nodeId, id, updatedAt',
      relations: '&[srcNodeId+type+dstNodeId], srcNodeId, dstNodeId, type, updatedAt',
    });
    this.version(2).upgrade(() => {
      // Placeholder for future upgrades; add migration logic here.
    });
  }
}
