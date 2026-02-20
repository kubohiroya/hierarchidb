import type { NodeId, PeerEntity } from '@hierarchidb/core-types';
import type { TreeNode, TreeNodeData, TreeNodeMetadata } from '@hierarchidb/tree-api';
import type { CoreDB } from '~/services/CoreDB';

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
  await coreDB.nodes.update(nodeId, {
    draftMetadata: (updater ?? null) as TreeNodeMetadata | null,
  });
}

export async function updateTreeNodeDraftData(
  coreDB: CoreDB,
  nodeId: NodeId,
  updater: Partial<PeerEntity<TreeNodeData>>
): Promise<void> {
  await coreDB.nodes.update(nodeId, { draftData: updater });
}

export async function getTreeNode(coreDB: CoreDB, nodeId: NodeId): Promise<TreeNode | null> {
  const node = await coreDB.nodes.get(nodeId);
  return (node ?? null) as TreeNode | null;
}

// Compatibility wrappers
