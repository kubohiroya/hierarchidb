import { type NodeId, type Timestamp, type TreeNode } from '@hierarchidb/common-types';
import type { CoreDB } from '../CoreDB.js';

export async function getDraft(coreDB: CoreDB, nodeId: NodeId): Promise<TreeNode | undefined> {
  const node = await coreDB.nodes.get(nodeId);
  if (!node) return undefined;
  if (node.draftData === null || node.draftData === undefined) return undefined;
  return node as TreeNode;
}

export async function updateDraft(
  coreDB: CoreDB,
  nodeId: NodeId,
  updates: Partial<TreeNode>
): Promise<void> {
  const existing = await getDraft(coreDB, nodeId);
  if (!existing) {
    throw new Error('Draft not found');
  }

  const timestamp = Date.now() as Timestamp;
  const nextDraftData =
    updates.draftData ??
    (updates.data as TreeNode['draftData'] | undefined) ??
    existing.draftData ??
    existing.data ??
    null;
  const nextDraftMetadata =
    updates.draftMetadata ??
    existing.draftMetadata ??
    existing.metadata ??
    null;

  const updated: TreeNode = {
    ...existing,
    ...updates,
    updatedAt: timestamp,
    lastTouchedAt: timestamp,
    data: existing.data ?? null,
    draftData: nextDraftData,
    metadata: existing.metadata,
    draftMetadata: nextDraftMetadata,
  };

  await coreDB.nodes.put(updated);
}

export async function checkDraftConflict(coreDB: CoreDB, nodeId: NodeId): Promise<boolean> {
  const draft = await getDraft(coreDB, nodeId);
  if (!draft) {
    return false;
  }

  const currentNode = await coreDB.getNode(nodeId);
  if (!currentNode) {
    return false;
  }

  const originalVersion = draft.version || 1;
  return currentNode.version > originalVersion;
}
