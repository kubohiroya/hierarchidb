/// <reference types="vite/client" />


import type { PeerStore } from '@hierarchidb/runtime-worker';
import { createNodePayloadPeerStore } from '@hierarchidb/runtime-worker';
import type { ResolverPeerData } from '../../common/types/index.js';

const normalizeResolverPeerData = (data?: ResolverPeerData | null): ResolverPeerData => ({
  schemaVersion: 1,
  lastExecutedAt: data?.lastExecutedAt,
  metadata: data?.metadata ?? {},
});

type StoreRegistry = {
  getPeer<T = unknown>(nodeType: string): PeerStore<T> | undefined;
  registerPeer<T = unknown>(nodeType: string, store: PeerStore<T>): void;
};

export interface RegisterResolverWorkerStoresOptions {
  storeRegistry?: StoreRegistry;
  signal?: AbortSignal;
}

async function resolveStoreRegistry(options: RegisterResolverWorkerStoresOptions = {}): Promise<StoreRegistry | null> {
  if (options.storeRegistry) {
    return options.storeRegistry;
  }
  try {
    const runtime = await import('@hierarchidb/runtime-worker');
    return runtime.storeRegistry as StoreRegistry;
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn('[resolver-worker] failed to import runtime-worker worker module', error);
    }
    return null;
  }
}

async function ensureResolverStores(registry: StoreRegistry): Promise<void> {
  if (!registry.getPeer('resolver')) {
    registry.registerPeer(
      'resolver',
      createNodePayloadPeerStore<ResolverPeerData>({
        normalize: (data?: ResolverPeerData | null) => normalizeResolverPeerData(data ?? undefined),
      })
    );
  }
}

export async function registerResolverWorkerStores(options: RegisterResolverWorkerStoresOptions = {}): Promise<void> {
  if (options.signal?.aborted) {
    return;
  }

  const registry = await resolveStoreRegistry(options);
  if (!registry) {
    return;
  }

  try {
    await ensureResolverStores(registry);
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn('[resolver-worker] failed to register Dexie stores', error);
    }
  }
}

export async function loadResolverEntitiesDbModule() {
  return undefined;
}

registerResolverWorkerStores().catch(() => {});
