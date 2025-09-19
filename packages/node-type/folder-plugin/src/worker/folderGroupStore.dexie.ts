import type { NodeId } from '@hierarchidb/common-type';
import type { GroupItemBase, GroupStore } from '@hierarchidb/runtime-worker';
import type { FolderEntitiesDB, FolderGroupRow } from './folderEntitiesDB.js';

type Item = GroupItemBase<{ value?: unknown }>

export function createFolderGroupStoreDexie(db: FolderEntitiesDB): GroupStore<Item> {
  return {
    async list(nodeId: NodeId) {
      return (await db.groupEntities.where('nodeId').equals(nodeId).toArray()) as any;
    },
    async bulkUpsert(nodeId: NodeId, items: Item[]) {
      const rows: FolderGroupRow[] = items.map((it) => ({ ...it, nodeId, updatedAt: Date.now() }));
      await db.groupEntities.bulkPut(rows);
    },
    async bulkDelete(nodeId: NodeId, itemIds: string[]) {
      // delete one by one using composite key
      await db.transaction('rw', db.groupEntities, async () => {
        for (const id of itemIds) await db.groupEntities.delete([nodeId, id] as any);
      });
    },
  };
}
