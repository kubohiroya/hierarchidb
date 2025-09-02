import type { NodeId } from '@hierarchidb/common-type';
import type { PeerEntity, PeerStore } from '@hierarchidb/runtime-worker/entity/store';
import type { SpreadsheetEntitiesDB, SheetPeerRow } from './spreadsheetEntitiesDB';
import type { SpreadsheetPeerData } from '../types/entities';

export function createSpreadsheetPeerStoreDexie(db: SpreadsheetEntitiesDB): PeerStore<SpreadsheetPeerData> {
  return {
    async get(nodeId: NodeId) { return (await db.peerEntities.get(nodeId)) as any; },
    async put(e: PeerEntity<SpreadsheetPeerData>) {
      const data = normalizeV1(e.data);
      await db.peerEntities.put({ ...e, data, updatedAt: Date.now() } as SheetPeerRow);
    },
    async delete(nodeId: NodeId) { await db.peerEntities.delete(nodeId); },
    async bulkUpsert(entities: PeerEntity<SpreadsheetPeerData>[]) {
      const rows = entities.map((e) => ({ ...e, data: normalizeV1(e.data), updatedAt: Date.now() })) as SheetPeerRow[];
      await db.peerEntities.bulkPut(rows);
    },
  };
}

function normalizeV1(data?: SpreadsheetPeerData): SpreadsheetPeerData {
  if (!data) return { schemaVersion: 1 } as SpreadsheetPeerData;
  if ((data as any).schemaVersion === 1) return data;
  if ((data as any).schemaVersion === undefined) return { ...data, schemaVersion: 1 } as SpreadsheetPeerData;
  throw new Error(`Unsupported SpreadsheetPeerData schemaVersion: ${(data as any).schemaVersion}`);
}
