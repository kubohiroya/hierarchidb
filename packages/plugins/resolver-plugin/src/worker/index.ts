import { importRuntimeWorker } from '@hierarchidb/runtime-shared-module-paths';
import type { PeerStore } from '@hierarchidb/runtime-worker';

const hasIndexedDB = typeof indexedDB !== 'undefined' && !!indexedDB.open;

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
    const runtime = await importRuntimeWorker();
    return runtime.storeRegistry as StoreRegistry;
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn('[resolver-worker] Failed to import runtime worker for store registry', error);
    }
    return null;
  }
}

async function ensureResolverStores(registry: StoreRegistry): Promise<void> {
  const { ResolverEntitiesDB } = await import('./resolverEntitiesDB.js');
  const db = new ResolverEntitiesDB();
  await db.open?.();

  if (!registry.getPeer('resolver')) {
    const { createResolverPeerStoreDexie } = await import('./resolverPeerStore.dexie.js');
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
      console.warn('[resolver-worker] Failed to register Dexie stores', error);
    }
  }
}

registerResolverWorkerStores().catch(() => {});

export { ResolverEntitiesDB } from './resolverEntitiesDB.js';

export async function loadResolverEntitiesDbModule() {
  return import(/* @vite-ignore */ './resolverEntitiesDB.js');
}
