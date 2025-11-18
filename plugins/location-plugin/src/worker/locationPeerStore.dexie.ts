import type { NodeId } from '@hierarchidb/common-types';
import type { PeerEntity as RuntimePeerEntity, PeerStore } from '@hierarchidb/runtime-worker';
import type { LocationEntitiesDB } from './locationEntitiesDB.js';
import type { LocationPeerData } from '../common/types/entities.js';
import { fromPeerRow, toPeerRow } from './normalizers.js';

export function createLocationPeerStoreDexie(db: LocationEntitiesDB): PeerStore<LocationPeerData> {
  const store = {
    async get(nodeId: NodeId): Promise<RuntimePeerEntity<LocationPeerData> | undefined> {
      const row = await db.peerEntities.get(nodeId);
      return fromPeerRow(row);
    },
    async put(e: RuntimePeerEntity<LocationPeerData>): Promise<void> {
      const row = toPeerRow({
        ...e,
        data: e.data,
      });
      await db.peerEntities.put(row);
    },
    async delete(nodeId: NodeId): Promise<void> {
      await db.peerEntities.delete(nodeId);
    },
    async bulkUpsert(entities: RuntimePeerEntity<LocationPeerData>[]): Promise<void> {
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
  return store as PeerStore<LocationPeerData>;
}
