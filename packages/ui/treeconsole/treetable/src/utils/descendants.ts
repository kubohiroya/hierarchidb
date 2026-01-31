import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';

/**
 * Compute descendants (including self) of a node from a flat TreeNode array.
 * Returns a Set<NodeId>.
 */
export function computeDescendants(data: readonly TreeNode[], startId: NodeId): Set<NodeId> {
  const byParent = new Map<NodeId, NodeId[]>();
  for (const n of data) {
    const pid = n.parentId as NodeId | undefined;
    if (!pid) continue;
    const arr = byParent.get(pid) || [];
    arr.push(n.id as NodeId);
    byParent.set(pid, arr);
  }
  const out = new Set<NodeId>();
  const stack: NodeId[] = [startId];
  while (stack.length) {
    const cur = stack.pop() as NodeId;
    if (out.has(cur)) continue;
    out.add(cur);
    const children = byParent.get(cur) || [];
    for (const c of children) stack.push(c);
  }
  return out;
}

export function collectDescendantIdList(data: readonly TreeNode[], startId: NodeId): string[] {
  const descendants = computeDescendants(data, startId);
  if (descendants.size === 0) {
    return [String(startId)];
  }
  const ids = new Set<string>();
  descendants.forEach((id) => {
    if (id === null || id === undefined) return;
    ids.add(String(id));
  });
  if (!ids.size) {
    ids.add(String(startId));
  }
  return Array.from(ids);
}
