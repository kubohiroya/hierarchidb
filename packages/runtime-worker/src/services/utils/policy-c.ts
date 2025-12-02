import type { NodeId, TreeNode } from '@hierarchidb/common-types';
import type { CoreDB } from '../CoreDB.js';

export async function collectSubtreeIds(coreDB: CoreDB, rootId: NodeId): Promise<Set<NodeId>> {
  const ids = new Set<NodeId>();
  const queue: NodeId[] = [rootId];
  while (queue.length) {
    const id = queue.shift();
    if (!id) {
      continue;
    }
    if (ids.has(id)) continue;
    ids.add(id);
    const children: TreeNode[] = (await coreDB.listChildren?.(id)) ?? [];
    for (const c of children) queue.push(c.id);
  }
  return ids;
}

export async function hasDraftInSubtree(coreDB: CoreDB, rootId: NodeId): Promise<boolean> {
  // In the draftData model, a draft is the node itself with draftData present.
  const nodesTable = coreDB.nodes;
  if (!nodesTable || typeof nodesTable.toArray !== 'function') return false;
  const all = (await nodesTable.toArray()) as TreeNode[] | undefined;
  if (!Array.isArray(all)) return false;

  // Limit check to subtree ids
  const subtree = await collectSubtreeIds(coreDB, rootId);
  return all.some(
    (n) =>
      (n.draftData !== null && n.draftData !== undefined) &&
      subtree.has(n.id as NodeId)
  );
}
