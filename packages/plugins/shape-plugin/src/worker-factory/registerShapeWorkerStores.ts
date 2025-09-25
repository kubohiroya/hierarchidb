/// <reference types="vite/client" />

const hasIndexedDB = typeof indexedDB !== 'undefined' && !!indexedDB.open;

import type { GroupItemBase, GroupStore, PeerStore, RelationBase, RelationStore } from '@hierarchidb/runtime-worker';

type StoreRegistry = {
  getPeer<T = unknown>(nodeType: string): PeerStore<T> | undefined;
  registerPeer<T = unknown>(nodeType: string, store: PeerStore<T>): void;
  getGroup<T extends GroupItemBase<any> = GroupItemBase<any>>(nodeType: string): GroupStore<T> | undefined;
  registerGroup<T extends GroupItemBase<any>>(nodeType: string, store: GroupStore<T>): void;
  getRelations<T extends RelationBase<any> = RelationBase<any>>(nodeType: string): RelationStore<T> | undefined;
  registerRelations<T extends RelationBase<any>>(nodeType: string, store: RelationStore<T>): void;
};

export interface RegisterShapeWorkerStoresOptions {
  storeRegistry?: StoreRegistry;
  signal?: AbortSignal;
}

async function resolveStoreRegistry(options: RegisterShapeWorkerStoresOptions = {}): Promise<StoreRegistry | null> {
  if (options.storeRegistry) {
    return options.storeRegistry;
  }
  try {
    const { importRuntimeWorker } = await import('@hierarchidb/runtime-shared-module-paths');
    const runtime = await importRuntimeWorker();
    return runtime.storeRegistry as StoreRegistry;
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn('[shape-worker] failed to import runtime worker module', error);
    }
    return null;
  }
}

async function ensureShapeStores(registry: StoreRegistry): Promise<void> {
  type ShapeEntitiesDbModule = {
    ShapeEntitiesDB: new () => { open?: () => Promise<unknown> };
  };

  const { ShapeEntitiesDB } = (await import('../worker/shapeEntitiesDB.js')) as ShapeEntitiesDbModule;
  const db = new ShapeEntitiesDB();
  const maybeOpen = (db as { open?: () => Promise<unknown> }).open;
  if (typeof maybeOpen === 'function') {
    await maybeOpen.call(db);
  }

  if (!registry.getPeer('shape')) {
    const { createShapePeerStoreDexie } = (await import('../worker/shapePeerStore.dexie.js')) as {
      createShapePeerStoreDexie: (db: unknown) => PeerStore<unknown>;
    };
    registry.registerPeer('shape', createShapePeerStoreDexie(db));
  }

  if (!registry.getGroup('shape')) {
    const { createShapeGroupStoreDexie } = (await import('../worker/shapeGroupStore.dexie.js')) as {
      createShapeGroupStoreDexie: (db: unknown) => GroupStore<GroupItemBase<any>>;
    };
    registry.registerGroup('shape', createShapeGroupStoreDexie(db));
  }

  if (!registry.getRelations('shape')) {
    const { createShapeRelationStoreDexie } = (await import('../worker/shapeRelationStore.dexie.js')) as {
      createShapeRelationStoreDexie: (db: unknown) => RelationStore<RelationBase<any>>;
    };
    registry.registerRelations('shape', createShapeRelationStoreDexie(db));
  }
}

export async function registerShapeWorkerStores(options: RegisterShapeWorkerStoresOptions = {}): Promise<void> {
  if (!hasIndexedDB || options.signal?.aborted) {
    return;
  }

  const registry = await resolveStoreRegistry(options);
  if (!registry) {
    return;
  }

  try {
    await ensureShapeStores(registry);
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn('[shape-worker] failed to register Dexie stores', error);
    }
  }
}

export async function loadShapeEntitiesDbModule() {
  return import(/* @vite-ignore */ '../worker/shapeEntitiesDB.js');
}

registerShapeWorkerStores().catch(() => {});
