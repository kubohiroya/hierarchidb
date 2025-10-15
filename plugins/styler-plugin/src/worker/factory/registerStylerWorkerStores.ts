/// <reference types="vite/client" />

const hasIndexedDB = typeof indexedDB !== 'undefined' && !!indexedDB.open;

type PeerStore = unknown;

type StoreRegistry = {
  getPeer(nodeType: string): PeerStore | undefined;
  registerPeer(nodeType: string, store: PeerStore): void;
};

export interface RegisterStylerWorkerStoresOptions {
  storeRegistry?: StoreRegistry;
  signal?: AbortSignal;
}

async function resolveStoreRegistry(options: RegisterStylerWorkerStoresOptions = {}): Promise<StoreRegistry | null> {
  if (options.storeRegistry) {
    return options.storeRegistry;
  }
  try {
    const { importRuntimeWorker } = await import('@hierarchidb/runtime-shared-module-paths');
    const runtime = await importRuntimeWorker();
    return runtime.storeRegistry as StoreRegistry;
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn('[styler-worker] failed to import runtime worker module', error);
    }
    return null;
  }
}

async function ensureStylerStores(registry: StoreRegistry): Promise<void> {
  const { StylerEntitiesDB } = await import('../worker/stylerEntitiesDB.js');
  const db = new StylerEntitiesDB();
  await db.open?.();

  if (!registry.getPeer('styler')) {
    const { createStylerPeerStoreDexie } = await import('../worker/stylerPeerStore.dexie.js');
    registry.registerPeer('styler', createStylerPeerStoreDexie(db));
  }
}

export async function registerStylerWorkerStores(options: RegisterStylerWorkerStoresOptions = {}): Promise<void> {
  if (!hasIndexedDB || options.signal?.aborted) {
    return;
  }

  const registry = await resolveStoreRegistry(options);
  if (!registry) {
    return;
  }

  try {
    await ensureStylerStores(registry);
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn('[styler-worker] failed to register Dexie stores', error);
    }
  }
}

export async function loadStylerEntitiesDbModule() {
  return import(/* @vite-ignore */ '../worker/stylerEntitiesDB.js');
}

registerStylerWorkerStores().catch(() => {});
