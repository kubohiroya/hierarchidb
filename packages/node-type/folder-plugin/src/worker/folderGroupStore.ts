import type { NodeId } from '@hierarchidb/common-type';
import type { GroupItemBase, GroupStore } from '@hierarchidb/runtime-worker/entity/store';

// Development-only in-memory GroupStore for the folder plugin.
// Replace with Dexie-backed implementation in production.
type Item = GroupItemBase<{ value?: unknown }>;
const mem = new Map<string, Item[]>(); // key: nodeId

export const folderGroupStore: GroupStore<Item> = {
  async list(nodeId: NodeId) {
    return (mem.get(nodeId as any) || []).slice();
  },
  async bulkUpsert(nodeId: NodeId, items: Item[]) {
    const cur = mem.get(nodeId as any) || [];
    const byId = new Map(cur.map((i) => [i.id, i] as const));
    const now = Date.now();
    for (const it of items) byId.set(it.id, { ...it, updatedAt: now });
    mem.set(nodeId as any, Array.from(byId.values()));
  },
  async bulkDelete(nodeId: NodeId, itemIds: string[]) {
    const cur = mem.get(nodeId as any) || [];
    const next = cur.filter((i) => !itemIds.includes(i.id));
    mem.set(nodeId as any, next);
  },
};

export function __clearFolderGroupStore() {
  mem.clear();
}

