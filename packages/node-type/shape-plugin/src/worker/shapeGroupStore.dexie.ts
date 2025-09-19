import type { NodeId } from '@hierarchidb/common-type';
import type { GroupItemBase, GroupStore } from '@hierarchidb/runtime-worker';
import type { ShapeEntitiesDB, ShapeGroupRow } from './shapeEntitiesDB.js';

type Item = GroupItemBase<{ value?: unknown }>;

export function createShapeGroupStoreDexie(db: ShapeEntitiesDB): GroupStore<Item> {
  return {
    async list(nodeId: NodeId) {
      const rows = await db.groupEntities.where('nodeId').equals(nodeId).toArray();
      return rows.map(({ id, data, updatedAt }) => ({
        id,
        data: (data ?? undefined) as Item['data'],
        updatedAt,
      }));
    },
    async bulkUpsert(nodeId: NodeId, items: Item[]) {
      const timestamp = Date.now();
      const rows: ShapeGroupRow[] = items.map((item) => ({
        nodeId,
        id: item.id,
        data: item.data,
        updatedAt: item.updatedAt ?? timestamp,
      }));
      await db.groupEntities.bulkPut(rows);
    },
    async bulkDelete(nodeId: NodeId, itemIds: string[]) {
      await db.transaction('rw', db.groupEntities, async () => {
        for (const id of itemIds) {
          await db.groupEntities.delete([nodeId, id]);
        }
      });
    },
  };
}
