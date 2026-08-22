import type { RouteDB, RouteFeature } from '@hierarchidb/route-store';
import type { FeatureStore } from '@hierarchidb/runtime-worker';
import { createDexieFeatureStore } from '@hierarchidb/runtime-worker';

export function createRouteFeatureStoreDexie(db: RouteDB): FeatureStore<RouteFeature> {
  return createDexieFeatureStore(db);
}
