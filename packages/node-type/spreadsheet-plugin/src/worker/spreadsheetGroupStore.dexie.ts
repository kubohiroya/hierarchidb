import type { NodeId } from '@hierarchidb/common-type';
import type { GroupItemBase, GroupStore } from '@hierarchidb/runtime-worker';
import type { SheetGroupRow, SpreadsheetEntitiesDB } from './spreadsheetEntitiesDB.js';
import type { SpreadsheetGroupItemData } from '../types/entities.js';

type Item = GroupItemBase<SpreadsheetGroupItemData>;

export function createSpreadsheetGroupStoreDexie(db: SpreadsheetEntitiesDB): GroupStore<Item> {
  return {
    async list(nodeId: NodeId) {
      const rows = await db.groupEntities.where('nodeId').equals(nodeId).toArray();
      return rows.map((row) => ({
        id: row.id,
        data: row.data,
        updatedAt: row.updatedAt,
      }));
    },
    async bulkUpsert(nodeId: NodeId, items: Item[]) {
      const rows: SheetGroupRow[] = items.map((item) => ({
        nodeId,
        id: item.id,
        data: item.data,
        updatedAt: item.updatedAt ?? Date.now(),
      }));
      await db.groupEntities.bulkPut(rows);
    },
    async bulkDelete(nodeId: NodeId, itemIds: string[]) {
      await db.transaction('rw', db.groupEntities, async () => {
        for (const id of itemIds) {
          const key: [NodeId, string] = [nodeId, id];
          await db.groupEntities.delete(key);
        }
      });
    },
  };
}
