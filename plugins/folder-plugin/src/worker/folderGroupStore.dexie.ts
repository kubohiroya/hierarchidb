import type { NodeId } from '@hierarchidb/common-types';
import type { GroupItemBase, GroupStore } from '@hierarchidb/runtime-worker';
import type { FolderEntitiesDB, FolderGroupRow } from './folderEntitiesDB.ts';

type Item = GroupItemBase<{ value?: unknown }>;

export function createFolderGroupStoreDexie(db: FolderEntitiesDB): GroupStore<Item> {
  return {
    async list(nodeId: NodeId) {
      const rows = await db.groupEntities.where('nodeId').equals(nodeId).toArray();
      return rows.map<Item>((row) => {
        const data = typeof row.data === 'object' && row.data !== null ? (row.data as Item['data']) : undefined;
        return {
        id: row.id,
        data,
        updatedAt: row.updatedAt,
        };
      });
    },
    async bulkUpsert(nodeId: NodeId, items: Item[]) {
      const rows: FolderGroupRow[] = items.map((it) => ({ ...it, nodeId, updatedAt: Date.now() }));
      await db.groupEntities.bulkPut(rows);
    },
    async bulkDelete(nodeId: NodeId, itemIds: string[]) {
      // delete one by one using composite key
      await db.transaction('rw', db.groupEntities, async () => {
        for (const id of itemIds) {
          const key: [NodeId, string] = [nodeId, id];
          await db.groupEntities.delete(key);
        }
      });
    },
  };
}
