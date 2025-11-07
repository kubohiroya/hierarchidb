/// <reference types="vite/client" />

const hasIndexedDB = typeof indexedDB !== 'undefined' && !!indexedDB.open;

import type { PeerStore } from '@hierarchidb/runtime-worker';

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
  return null;
}

async function ensureResolverStores(registry: StoreRegistry): Promise<void> {
  const { ResolverPeerEntitiesDB } = await import('../resolverPeerEntitiesDB.js');
  const db = new ResolverPeerEntitiesDB();
  await db.open?.();

  if (!registry.getPeer('resolver')) {
    const { createResolverPeerStoreDexie } = await import('../resolverPeerStore.dexie.js');
    registry.registerPeer('resolver', createResolverPeerStoreDexie(db));
  }
}

export async function registerResolverWorkerStores(options: RegisterResolverWorkerStoresOptions = {}): Promise<void> {
  if (!hasIndexedDB || options.signal?.aborted) {
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
  return import('../resolverPeerEntitiesDB.js');
}

registerResolverWorkerStores().catch(() => {});
