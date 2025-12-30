import type { NodeId } from '@hierarchidb/common-types';
import type { FeatureStore } from '@hierarchidb/runtime-worker';
import type { FeatureRecord, ShapeDB } from '@hierarchidb/shape-store';

type Item = FeatureRecord;

export function createShapeFeatureStoreDexie(db: ShapeDB): FeatureStore<Item> {
  return {
    async list(nodeId: NodeId) {
      return db.features.where('nodeId').equals(nodeId).toArray();
    },
    async bulkUpsert(nodeId: NodeId, items: Item[]) {
      if (!items.length) return;
      const now = Date.now();
      const rows = items.map(({ id: _id, ...rest }) => ({
        ...rest,
        nodeId,
        createdAt: now,
        updatedAt: now,
      })) as Omit<Item, 'id'>[];
      await db.features.bulkAdd(rows);
    },
    async bulkDelete(_nodeId: NodeId, itemIds: Array<Item['id']>) {
      await db.features.bulkDelete(itemIds);
    },
  };
}
