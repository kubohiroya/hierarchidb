import type { NodeId } from '@hierarchidb/common-type';
import type { GroupItemBase, GroupStore } from '@hierarchidb/runtime-worker/entity/store';
import type { ShapeEntitiesDB, ShapeGroupRow } from './shapeEntitiesDB';

type Item = GroupItemBase<{ value?: unknown }>;

export function createShapeGroupStoreDexie(db: ShapeEntitiesDB): GroupStore<Item> {
  return {
    async list(nodeId: NodeId) { return (await db.groupEntities.where('nodeId').equals(nodeId).toArray()) as any; },
    async bulkUpsert(nodeId: NodeId, items: Item[]) { await db.groupEntities.bulkPut(items.map((i) => ({ ...i, nodeId, updatedAt: Date.now() })) as ShapeGroupRow[]); },
    async bulkDelete(nodeId: NodeId, itemIds: string[]) {
      await db.transaction('rw', db.groupEntities, async () => {
        for (const id of itemIds) await db.groupEntities.delete([nodeId, id] as any);
      });
    },
  };
}

