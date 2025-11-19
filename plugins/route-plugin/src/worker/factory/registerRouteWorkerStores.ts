/// <reference types="vite/client" />

import type { PeerStore } from '@hierarchidb/runtime-worker';
import { createNodePayloadPeerStore } from '@hierarchidb/runtime-worker';
import type { RoutePeerData } from '../../common/types/index.js';

const normalizeRoutePeerData = (data?: RoutePeerData | null): RoutePeerData => ({
  schemaVersion: 1,
  lastComputedAt: data?.lastComputedAt,
  metadata: data?.metadata ?? {},
});


// StoreRegistryをRoutePeerDataに特化

type StoreRegistry = {
  getPeer(nodeType: string): PeerStore<RoutePeerData> | undefined;
  registerPeer(nodeType: string, store: PeerStore<RoutePeerData>): void;
};

export interface RegisterRouteWorkerStoresOptions {
  storeRegistry?: StoreRegistry;
  signal?: AbortSignal;
}

async function resolveStoreRegistry(options: RegisterRouteWorkerStoresOptions = {}): Promise<StoreRegistry | null> {
  if (options.storeRegistry) {
    return options.storeRegistry;
  }
  try {
    const runtime = await import('@hierarchidb/runtime-worker');
    const candidate = runtime as { storeRegistry?: StoreRegistry };
    if (candidate.storeRegistry) {
      return candidate.storeRegistry;
    }
    return null;
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn('[route-worker] failed to import runtime worker module', error);
    }
    return null;
  }
}

async function ensureRouteStores(registry: StoreRegistry): Promise<void> {
  if (!registry.getPeer('route')) {
    registry.registerPeer(
      'route',
      createNodePayloadPeerStore({
        normalize: (data) => normalizeRoutePeerData(data ?? undefined),
      })
    );
  }
}

export async function registerRouteWorkerStores(options: RegisterRouteWorkerStoresOptions = {}): Promise<void> {
  if (options.signal?.aborted) {
    return;
  }

  const registry = await resolveStoreRegistry(options);
  if (!registry) {
    return;
  }

  try {
    await ensureRouteStores(registry);
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn('[route-worker] failed to register Dexie stores', error);
    }
  }
}

export async function loadRouteEntitiesDbModule() {
  return undefined;
}

registerRouteWorkerStores().catch(() => {});
