import type { NodeId } from '@hierarchidb/common-type';
import type { PeerEntity, PeerStore } from '@hierarchidb/runtime-worker';
import type { LocationEntitiesDB, LocationPeerRow } from './locationEntitiesDB';
import type { LocationPeerData } from '../types/entities';

export function createLocationPeerStoreDexie(db: LocationEntitiesDB): PeerStore<LocationPeerData> {
  return {
    async get(nodeId: NodeId) {
      return (await db.peerEntities.get(nodeId)) as any;
    },
    async put(e: PeerEntity<LocationPeerData>) {
      const data = normalizeV1(e.data);
      await db.peerEntities.put({ ...e, data, updatedAt: Date.now() } as LocationPeerRow);
    },
    async delete(nodeId: NodeId) {
      await db.peerEntities.delete(nodeId);
    },
    async bulkUpsert(entities: PeerEntity<LocationPeerData>[]) {
      const rows = entities.map((e) => ({
        ...e,
        data: normalizeV1(e.data),
        updatedAt: Date.now(),
      })) as LocationPeerRow[];
      await db.peerEntities.bulkPut(rows);
    },
  };
}

function normalizeV1(data?: LocationPeerData): LocationPeerData {
  if (!data) return { schemaVersion: 1 } as LocationPeerData;
  if ((data as any).schemaVersion === 1) return data;
  if ((data as any).schemaVersion === undefined) return { ...data, schemaVersion: 1 } as LocationPeerData;
  throw new Error(`Unsupported LocationPeerData schemaVersion: ${(data as any).schemaVersion}`);
}
