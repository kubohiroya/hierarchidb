import { createDexieFeatureStore } from '@hierarchidb/runtime-worker';
import type { FeatureStore } from '@hierarchidb/runtime-worker';
import type { RouteDB, RouteLineString } from '@hierarchidb/route-store';

type Item = RouteLineString;

export function createRouteFeatureStoreDexie(db: RouteDB): FeatureStore<Item> {
  return createDexieFeatureStore(db);
}
