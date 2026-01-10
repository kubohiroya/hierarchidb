import type {
  FeatureItemBase,
  FeatureStore,
  RelationBase,
  RelationStore,
  VectorTileItemBase,
  VectorTileStore,
} from '@hierarchidb/runtime-worker';
import type { RouteDB } from '@hierarchidb/route-store';
export { getBatchTasks } from './getBatchTasks.js';

type StoreRegistry = {
  getFeatures<T extends FeatureItemBase<unknown> = FeatureItemBase<unknown>>(nodeType: string): FeatureStore<T> | undefined;
  registerFeatures<T extends FeatureItemBase<unknown>>(nodeType: string, store: FeatureStore<T>): void;
  getVectorTiles<T extends VectorTileItemBase = VectorTileItemBase>(nodeType: string): VectorTileStore<T> | undefined;
  registerVectorTiles<T extends VectorTileItemBase>(nodeType: string, store: VectorTileStore<T>): void;
  getRelations<TRel extends RelationBase<unknown> = RelationBase<unknown>>(nodeType: string): RelationStore<TRel> | undefined;
  registerRelations<TRel extends RelationBase<unknown>>(nodeType: string, store: RelationStore<TRel>): void;
};

async function resolveStoreRegistry(): Promise<StoreRegistry | null> {
  type RuntimeWorkerModule = typeof import('@hierarchidb/runtime-worker') & {
    storeRegistry?: StoreRegistry;
  };
  const runtime = (await import('@hierarchidb/runtime-worker')) as RuntimeWorkerModule;
  return runtime.storeRegistry ?? null;
}

async function ensureRouteStores(registry: StoreRegistry): Promise<void> {
  type RouteStoreModule = {
    RouteDB: new () => RouteDB & { open?: () => Promise<unknown> };
  };
  const { RouteDB } = (await import('@hierarchidb/route-store')) as RouteStoreModule;
  const db = new RouteDB();
  await db.open?.();

  if (!registry.getFeatures('route')) {
    const { createRouteFeatureStoreDexie } = await import('./routeFeatureStore.dexie.js');
    registry.registerFeatures('route', createRouteFeatureStoreDexie(db));
  }
  if (!registry.getVectorTiles('route')) {
    const { createRouteVectorTileStoreDexie } = await import('./routeVectorTileStore.dexie.js');
    registry.registerVectorTiles('route', createRouteVectorTileStoreDexie(db));
  }
}

export const registerRouteWorkerStores = async (): Promise<void> => {
  const registry = await resolveStoreRegistry();
  if (!registry) return;
  await ensureRouteStores(registry);
};

export default registerRouteWorkerStores;
