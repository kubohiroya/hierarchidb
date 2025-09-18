import type { NodeId } from '@hierarchidb/common-type';
import type { PeerEntity, PeerStore } from '@hierarchidb/runtime-worker';
import type { ShapeEntitiesDB, ShapePeerRow } from './shapeEntitiesDB.js';
import type { ShapePeerData } from '../types/entities.js';

export function createShapePeerStoreDexie(db: ShapeEntitiesDB): PeerStore<ShapePeerData> {
  return {
    async get(nodeId: NodeId) {
      return (await db.peerEntities.get(nodeId)) as any;
    },
    async put(e: PeerEntity<ShapePeerData>) {
      const data = normalizeV1(e.data);
      await db.peerEntities.put({ ...e, data, updatedAt: Date.now() } as ShapePeerRow);
    },
    async delete(nodeId: NodeId) {
      await db.peerEntities.delete(nodeId);
    },
    async bulkUpsert(entities: PeerEntity<ShapePeerData>[]) {
      const rows = entities.map((e) => ({ ...e, data: normalizeV1(e.data), updatedAt: Date.now() })) as ShapePeerRow[];
      await db.peerEntities.bulkPut(rows);
    },
  };
}

function normalizeV1(data?: ShapePeerData): ShapePeerData {
  if (!data) return { schemaVersion: 1 } as ShapePeerData;
  if ((data as any).schemaVersion === 1) return data;
  if ((data as any).schemaVersion === undefined) return { ...data, schemaVersion: 1 } as ShapePeerData;
  throw new Error(`Unsupported ShapePeerData schemaVersion: ${(data as any).schemaVersion}`);
}
