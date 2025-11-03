/// <reference types="vite/client" />

const hasIndexedDB = typeof indexedDB !== 'undefined' && !!indexedDB.open;

import type { PeerStore } from '@hierarchidb/runtime-worker';

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
      console.warn('[basemap-worker] failed to import runtime worker module', error);
    }
    return null;
  }
}

async function ensureBasemapStores(registry: StoreRegistry): Promise<void> {
  const { BasemapEntitiesDB } = await import('../basemapEntitiesDB.js');
  const db = new BasemapEntitiesDB();
  await db.open?.();

  if (!registry.getPeer('basemap')) {
    const { createBasemapPeerStoreDexie } = await import('../basemapPeerStore.dexie.js');
    registry.registerPeer('basemap', createBasemapPeerStoreDexie(db));
  }
}

export async function registerBasemapWorkerStores(
  options: RegisterBasemapWorkerStoresOptions = {}
): Promise<void> {
  if (!hasIndexedDB || options.signal?.aborted) {
    return;
  }

  const registry = await resolveStoreRegistry(options);
  if (!registry) {
    return;
  }

  try {
    await ensureBasemapStores(registry);
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn('[basemap-worker] failed to register Dexie stores', error);
    }
  }
}

export async function loadBasemapEntitiesDbModule() {
  return import(/* @vite-ignore */ '../basemapEntitiesDB.js');
}

// Preserve legacy side-effect registration
registerBasemapWorkerStores().catch(() => {});
