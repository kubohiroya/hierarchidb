/// <reference types="vite/client" />

import type { PeerStore } from '@hierarchidb/runtime-worker';
import { createNodePayloadPeerStore } from '@hierarchidb/runtime-worker';
import type { BasemapPeerData } from '../../common/types/BaseMapEntity.js';
import { PLUGIN_NODE_TYPE } from '../../plugin-manifest.js';

type StoreRegistry = {
  getPeer<T = unknown>(nodeType: string): PeerStore<T> | undefined;
  registerPeer<T = unknown>(nodeType: string, store: PeerStore<T>): void;
};

export interface RegisterBasemapWorkerStoresOptions {
  storeRegistry?: StoreRegistry;
  signal?: AbortSignal;
}

async function resolveStoreRegistry(
  options: RegisterBasemapWorkerStoresOptions = {}
): Promise<StoreRegistry | null> {
  if (options.storeRegistry) {
    return options.storeRegistry;
  }

  try {
    const runtime = await import('@hierarchidb/runtime-worker');
    return runtime.storeRegistry as StoreRegistry;
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn('[basemap-worker] failed to import runtime-worker worker module', error);
    }
    return null;
  }
}

const ensurePeerStore = (registry: StoreRegistry): void => {
  if (registry.getPeer(PLUGIN_NODE_TYPE)) return;
  registry.registerPeer(PLUGIN_NODE_TYPE, createNodePayloadPeerStore<BasemapPeerData>());
};

export async function registerBasemapWorkerStores(
  options: RegisterBasemapWorkerStoresOptions = {}
): Promise<void> {
  if (options.signal?.aborted) {
    return;
  }

  const registry = await resolveStoreRegistry(options);
  if (!registry) {
    return;
  }

  ensurePeerStore(registry);
}

// Preserve legacy side-effect registration
registerBasemapWorkerStores().catch(() => {});
