import type { NodeId } from '@hierarchidb/common-type';
import type { PeerEntity, PeerStore } from '@hierarchidb/runtime-worker/entity/store';
import type { LocationEntitiesDB, LocationPeerRow } from './locationEntitiesDB';
import type { LocationPeerData } from '../types/entities';

export function createLocationPeerStoreDexie(db: LocationEntitiesDB): PeerStore<LocationPeerData> {
  return {
    async get(nodeId: NodeId) { return (await db.peerEntities.get(nodeId)) as any; },
    async put(e: PeerEntity<LocationPeerData>) { await db.peerEntities.put({ ...e, updatedAt: Date.now() } as LocationPeerRow); },
    async delete(nodeId: NodeId) { await db.peerEntities.delete(nodeId); },
    async bulkUpsert(entities: PeerEntity<LocationPeerData>[]) { await db.peerEntities.bulkPut(entities.map((e) => ({ ...e, updatedAt: Date.now() })) as any); },
  };
}

