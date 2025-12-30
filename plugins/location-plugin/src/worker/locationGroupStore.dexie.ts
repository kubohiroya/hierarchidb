import type { NodeId } from '@hierarchidb/common-types';
import type { FeatureItemBase, FeatureStore } from '@hierarchidb/runtime-worker';
import type { LocationDB } from './locationEntitiesDB.js';
import type { LocationGroupItemData } from '../common/types/entities.js';
import { fromGroupRow, toGroupRow } from './normalizers.js';

type Item = FeatureItemBase<LocationGroupItemData>;

export function createLocationFeatureStoreDexie(db: LocationDB): FeatureStore<Item> {
  const store = {
    async list(nodeId: NodeId): Promise<Item[]> {
      const rows = await db.features.where('nodeId').equals(nodeId).toArray();
      return fromGroupRow(rows);
    },
    async bulkUpsert(nodeId: NodeId, items: Item[]): Promise<void> {
      const now = Date.now();
      const rows = items.map((item) => toGroupRow(nodeId, item, now));
      await db.features.bulkPut(rows);
    },
    async bulkDelete(nodeId: NodeId, itemIds: Array<Item['id']>): Promise<void> {
      await db.transaction('rw', db.features, async () => {
        for (const id of itemIds) await db.features.delete([nodeId, String(id)]);
      });
    },
  };
  return store as FeatureStore<Item>;
}
