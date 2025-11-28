/// <reference types="vite/client" />

import type { PeerStore } from '@hierarchidb/runtime-worker';
import { createNodePayloadPeerStore } from '@hierarchidb/runtime-worker';
import { normalizeFolderPeerData } from '../../common/types/types.ts';
import type { FolderPeerData } from '../../common/types/types.ts';

type StoreRegistry = {
  getPeer<T = unknown>(nodeType: string): PeerStore<T> | undefined;
  registerPeer<T = unknown>(nodeType: string, store: PeerStore<T>): void;
};

export interface RegisterFolderWorkerStoresOptions {
  storeRegistry?: StoreRegistry;
  signal?: AbortSignal;
}

async function resolveStoreRegistry(options: RegisterFolderWorkerStoresOptions = {}): Promise<StoreRegistry | null> {
  if (options.storeRegistry) {
    return options.storeRegistry;
  }
  try {
    type RuntimeWorkerModule = typeof import('@hierarchidb/runtime-worker') & {
      storeRegistry?: StoreRegistry;
    };
    const runtime = (await import('@hierarchidb/runtime-worker')) as RuntimeWorkerModule;
    return runtime.storeRegistry ?? null;
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn('[folder-worker] failed to import runtime-worker worker module', error);
    }
    return null;
  }
}

async function ensureFolderStores(registry: StoreRegistry): Promise<void> {
  if (!registry.getPeer('folder')) {
    registry.registerPeer(
      'folder',
      createNodePayloadPeerStore<FolderPeerData>({
        normalize: (data) => normalizeFolderPeerData(data ?? null),
      })
    );
  }

}

export async function registerFolderWorkerStores(options: RegisterFolderWorkerStoresOptions = {}): Promise<void> {
  if (options.signal?.aborted) {
    return;
  }

  const registry = await resolveStoreRegistry(options);
  if (!registry) {
    return;
  }

  try {
    await ensureFolderStores(registry);
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn('[folder-worker] failed to register folder stores', error);
    }
  }
}

// Maintain legacy side-effect registration for existing consumers
registerFolderWorkerStores().catch(() => {});
