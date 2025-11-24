import type { NodeId, TreeNode, TreeNodeMetadata } from '@hierarchidb/common-types';
import type { CoreDB } from '../CoreDB.js';

// Temporary stub: no conflict detection
export async function checkDraftConflict(_coreDB: CoreDB, _nodeId: NodeId): Promise<boolean> {
  return false;
}

export async function updateTreeNodeDraftMetadata(
  coreDB: CoreDB,
  nodeId: NodeId,
  updater: Partial<TreeNodeMetadata>
): Promise<void> {
  const current = (await coreDB.nodes.get(nodeId)) as TreeNode | undefined;
  const prev = (current as { draftMetadata?: TreeNodeMetadata | null })?.draftMetadata ?? null;
  const next: TreeNodeMetadata = {
    ...(prev ?? { name: '', description: '', tags: [] }),
    ...updater,
  };
  await coreDB.nodes.update(nodeId, { draftMetadata: next } as any);
}

export async function updateTreeNodeDraftData(
  coreDB: CoreDB,
  nodeId: NodeId,
  updater: Record<string, unknown>
): Promise<void> {
  const current = (await coreDB.nodes.get(nodeId)) as TreeNode | undefined;
  const prev = (current as { draftData?: Record<string, unknown> | null })?.draftData ?? {};
  await coreDB.nodes.update(nodeId, {
    draftData: {
      ...prev,
      ...updater,
    },
  } as any);
}

export async function getTreeNode(coreDB: CoreDB, nodeId: NodeId): Promise<TreeNode | null> {
  const node = await coreDB.nodes.get(nodeId);
  return (node ?? null) as TreeNode | null;
}

// Compatibility wrappers
