/// <reference types="vite/client" />

import type {
  FeatureItemBase,
  FeatureStore,
  RelationBase,
  RelationStore,
  VectorTileItemBase,
  VectorTileStore,
} from '@hierarchidb/runtime-worker';

type StoreRegistry = {
  getFeatures<T extends FeatureItemBase<unknown> = FeatureItemBase<unknown>>(nodeType: string): FeatureStore<T> | undefined;
  registerFeatures<T extends FeatureItemBase<unknown>>(nodeType: string, store: FeatureStore<T>): void;
  getVectorTiles<T extends VectorTileItemBase = VectorTileItemBase>(nodeType: string): VectorTileStore<T> | undefined;
  registerVectorTiles<T extends VectorTileItemBase>(nodeType: string, store: VectorTileStore<T>): void;
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

async function ensureShapeStores(_registry: StoreRegistry): Promise<void> {
  const { ShapeDB } = await import('@hierarchidb/shape-store');
  const db = new ShapeDB();
  const maybeOpen = db.open;
  if (typeof maybeOpen === 'function') {
    await maybeOpen.call(db);
  }

  /*
  if (!registry.getFeatures('shape')) {
    const { createShapeFeatureStoreDexie } = (await import('../shapeGroupStore.dexie.js')) as ShapeGroupStoreModule;
    registry.registerFeatures('shape', createShapeFeatureStoreDexie(db));
  }
  if (!registry.getVectorTiles('shape')) {
    const { createShapeVectorTileStoreDexie } = await import('../shapeVectorTileStore.dexie.js');
    registry.registerVectorTiles('shape', createShapeVectorTileStoreDexie(db));
  }

  if (!registry.getRelations('shape')) {
    const { createShapeRelationStoreDexie } = (await import('../shapeRelationStore.dexie.js')) as ShapeRelationStoreModule;
    registry.registerRelations('shape', createShapeRelationStoreDexie(db));
  }
   */
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

/*
export async function loadShapeEntitiesDbModule() {
  return import('../shapeEntitiesDB.js');
}
 */
