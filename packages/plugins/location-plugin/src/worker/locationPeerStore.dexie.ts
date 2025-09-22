import type { NodeId } from '@hierarchidb/common-type';
import type { PeerEntity, PeerStore } from '@hierarchidb/runtime-worker';
import type { LocationEntitiesDB } from './locationEntitiesDB.js';
import type { LocationPeerData } from '../types/entities.js';
import { fromPeerRow, toPeerRow } from './normalizers.js';

export function createLocationPeerStoreDexie(db: LocationEntitiesDB): PeerStore<LocationPeerData> {
  return {
    async get(nodeId: NodeId) {
      const row = await db.peerEntities.get(nodeId);
      return fromPeerRow(row);
    },
    async put(e: PeerEntity<LocationPeerData>) {
      const row = toPeerRow({
        ...e,
        data: e.data,
      });
      await db.peerEntities.put(row);
    },
    async delete(nodeId: NodeId) {
      await db.peerEntities.delete(nodeId);
    },
    async bulkUpsert(entities: PeerEntity<LocationPeerData>[]) {
      const now = Date.now();
      const rows = entities.map((entity) =>
        toPeerRow({
          ...entity,
          data: entity.data,
        }, now),
      );
      await db.peerEntities.bulkPut(rows);
    },
  };
}
