declare module '@hierarchidb/runtime-worker' {
  import type { NodeId } from '@hierarchidb/common-type';

  export type PeerEntity<T = any> = { id: NodeId } & Record<string, any>;

  export interface PeerStore<T = any> {
    get(nodeId: NodeId): Promise<PeerEntity<T> | undefined>;
    put(entity: PeerEntity<T>): Promise<void>;
    delete(nodeId: NodeId): Promise<void>;
    bulkUpsert(entities: PeerEntity<T>[]): Promise<void>;
  }

  export const storeRegistry: {
    getPeer(nodeType: string): PeerStore<any> | undefined;
    registerPeer(nodeType: string, store: PeerStore<any>): void;
  };
}

