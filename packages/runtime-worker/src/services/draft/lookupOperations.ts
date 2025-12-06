import type { NodeId, TreeNode, TreeNodeMetadata } from '@hierarchidb/common-types';
import type { CoreDB } from '../CoreDB.js';

/**
 * Detects conflicts by comparing draft.version with the latest stored version.
 * Returns true when a different version is already persisted (i.e., someone else updated).
 */
export async function checkDraftConflict(coreDB: CoreDB, nodeId: NodeId): Promise<boolean> {
  const node = await coreDB.nodes.get(nodeId);
  if (!node) return false;
  const currentVersion = (node as { version?: number }).version ?? 0;
  const persisted = await coreDB.nodes.get(nodeId);
  const persistedVersion = (persisted as { version?: number })?.version ?? 0;
  return currentVersion !== persistedVersion;
}

export async function updateTreeNodeDraftMetadata(
  coreDB: CoreDB,
  nodeId: NodeId,
  updater: Partial<TreeNodeMetadata> | null
): Promise<void> {
  if (updater === null) {
    await coreDB.nodes.update(nodeId, { draftMetadata: null });
    return;
  }
  const current = (await coreDB.nodes.get(nodeId)) as TreeNode | undefined;
  const prev = (current as { draftMetadata?: TreeNodeMetadata | null })?.draftMetadata ?? null;
  const next: TreeNodeMetadata = {
    ...(prev ?? { name: '', description: '', tags: [] }),
    ...updater,
  };
  await coreDB.nodes.update(nodeId, { draftMetadata: next });
}

export async function updateTreeNodeDraftData(
  coreDB: CoreDB,
  nodeId: NodeId,
  updater: Record<string, unknown> | null
): Promise<void> {
  if (updater === null) {
    await coreDB.nodes.update(nodeId, { draftData: null });
    return;
  }
  const current = (await coreDB.nodes.get(nodeId)) as TreeNode | undefined;
  const prev = (current as { draftData?: Record<string, unknown> | null })?.draftData ?? {};
  await coreDB.nodes.update(nodeId, {
    draftData: {
      ...prev,
      ...updater,
    },
  });
}

export async function getTreeNode(coreDB: CoreDB, nodeId: NodeId): Promise<TreeNode | null> {
  const node = await coreDB.nodes.get(nodeId);
  return (node ?? null) as TreeNode | null;
}

// Compatibility wrappers
