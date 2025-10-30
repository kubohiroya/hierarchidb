/// <reference types="vite/client" />

import type { PeerStore } from '@hierarchidb/plugin-service-sdk';
import type { RoutePeerData } from '../../common/types/index.js';

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
  const { RouteEntitiesDB } = await import('../routeEntitiesDB.js');
  const db = new RouteEntitiesDB();
  await db.open?.();

  if (!registry.getPeer('route')) {
    const { createRoutePeerStoreDexie } = await import('../routePeerStore.dexie.js');
    // 型アサートでplugin-types型に変換
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
  return import(/* @vite-ignore */ '../routeEntitiesDB.js');
}

registerRouteWorkerStores().catch(() => {});
