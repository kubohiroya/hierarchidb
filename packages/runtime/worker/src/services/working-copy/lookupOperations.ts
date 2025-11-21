import { type NodeId, type Timestamp, type TreeNode } from '@hierarchidb/common-types';
import type { CoreDB } from '../CoreDB.js';

export async function getWorkingCopy(
  coreDB: CoreDB,
  nodeId: NodeId
): Promise<TreeNode | undefined> {
  const direct = await coreDB.nodes.get(nodeId);
  if (direct) {
    if (direct.holderType === 'workingCopy') {
      const child = await coreDB.nodes.where('parentId').equals(direct.id).first();
      if (child) {
        return child;
      }
    }

    if (direct.parentId) {
      const parent = await coreDB.nodes.get(direct.parentId);
      if (parent?.holderType === 'workingCopy') {
        return direct;
      }
    }
  }

  const holder = await coreDB.nodes
    .where('[holderType+holderTargetId]')
    .equals(['workingCopy', nodeId])
    .first();
  if (!holder) return undefined;
  const child = await coreDB.nodes.where('parentId').equals(holder.id).first();
  return child ?? undefined;
}

export async function updateWorkingCopy(
  coreDB: CoreDB,
  nodeId: NodeId,
  updates: Partial<TreeNode>
): Promise<void> {
  const existing = await getWorkingCopy(coreDB, nodeId);
  if (!existing) {
    throw new Error('Working copy not found');
  }

  const timestamp = Date.now() as Timestamp;
  const updated: TreeNode = {
    ...existing,
    ...updates,
    updatedAt: timestamp,
    lastTouchedAt: timestamp,
    data: updates.data ?? existing.data ?? null,
    draftData: updates.draftData ?? existing.draftData ?? existing.data ?? null,
  };

  await coreDB.nodes.put(updated);
  if (updated.parentId) {
    await coreDB.nodes.update(updated.parentId, { lastTouchedAt: timestamp });
  }
}

export async function checkWorkingCopyConflict(coreDB: CoreDB, nodeId: NodeId): Promise<boolean> {
  const workingCopy = await getWorkingCopy(coreDB, nodeId);
  if (!workingCopy) {
    return false;
  }

  const currentNode = await coreDB.getNode(nodeId);
  if (!currentNode) {
    return false;
  }

  const originalVersion = workingCopy.version || 1;
  return currentNode.version > originalVersion;
}
