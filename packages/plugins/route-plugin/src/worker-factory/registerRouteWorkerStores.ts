/// <reference types="vite/client" />

const hasIndexedDB = typeof indexedDB !== 'undefined' && !!indexedDB.open;

import type { PeerStore } from '@hierarchidb/runtime-worker';

type StoreRegistry = {
  getPeer<T = unknown>(nodeType: string): PeerStore<T> | undefined;
  registerPeer<T = unknown>(nodeType: string, store: PeerStore<T>): void;
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
    const { importRuntimeWorker } = await import('@hierarchidb/runtime-shared-module-paths');
    const runtime = await importRuntimeWorker();
    return runtime.storeRegistry as StoreRegistry;
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn('[route-worker] failed to import runtime worker module', error);
    }
    return null;
  }
}

async function ensureRouteStores(registry: StoreRegistry): Promise<void> {
  const { RouteEntitiesDB } = await import('../worker/routeEntitiesDB.js');
  const db = new RouteEntitiesDB();
  await db.open?.();

  if (!registry.getPeer('route')) {
    const { createRoutePeerStoreDexie } = await import('../worker/routePeerStore.dexie.js');
    registry.registerPeer('route', createRoutePeerStoreDexie(db));
  }
}

export async function registerRouteWorkerStores(options: RegisterRouteWorkerStoresOptions = {}): Promise<void> {
  if (!hasIndexedDB || options.signal?.aborted) {
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
  return import(/* @vite-ignore */ '../worker/routeEntitiesDB.js');
}

registerRouteWorkerStores().catch(() => {});
