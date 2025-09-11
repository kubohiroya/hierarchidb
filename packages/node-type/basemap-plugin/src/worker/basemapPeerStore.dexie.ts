import type { NodeId } from '@hierarchidb/common-type';
import type { PeerEntity, PeerStore } from '@hierarchidb/runtime-worker';
import type { BasemapEntitiesDB, BasemapPeerRow } from './basemapEntitiesDB';

export function createBasemapPeerStoreDexie(db: BasemapEntitiesDB): PeerStore<any> {
  return {
    async get(nodeId: NodeId) {
      return (await db.peerEntities.get(nodeId)) as unknown as PeerEntity<any> | undefined;
    },
    async put(e: PeerEntity<any>) {
      const row: BasemapPeerRow = { nodeId: e.nodeId, data: normalizeSchema(e.data), updatedAt: Date.now() };
      await db.peerEntities.put(row);
    },
    async delete(nodeId: NodeId) {
      await db.peerEntities.delete(nodeId);
    },
    async bulkUpsert(entities: PeerEntity<any>[]) {
      const rows: BasemapPeerRow[] = entities.map((e) => ({ nodeId: e.nodeId, data: normalizeSchema(e.data), updatedAt: Date.now() }));
      await db.peerEntities.bulkPut(rows);
    },
  };
}

function normalizeSchema(data?: any): any {
  // Basemap peer payload is currently unconstrained; stamp schemaVersion=1 if absent
  if (!data) return { schemaVersion: 1 };
  if ((data as any).schemaVersion === 1) return data;
  if ((data as any).schemaVersion === undefined) return { ...data, schemaVersion: 1 };
  return data;
}

