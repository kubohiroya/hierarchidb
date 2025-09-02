import type { NodeId } from '@hierarchidb/common-type';
import type { PeerEntity, PeerStore } from '@hierarchidb/runtime-worker/entity/store';
import type { ShapeEntitiesDB, ShapePeerRow } from './shapeEntitiesDB';

export function createShapePeerStoreDexie(db: ShapeEntitiesDB): PeerStore<any> {
  return {
    async get(nodeId: NodeId) { return (await db.peerEntities.get(nodeId)) as any; },
    async put(e: PeerEntity<any>) { await db.peerEntities.put({ ...e, updatedAt: Date.now() } as ShapePeerRow); },
    async delete(nodeId: NodeId) { await db.peerEntities.delete(nodeId); },
    async bulkUpsert(entities: PeerEntity<any>[]) { await db.peerEntities.bulkPut(entities.map((e) => ({ ...e, updatedAt: Date.now() })) as any); },
  };
}

