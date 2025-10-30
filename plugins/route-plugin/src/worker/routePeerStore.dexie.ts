import type { PeerEntityBase, PeerStore } from '@hierarchidb/plugin-service-sdk';
import type { RouteEntitiesDB, RoutePeerRow } from './routeEntitiesDB.js';
import type { RoutePeerData } from '../common/types/index.js';
import { NodeId } from '@hierarchidb/common-types';

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
      // PeerEntityBase型を厳密に満たすようにdataを必ずRoutePeerData型で返す
      const entity: PeerEntityBase<RoutePeerData> = {
        ...row,
        data: normalizeRoutePeerData(row.data),
      };
      return entity;
    },
    async put(entity: PeerEntityBase<RoutePeerData>) {
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
    async bulkUpsert(entities: PeerEntityBase<RoutePeerData>[]) {
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
