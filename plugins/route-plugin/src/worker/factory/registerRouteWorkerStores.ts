/// <reference types="vite/client" />

import type { PeerStore } from '@hierarchidb/plugin-api';
import type { RoutePeerData } from 'src/types/index.ts';

const hasIndexedDB = typeof indexedDB !== 'undefined' && !!indexedDB.open;

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
    // 型アサートでplugin-api型に変換
    const store = createRoutePeerStoreDexie(db) as unknown as PeerStore<RoutePeerData>;
    registry.registerPeer('route', store);
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
