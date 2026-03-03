import { createDexieFeatureStore } from '@hierarchidb/runtime-worker';
import type { FeatureStore } from '@hierarchidb/runtime-worker';
import type { RouteDB, RouteFeature } from '@hierarchidb/route-store';

export function createRouteFeatureStoreDexie(db: RouteDB): FeatureStore<RouteFeature> {
  return createDexieFeatureStore(db);
}
