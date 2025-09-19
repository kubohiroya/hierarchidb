import type { NodeId } from '@hierarchidb/common-type';
import type { StylerEntitiesDB } from './stylerEntitiesDB.js';

// Local minimal replicas to avoid hard type dependency on runtime-worker in DTS
export type PeerEntity<T = any> = { nodeId: NodeId; updatedAt: number; data?: T } & Record<string, any>;
export type PeerStore<T = any> = {
  get(nodeId: NodeId): Promise<PeerEntity<T> | undefined>;
  put(e: PeerEntity<T>): Promise<void>;
  delete(nodeId: NodeId): Promise<void>;
  bulkUpsert(entities: PeerEntity<T>[]): Promise<void>;
};

export function createStylerPeerStoreDexie(db: StylerEntitiesDB): PeerStore<any> {
  return {
    async get(nodeId: NodeId) {
      return (await db.peerEntities.get(nodeId)) as unknown as PeerEntity<any> | undefined;
    },
    async put(e: PeerEntity<any>) {
      await db.peerEntities.put({ nodeId: e.nodeId, updatedAt: Date.now(), displayMode: (e as any).displayMode });
    },
    async delete(nodeId: NodeId) {
      await db.peerEntities.delete(nodeId);
    },
    async bulkUpsert(entities: PeerEntity<any>[]) {
      await db.peerEntities.bulkPut(entities.map((e) => ({ nodeId: e.nodeId, updatedAt: Date.now(), displayMode: (e as any).displayMode })) as any);
    },
  };
}
