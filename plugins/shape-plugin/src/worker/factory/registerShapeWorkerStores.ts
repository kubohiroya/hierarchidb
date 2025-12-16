/// <reference types="vite/client" />

import type { GroupItemBase, GroupStore, PeerStore, RelationBase, RelationStore } from '@hierarchidb/runtime-worker';
import type { ShapeEntitiesDB } from '../shapeEntitiesDB.js';

type StoreRegistry = {
  getPeer<T = unknown>(nodeType: string): PeerStore<T> | undefined;
  registerPeer<T = unknown>(nodeType: string, store: PeerStore<T>): void;
  getGroup<T extends GroupItemBase<unknown> = GroupItemBase<unknown>>(nodeType: string): GroupStore<T> | undefined;
  registerGroup<T extends GroupItemBase<unknown>>(nodeType: string, store: GroupStore<T>): void;
  getRelations<T extends RelationBase<unknown> = RelationBase<unknown>>(nodeType: string): RelationStore<T> | undefined;
  registerRelations<T extends RelationBase<unknown>>(nodeType: string, store: RelationStore<T>): void;
};

export interface RegisterShapeWorkerStoresOptions {
  storeRegistry?: StoreRegistry;
  signal?: AbortSignal;
}

async function resolveStoreRegistry(options: RegisterShapeWorkerStoresOptions = {}): Promise<StoreRegistry | null> {
  if (options.storeRegistry) {
    return options.storeRegistry;
  }
  type RuntimeWorkerModule = typeof import('@hierarchidb/runtime-worker') & {
    storeRegistry?: StoreRegistry;
  };
  const runtime = (await import('@hierarchidb/runtime-worker')) as RuntimeWorkerModule;
  const storeRegistry = runtime.storeRegistry;
  return storeRegistry ?? null;
}

async function ensureShapeStores(registry: StoreRegistry): Promise<void> {
  type ShapeEntitiesDbModule = {
    ShapeEntitiesDB: new () => ShapeEntitiesDB & { open?: () => Promise<unknown> };
  };
  type ShapeGroupStoreModule = {
    createShapeGroupStoreDexie: (db: ShapeEntitiesDB) => GroupStore<GroupItemBase<{ value?: unknown }>>;
  };
  type ShapeRelationStoreModule = {
    createShapeRelationStoreDexie: (db: ShapeEntitiesDB) => RelationStore<RelationBase<{ weight?: number }>>;
  };

  const { ShapeEntitiesDB } = (await import('../shapeEntitiesDB.js')) as ShapeEntitiesDbModule;
  const db = new ShapeEntitiesDB();
  const maybeOpen = db.open;
  if (typeof maybeOpen === 'function') {
    await maybeOpen.call(db);
  }

  if (!registry.getGroup('shape')) {
    const { createShapeGroupStoreDexie } = (await import('../shapeGroupStore.dexie.js')) as ShapeGroupStoreModule;
    registry.registerGroup('shape', createShapeGroupStoreDexie(db));
  }

  if (!registry.getRelations('shape')) {
    const { createShapeRelationStoreDexie } = (await import('../shapeRelationStore.dexie.js')) as ShapeRelationStoreModule;
    registry.registerRelations('shape', createShapeRelationStoreDexie(db));
  }
}

export async function registerShapeWorkerStores(options: RegisterShapeWorkerStoresOptions = {}): Promise<void> {
  if (options.signal?.aborted) {
    return;
  }

  const registry = await resolveStoreRegistry(options);
  if (!registry) {
    return;
  }

  await ensureShapeStores(registry);
}

export async function loadShapeEntitiesDbModule() {
  return import('../shapeEntitiesDB.js');
}

registerShapeWorkerStores().catch(() => {});
