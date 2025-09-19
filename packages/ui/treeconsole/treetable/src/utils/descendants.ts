import type { NodeId, TreeNode } from '@hierarchidb/common-type';

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

