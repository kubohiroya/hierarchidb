import type { NodeId } from '@hierarchidb/common-types';
import type { FeatureStore } from '@hierarchidb/runtime-worker';
import type { RouteLineString } from '@hierarchidb/route-store';
import type { RouteDB } from '@hierarchidb/route-store';

type Item = RouteLineString;

export function createRouteFeatureStoreDexie(db: RouteDB): FeatureStore<Item> {
  return {
    async list(nodeId: NodeId): Promise<Item[]> {
      const rows = await db.features.where('nodeId').equals(nodeId).toArray();
      return rows.map((row) => ({ ...row }));
    },
    async bulkUpsert(nodeId: NodeId, items: Item[]): Promise<void> {
      if (!items.length) return;
      const rows = items.map((item) => ({ ...item, nodeId }));
      await db.features.bulkPut(rows);
    },
    async bulkDelete(_nodeId: NodeId, itemIds: Array<Item['id']>): Promise<void> {
      await db.features.bulkDelete(itemIds);
    },
  };
}
