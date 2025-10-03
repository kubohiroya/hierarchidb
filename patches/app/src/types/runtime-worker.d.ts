declare module '@hierarchidb/runtime-worker' {
  export class WorkerService {
    static getSingleton(...args: unknown[]): Promise<WorkerService>;
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    getQueryAPI(): unknown;
    getMutationAPI(): unknown;
    getSubscriptionAPI(): unknown;
    getWorkingCopyAPI(): unknown;
    getImportExportAPI(): unknown;
    getTagAPI(): unknown;
    getDialogStateAPI(): unknown;
    ping(): { response: string; timestamp: number };
  }

  export type PeerEntity = Record<string, unknown>;
  export type PeerStore<T = unknown> = {
    get(nodeId: string): Promise<T | undefined>;
    put(entity: T): Promise<void>;
    delete(nodeId: string): Promise<void>;
    bulkUpsert?(entities: T[]): Promise<void>;
  };
  export type GroupItemBase = Record<string, unknown>;
  export type GroupStore<T = unknown> = PeerStore<T>;
  export type RelationBase = Record<string, unknown>;
  export type RelationStore<T = unknown> = PeerStore<T>;
}
