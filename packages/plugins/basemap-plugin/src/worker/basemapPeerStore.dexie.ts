import type { NodeId } from '@hierarchidb/common-type';
import type { PeerEntity, PeerStore } from '@hierarchidb/runtime-worker';
import type { BasemapEntitiesDB, BasemapPeerRow } from './basemapEntitiesDB.js';
import type { BasemapPeerData } from '../types/BaseMapEntity.js';

// TODO(basemap-runtime-worker-integration): when basemap adopts the shared
// runtime worker factory, register its client via
// @hierarchidb/plugins-runtime-worker-factory rather than manual peer store
// wiring.

export function createBasemapPeerStoreDexie(db: BasemapEntitiesDB): PeerStore<BasemapPeerData> {
  return {
    async get(nodeId: NodeId) {
      const row = await db.peerEntities.get(nodeId);
      if (!row) return undefined;
      const entity: PeerEntity<BasemapPeerData> = {
        ...row,
        data: normalizeBasemapPeerData(row.data),
      };
      return entity;
    },
    async put(e: PeerEntity<BasemapPeerData>) {
      const row: BasemapPeerRow = {
        ...e,
        data: normalizeBasemapPeerData(e.data),
        updatedAt: Date.now(),
      };
      await db.peerEntities.put(row);
    },
    async delete(nodeId: NodeId) {
      await db.peerEntities.delete(nodeId);
    },
    async bulkUpsert(entities: PeerEntity<BasemapPeerData>[]) {
      const now = Date.now();
      const rows: BasemapPeerRow[] = entities.map((e) => ({
        ...e,
        data: normalizeBasemapPeerData(e.data),
        updatedAt: now,
      }));
      await db.peerEntities.bulkPut(rows);
    },
  };
}

function normalizeBasemapPeerData(data?: BasemapPeerData | null): BasemapPeerData {
  return {
    schemaVersion: 1,
    presentation: data?.presentation,
    metadata: data?.metadata ?? {},
  };
}
