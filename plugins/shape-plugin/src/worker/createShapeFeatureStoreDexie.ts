import { createDexieFeatureStore } from '@hierarchidb/runtime-worker';
import type { FeatureStore } from '@hierarchidb/runtime-worker';
import type { FeatureRecord, ShapeDB } from '@hierarchidb/shape-store';

type Item = FeatureRecord;

export function createShapeFeatureStoreDexie(db: ShapeDB): FeatureStore<Item> {
  return createDexieFeatureStore(db);
}
