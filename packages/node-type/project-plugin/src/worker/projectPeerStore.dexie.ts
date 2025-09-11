import type { NodeId } from '@hierarchidb/common-type';
import type { ProjectEntitiesDB, ProjectPeerRow } from './projectEntitiesDB';

// Minimal local replicas to avoid hard type coupling to runtime-worker during DTS
export type PeerEntity<T = any> = { nodeId: NodeId; updatedAt: number; data?: T } & Record<string, any>;
export type PeerStore<T = any> = {
  get(nodeId: NodeId): Promise<PeerEntity<T> | undefined>;
  put(e: PeerEntity<T>): Promise<void>;
  delete(nodeId: NodeId): Promise<void>;
  bulkUpsert(entities: PeerEntity<T>[]): Promise<void>;
};

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
