import type { CoreDB } from '../CoreDB';
import type { NodeId, TreeNode } from '@hierarchidb/common-type';
import { decodeWorkingCopyHolderName } from './holder-encoding';

export async function collectSubtreeIds(coreDB: CoreDB, rootId: NodeId): Promise<Set<NodeId>> {
  const ids = new Set<NodeId>();
  const queue: NodeId[] = [rootId];
  while (queue.length) {
    const id = queue.shift()!;
    if (ids.has(id)) continue;
    ids.add(id);
    const children: TreeNode[] = (await (coreDB.listChildren?.(id))!) || [];
    for (const c of children) queue.push(c.id);
  }
  return ids;
}

export async function hasWorkingCopyInSubtree(coreDB: CoreDB, rootId: NodeId): Promise<boolean> {
  // Collect subtree ids
  const subtree = await collectSubtreeIds(coreDB, rootId);

  // Optimization: use workingCopy root IDs from trees table if available,
  // then query holders via parentId index (anyOf).
  const treeRows: Array<{ workingCopyRootId: NodeId }> | undefined = await (coreDB.trees as any)
    ?.toArray?.()
    .catch?.(() => undefined);

  if (Array.isArray(treeRows) && treeRows.length > 0) {
    const wcRootIds = treeRows.map((t) => t.workingCopyRootId).filter(Boolean) as NodeId[];
    if (wcRootIds.length > 0) {
      const holders = (await (coreDB.nodes as any)
        .where?.('parentId')
        .anyOf?.(wcRootIds)
        .toArray?.()) as any[] | undefined;
      if (Array.isArray(holders)) {
        for (const h of holders) {
          try {
            const { targetParentNodeId, targetNodeId } = decodeWorkingCopyHolderName(h.name);
            if (subtree.has(targetNodeId) || subtree.has(targetParentNodeId)) return true;
          } catch {
            // ignore malformed
          }
        }
        return false;
      }
    }
  }

  // Fallback: full scan (older behavior)
  const all = (await (coreDB.nodes as any).toArray?.()) as any[] | undefined;
  if (!Array.isArray(all)) return false;
  const holders = all.filter((n) => typeof n?.parentId === 'string' && (n.parentId as string).endsWith(':workingCopy'));
  for (const h of holders) {
    try {
      const { targetParentNodeId, targetNodeId } = decodeWorkingCopyHolderName(h.name);
      if (subtree.has(targetNodeId) || subtree.has(targetParentNodeId)) return true;
    } catch {
      // ignore malformed
    }
  }
  return false;
}
