import type { NodeId } from '@hierarchidb/common-type';
import type { PeerEntity, PeerStore } from '@hierarchidb/runtime-worker';
import type { ProjectEntitiesDB, ProjectPeerRow } from './projectEntitiesDB';

export function createProjectPeerStoreDexie(db: ProjectEntitiesDB): PeerStore<any> {
  return {
    async get(nodeId: NodeId) {
      return (await db.peerEntities.get(nodeId)) as unknown as PeerEntity<any> | undefined;
    },
    async put(entity: PeerEntity<any>) {
      const row: ProjectPeerRow = { ...entity, updatedAt: Date.now() } as any;
      await db.peerEntities.put(row);
    },
    async delete(nodeId: NodeId) {
      await db.peerEntities.delete(nodeId);
    },
    async bulkUpsert(entities: PeerEntity<any>[]) {
      const rows: ProjectPeerRow[] = entities.map((e) => ({ ...e, updatedAt: Date.now() } as any));
      await db.peerEntities.bulkPut(rows);
    },
  };
}
