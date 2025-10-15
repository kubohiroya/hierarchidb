import type { NodeId } from '@hierarchidb/common-types';
import type { PeerEntity, PeerStore } from '@hierarchidb/runtime-worker';
import type { ShapeEntitiesDB, ShapePeerRow } from './shapeEntitiesDB.js';
import type { ShapePeerData } from '../common/types/entities.js';

export function createShapePeerStoreDexie(db: ShapeEntitiesDB): PeerStore<ShapePeerData> {
  return {
    async get(nodeId: NodeId) {
      const row = await db.peerEntities.get(nodeId);
      if (!row) return undefined;
      const entity: PeerEntity<ShapePeerData> = {
        ...row,
        data: normalizeV1(row.data),
      };
      return entity;
    },
    async put(e: PeerEntity<ShapePeerData>) {
      const data = normalizeV1(e.data);
      const row: ShapePeerRow = {
        ...e,
        data,
        updatedAt: Date.now(),
      };
      await db.peerEntities.put(row);
    },
    async delete(nodeId: NodeId) {
      await db.peerEntities.delete(nodeId);
    },
    async bulkUpsert(entities: PeerEntity<ShapePeerData>[]) {
      const now = Date.now();
      const rows: ShapePeerRow[] = entities.map((e) => ({
        ...e,
        data: normalizeV1(e.data),
        updatedAt: now,
      }));
      await db.peerEntities.bulkPut(rows);
    },
  };
}

function normalizeV1(data?: ShapePeerData | null): ShapePeerData {
  return {
    schemaVersion: 1,
    lastProcessedTile: data?.lastProcessedTile,
    metadata: data?.metadata ?? {},
  };
}
