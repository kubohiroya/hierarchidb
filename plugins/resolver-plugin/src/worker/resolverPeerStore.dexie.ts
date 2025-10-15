import type { NodeId } from '@hierarchidb/common-types';
import type { PeerEntity, PeerStore } from '@hierarchidb/runtime-worker';
import type { ResolverEntitiesDB, ResolverPeerRow } from './resolverEntitiesDB.js';
import type { ResolverPeerData } from '../types/index.js';

// TODO(resolver-runtime-worker-integration): once resolver plugin has runtime
// worker adapters, expose its client through
// @hierarchidb/runtime-worker-factory instead of manual peer store
// registration.

const normalizeResolverPeerData = (data?: ResolverPeerData | null): ResolverPeerData => ({
  schemaVersion: 1,
  lastExecutedAt: data?.lastExecutedAt,
  metadata: data?.metadata ?? {},
});

export function createResolverPeerStoreDexie(db: ResolverEntitiesDB): PeerStore<ResolverPeerData> {
  return {
    async get(nodeId: NodeId) {
      const row = await db.peerEntities.get(nodeId);
      if (!row) return undefined;
      const entity: PeerEntity<ResolverPeerData> = {
        ...row,
        data: normalizeResolverPeerData(row.data),
      };
      return entity;
    },
    async put(entity: PeerEntity<ResolverPeerData>) {
      const row: ResolverPeerRow = {
        ...entity,
        data: normalizeResolverPeerData(entity.data),
        updatedAt: Date.now(),
      };
      await db.peerEntities.put(row);
    },
    async delete(nodeId: NodeId) {
      await db.peerEntities.delete(nodeId);
    },
    async bulkUpsert(entities: PeerEntity<ResolverPeerData>[]) {
      const now = Date.now();
      const rows: ResolverPeerRow[] = entities.map((e) => ({
        ...e,
        data: normalizeResolverPeerData(e.data),
        updatedAt: now,
      }));
      await db.peerEntities.bulkPut(rows);
    },
  };
}
