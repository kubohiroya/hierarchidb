import type { NodeId } from '@hierarchidb/common-types';
import type { PeerEntity, PeerStore } from '@hierarchidb/runtime-worker';
import type { RouteEntitiesDB, RoutePeerRow } from './routeEntitiesDB.js';
import type { RoutePeerData } from '../types/index.js';

const normalizeRoutePeerData = (data?: RoutePeerData | null): RoutePeerData => ({
  schemaVersion: 1,
  lastComputedAt: data?.lastComputedAt,
  metadata: data?.metadata ?? {},
});

export function createRoutePeerStoreDexie(db: RouteEntitiesDB): PeerStore<RoutePeerData> {
  return {
    async get(nodeId: NodeId) {
      const row = await db.peerEntities.get(nodeId);
      if (!row) return undefined;
      const entity: PeerEntity<RoutePeerData> = {
        ...row,
        data: normalizeRoutePeerData(row.data),
      };
      return entity;
    },
    async put(entity: PeerEntity<RoutePeerData>) {
      const row: RoutePeerRow = {
        ...entity,
        data: normalizeRoutePeerData(entity.data),
        updatedAt: Date.now(),
      };
      await db.peerEntities.put(row);
    },
    async delete(nodeId: NodeId) {
      await db.peerEntities.delete(nodeId);
    },
    async bulkUpsert(entities: PeerEntity<RoutePeerData>[]) {
      const now = Date.now();
      const rows: RoutePeerRow[] = entities.map((e) => ({
        ...e,
        data: normalizeRoutePeerData(e.data),
        updatedAt: now,
      }));
      await db.peerEntities.bulkPut(rows);
    },
  };
}
