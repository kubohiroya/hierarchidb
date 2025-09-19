import type { NodeId } from '@hierarchidb/common-type';
import type { PeerEntity, PeerStore } from '@hierarchidb/runtime-worker';
import type { SheetPeerRow, SpreadsheetEntitiesDB } from './spreadsheetEntitiesDB.js';

export function createSpreadsheetPeerStoreDexie(db: SpreadsheetEntitiesDB): PeerStore<any> {
  return {
    async get(nodeId: NodeId) {
      return (await db.peerEntities.get(nodeId)) as any;
    },
    async put(e: PeerEntity<any>) {
      const row: SheetPeerRow = { nodeId: e.nodeId, updatedAt: Date.now(), displayMode: (e as any).displayMode };
      await db.peerEntities.put(row);
    },
    async delete(nodeId: NodeId) {
      await db.peerEntities.delete(nodeId);
    },
    async bulkUpsert(entities: PeerEntity<any>[]) {
      const rows = entities.map((e) => ({ nodeId: e.nodeId, updatedAt: Date.now(), displayMode: (e as any).displayMode })) as SheetPeerRow[];
      await db.peerEntities.bulkPut(rows);
    },
  };
}
