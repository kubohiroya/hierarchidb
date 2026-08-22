import type { SubTreeChanges } from '~/components/TreeTable/state/features/subscription.atoms';

export function coalesceBatches(pending: SubTreeChanges[]): SubTreeChanges {
  const added = new Map<string, Record<string, unknown>>();
  const updated = new Map<string, Record<string, unknown>>();
  const removed = new Set<string>();
  const moved = new Map<
    string,
    {
      nodeId: string;
      oldParentId?: string;
      newParentId: string;
      oldIndex?: number;
      newIndex?: number;
    }
  >();

  for (const u of pending) {
    if (u.removed) {
      for (const id of u.removed) {
        added.delete(id);
        updated.delete(id);
        moved.delete(id);
        removed.add(id);
      }
    }
    if (u.added) {
      for (const n of u.added) {
        const id = String(n.id);
        removed.delete(id);
        added.set(id, n as Record<string, unknown>);
      }
    }
    if (u.updated) {
      for (const up of u.updated) {
        if (removed.has(up.nodeId)) continue;
        const prev = updated.get(up.nodeId) || {};
        updated.set(up.nodeId, { ...prev, ...up.changes });
      }
    }
    if (u.moved) {
      for (const mv of u.moved) {
        if (removed.has(mv.nodeId)) continue;
        moved.set(mv.nodeId, mv);
      }
    }
  }

  return {
    added: Array.from(added.entries()).map(([id, v]) => ({ id, ...v })),
    updated: Array.from(updated.entries()).map(([nodeId, changes]) => ({ nodeId, changes })),
    removed: Array.from(removed.values()),
    moved: Array.from(moved.values()),
  };
}
