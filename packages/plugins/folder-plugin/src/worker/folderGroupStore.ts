import type { NodeId } from '@hierarchidb/common-types';
import type { GroupItemBase, GroupStore } from '@hierarchidb/runtime-worker';

// Development-only in-memory GroupStore for the folder plugin.
// Replace with Dexie-backed implementation in production.
type Item = GroupItemBase<{ value?: unknown }>;
const mem = new Map<string, Item[]>(); // key: nodeId

const toKey = (nodeId: NodeId): string => String(nodeId);

export const folderGroupStore: GroupStore<Item> = {
  async list(nodeId: NodeId) {
    const key = toKey(nodeId);
    return (mem.get(key) || []).slice();
  },
  async bulkUpsert(nodeId: NodeId, items: Item[]) {
    const key = toKey(nodeId);
    const currentItems = mem.get(key) || [];
    const byId = new Map(currentItems.map((item) => [item.id, item] as const));
    const now = Date.now();
    for (const item of items) {
      byId.set(item.id, { ...item, updatedAt: now });
    }
    mem.set(key, Array.from(byId.values()));
  },
  async bulkDelete(nodeId: NodeId, itemIds: string[]) {
    const key = toKey(nodeId);
    const currentItems = mem.get(key) || [];
    const nextItems = currentItems.filter((item) => !itemIds.includes(item.id));
    mem.set(key, nextItems);
  },
};

export function __clearFolderGroupStore() {
  mem.clear();
}
