/// <reference types="vite/client" />

const hasIndexedDB = typeof indexedDB !== 'undefined' && !!indexedDB.open;

import type { PeerStore } from '@hierarchidb/runtime-worker';

type StoreRegistry = {
  getPeer<T = unknown>(nodeType: string): PeerStore<T> | undefined;
  registerPeer<T = unknown>(nodeType: string, store: PeerStore<T>): void;
};

export interface RegisterTimelineWorkerStoresOptions {
  storeRegistry?: StoreRegistry;
  signal?: AbortSignal;
}

async function resolveStoreRegistry(options: RegisterTimelineWorkerStoresOptions = {}): Promise<StoreRegistry | null> {
  if (options.storeRegistry) {
    return options.storeRegistry;
  }

  try {
    const { importRuntimeWorker } = await import('@hierarchidb/runtime-shared-module-paths');
    const runtime = await importRuntimeWorker();
    return runtime.storeRegistry as StoreRegistry;
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn('[timeline-worker] failed to import runtime worker module', error);
    }
    return null;
  }
}

async function ensureTimelineStores(registry: StoreRegistry): Promise<void> {
  const { TimelineEntitiesDB } = await import('../worker/timelineEntitiesDB.js');
  const db = new TimelineEntitiesDB();
  await db.open?.();

  if (!registry.getPeer('timeline')) {
    const { createTimelinePeerStoreDexie } = await import('../worker/timelinePeerStore.dexie.js');
    registry.registerPeer('timeline', createTimelinePeerStoreDexie(db));
  }
}

export async function registerTimelineWorkerStores(options: RegisterTimelineWorkerStoresOptions = {}): Promise<void> {
  if (!hasIndexedDB || options.signal?.aborted) {
    return;
  }

  const registry = await resolveStoreRegistry(options);
  if (!registry) {
    return;
  }

  try {
    await ensureTimelineStores(registry);
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn('[timeline-worker] failed to register Dexie stores', error);
    }
  }
}

export async function loadTimelineEntitiesDbModule() {
  return import(/* @vite-ignore */ '../worker/timelineEntitiesDB.js');
}

// Maintain legacy side-effect registration for existing consumers
registerTimelineWorkerStores().catch(() => {});

