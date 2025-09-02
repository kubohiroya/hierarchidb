import type { NodeId } from '@hierarchidb/common-type';
import type { PeerEntity, PeerStore } from '@hierarchidb/runtime-worker/entity/store';
import type { SpreadsheetEntitiesDB, SheetPeerRow } from './spreadsheetEntitiesDB';
import type { SpreadsheetPeerData } from '../types/entities';

export function createSpreadsheetPeerStoreDexie(db: SpreadsheetEntitiesDB): PeerStore<SpreadsheetPeerData> {
  return {
    async get(nodeId: NodeId) { return (await db.peerEntities.get(nodeId)) as any; },
    async put(e: PeerEntity<SpreadsheetPeerData>) { await db.peerEntities.put({ ...e, updatedAt: Date.now() } as SheetPeerRow); },
    async delete(nodeId: NodeId) { await db.peerEntities.delete(nodeId); },
    async bulkUpsert(entities: PeerEntity<SpreadsheetPeerData>[]) { await db.peerEntities.bulkPut(entities.map((e) => ({ ...e, updatedAt: Date.now() })) as any); },
  };
}

