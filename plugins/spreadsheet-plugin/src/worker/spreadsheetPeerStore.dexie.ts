import type { NodeId } from '@hierarchidb/common-types';
import type { PeerEntity, PeerStore } from '@hierarchidb/runtime-worker';
import type { SheetPeerRow, SpreadsheetEntitiesDB } from './spreadsheetEntitiesDB.js';
import type { SpreadsheetPeerData } from '../types/index.ts';

const normalizeSpreadsheetPeerData = (data?: SpreadsheetPeerData | null): SpreadsheetPeerData => ({
  schemaVersion: 1,
  lastViewedSheet: data?.lastViewedSheet,
  metadata: data?.metadata ?? {},
});

export function createSpreadsheetPeerStoreDexie(db: SpreadsheetEntitiesDB): PeerStore<SpreadsheetPeerData> {
  return {
    async get(nodeId: NodeId) {
      const row = await db.peerEntities.get(nodeId);
      if (!row) return undefined;
      const entity: PeerEntity<SpreadsheetPeerData> = {
        ...row,
        data: normalizeSpreadsheetPeerData(row.data),
      };
      return entity;
    },
    async put(e: PeerEntity<SpreadsheetPeerData>) {
      const row: SheetPeerRow = {
        ...e,
        data: normalizeSpreadsheetPeerData(e.data),
        updatedAt: Date.now(),
      };
      await db.peerEntities.put(row);
    },
    async delete(nodeId: NodeId) {
      await db.peerEntities.delete(nodeId);
    },
    async bulkUpsert(entities: PeerEntity<SpreadsheetPeerData>[]) {
      const now = Date.now();
      const rows: SheetPeerRow[] = entities.map((e) => ({
        ...e,
        data: normalizeSpreadsheetPeerData(e.data),
        updatedAt: now,
      }));
      await db.peerEntities.bulkPut(rows);
    },
  };
}
