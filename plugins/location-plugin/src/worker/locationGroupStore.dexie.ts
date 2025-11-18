import type { NodeId } from '@hierarchidb/common-types';
import type { GroupItemBase, GroupStore } from '@hierarchidb/runtime-worker';
import type { LocationEntitiesDB } from './locationEntitiesDB.js';
import type { LocationGroupItemData } from '../common/types/entities.js';
import { fromGroupRow, toGroupRow } from './normalizers.js';

type Item = GroupItemBase<LocationGroupItemData>;

export function createLocationGroupStoreDexie(db: LocationEntitiesDB): GroupStore<Item> {
  const store = {
    async list(nodeId: NodeId): Promise<Item[]> {
      const rows = await db.groupEntities.where('nodeId').equals(nodeId).toArray();
      return fromGroupRow(rows);
    },
    async bulkUpsert(nodeId: NodeId, items: Item[]): Promise<void> {
      const now = Date.now();
      const rows = items.map((item) => toGroupRow(nodeId, item, now));
      await db.groupEntities.bulkPut(rows);
    },
    async bulkDelete(nodeId: NodeId, itemIds: string[]): Promise<void> {
      await db.transaction('rw', db.groupEntities, async () => {
        for (const id of itemIds) await db.groupEntities.delete([nodeId, id]);
      });
    },
  };
  return store as GroupStore<Item>;
}
