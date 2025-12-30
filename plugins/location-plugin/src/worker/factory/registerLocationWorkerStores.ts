/// <reference types="vite/client" />


import type {
  FeatureItemBase,
  FeatureStore,
  RelationBase,
  RelationStore,
  VectorTileItemBase,
  VectorTileStore,
} from '@hierarchidb/runtime-worker';
import { isDevEnvironment } from '../../common/utils/env.js';

type StoreRegistry = {
  getFeatures<T extends FeatureItemBase<any> = FeatureItemBase<any>>(nodeType: string): FeatureStore<T> | undefined;
  registerFeatures<T extends FeatureItemBase<any>>(nodeType: string, store: FeatureStore<T>): void;
  getVectorTiles<T extends VectorTileItemBase = VectorTileItemBase>(nodeType: string): VectorTileStore<T> | undefined;
  registerVectorTiles<T extends VectorTileItemBase>(nodeType: string, store: VectorTileStore<T>): void;
  getRelations<T extends RelationBase<any> = RelationBase<any>>(nodeType: string): RelationStore<T> | undefined;
  registerRelations<T extends RelationBase<any>>(nodeType: string, store: RelationStore<T>): void;
};

export interface RegisterLocationWorkerStoresOptions {
  storeRegistry?: StoreRegistry;
  signal?: AbortSignal;
}

async function resolveStoreRegistry(options: RegisterLocationWorkerStoresOptions = {}): Promise<StoreRegistry | null> {
  if (options.storeRegistry) {
    return options.storeRegistry;
  }
  try {
    const runtime = await import('@hierarchidb/runtime-worker');
    return (runtime as { storeRegistry?: StoreRegistry }).storeRegistry ?? null;
  } catch {
    return null;
  }
}

async function ensureLocationStores(registry: StoreRegistry): Promise<void> {
  const { LocationDB } = await import('../locationEntitiesDB.js');
  const db = new LocationDB();
  await db.open?.();

  if (!registry.getFeatures('location')) {
    const { createLocationFeatureStoreDexie } = await import('../locationGroupStore.dexie.js');
    registry.registerFeatures('location', createLocationFeatureStoreDexie(db));
  }
  if (!registry.getVectorTiles('location')) {
    const { createLocationVectorTileStoreDexie } = await import('../locationVectorTileStore.dexie.js');
    registry.registerVectorTiles('location', createLocationVectorTileStoreDexie(db));
  }
  if (!registry.getRelations('location')) {
    const { createLocationRelationStoreDexie } = await import('../locationRelationStore.dexie.js');
    registry.registerRelations('location', createLocationRelationStoreDexie(db));
  }
}

export async function registerLocationWorkerStores(options: RegisterLocationWorkerStoresOptions = {}): Promise<void> {
  if (options.signal?.aborted) return;
  const registry = await resolveStoreRegistry(options);
  if (!registry) return;
  try {
    await ensureLocationStores(registry);
  } catch (error) {
    if (isDevEnvironment) console.warn('[location-worker] store registration failed', error);
  }
}

type LocationEntitiesDbModule = typeof import('../locationEntitiesDB.js');

export async function loadLocationEntitiesDbModule(): Promise<LocationEntitiesDbModule | null> {
  try {
    return await import('../locationEntitiesDB.js');
  } catch {
    return null;
  }
}

// Side-effect for legacy consumers
registerLocationWorkerStores().catch(() => {});
