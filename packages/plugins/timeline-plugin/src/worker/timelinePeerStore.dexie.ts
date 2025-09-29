import type { NodeId } from '@hierarchidb/common-type';
import type { PeerEntity, PeerStore } from '@hierarchidb/runtime-worker';
import type { TimelineEntitiesDB, TimelinePeerRow } from './timelineEntitiesDB.js';

export interface TimelinePeerData {
  flamePerSecond: number;
  restartIntervalInMsec: number;
}

function toRow(nodeId: NodeId, data: TimelinePeerData, timestamp = Date.now()): TimelinePeerRow {
  return {
    nodeId,
    flamePerSecond: data.flamePerSecond,
    restartIntervalInMsec: data.restartIntervalInMsec,
    updatedAt: timestamp,
  };
}

export function createTimelinePeerStoreDexie(db: TimelineEntitiesDB): PeerStore<TimelinePeerData> {
  return {
    async get(nodeId: NodeId) {
      const row = await db.peerEntities.get(nodeId);
      if (!row) return undefined;
      return {
        nodeId: row.nodeId,
        data: {
          flamePerSecond: row.flamePerSecond,
          restartIntervalInMsec: row.restartIntervalInMsec,
        },
        updatedAt: row.updatedAt,
      };
    },
    async put(entity: PeerEntity<TimelinePeerData>) {
      if (!entity.data) return;
      await db.peerEntities.put(toRow(entity.nodeId, entity.data));
    },
    async delete(nodeId: NodeId) {
      await db.peerEntities.delete(nodeId);
    },
    async bulkUpsert(entities: PeerEntity<TimelinePeerData>[]) {
      const now = Date.now();
      const rows = entities
        .filter((entity): entity is PeerEntity<TimelinePeerData> & { data: TimelinePeerData } => !!entity.data)
        .map((entity) => toRow(entity.nodeId, entity.data, now));
      await db.peerEntities.bulkPut(rows);
    },
  };
}
