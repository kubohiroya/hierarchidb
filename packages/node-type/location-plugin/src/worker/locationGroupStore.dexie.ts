import type { NodeId } from '@hierarchidb/common-type';
import type { GroupItemBase, GroupStore } from '@hierarchidb/runtime-worker';
import type { LocationEntitiesDB } from './locationEntitiesDB.js';
import type { LocationGroupItemData } from '../types/entities.js';
import { fromGroupRow, toGroupRow } from './normalizers.js';

type Item = GroupItemBase<LocationGroupItemData>;

export function createLocationGroupStoreDexie(db: LocationEntitiesDB): GroupStore<Item> {
  return {
    async list(nodeId: NodeId) {
      const rows = await db.groupEntities.where('nodeId').equals(nodeId).toArray();
      return fromGroupRow(rows);
    },
    async bulkUpsert(nodeId: NodeId, items: Item[]) {
      const now = Date.now();
      const rows = items.map((item) => toGroupRow(nodeId, item, now));
      await db.groupEntities.bulkPut(rows);
    },
    async bulkDelete(nodeId: NodeId, itemIds: string[]) {
      await db.transaction('rw', db.groupEntities, async () => {
        for (const id of itemIds) await db.groupEntities.delete([nodeId, id]);
      });
    },
  };
}
