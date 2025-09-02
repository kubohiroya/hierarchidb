import type { NodeId } from '@hierarchidb/common-type';
import type { GroupItemBase, GroupStore } from '@hierarchidb/runtime-worker/entity/store';
import type { LocationEntitiesDB, LocationGroupRow } from './locationEntitiesDB';
import type { LocationGroupItemData } from '../types/entities';

type Item = GroupItemBase<LocationGroupItemData>;

export function createLocationGroupStoreDexie(db: LocationEntitiesDB): GroupStore<Item> {
  return {
    async list(nodeId: NodeId) { return (await db.groupEntities.where('nodeId').equals(nodeId).toArray()) as any; },
    async bulkUpsert(nodeId: NodeId, items: Item[]) { await db.groupEntities.bulkPut(items.map((i) => ({ ...i, nodeId, updatedAt: Date.now() })) as LocationGroupRow[]); },
    async bulkDelete(nodeId: NodeId, itemIds: string[]) { await db.transaction('rw', db.groupEntities, async () => { for (const id of itemIds) await db.groupEntities.delete([nodeId, id] as any); }); },
  };
}

