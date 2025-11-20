declare module '@hierarchidb/basemap-plugin/worker' {
  import type { PeerStore } from '@hierarchidb/runtime-worker';

  export interface RegisterBasemapWorkerStoresOptions {
    storeRegistry?: {
      getPeer<T = unknown>(nodeType: string): PeerStore<T> | undefined;
      registerPeer<T = unknown>(nodeType: string, store: PeerStore<T>): void;
    };
    signal?: AbortSignal;
  }

  export function registerBasemapWorkerStores(
    options?: RegisterBasemapWorkerStoresOptions
  ): Promise<void>;
}
