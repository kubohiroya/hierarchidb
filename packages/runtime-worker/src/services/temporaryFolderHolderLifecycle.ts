import type { NodeId, NodeType, Timestamp, TreeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import type { CoreDB } from './CoreDB.js';
import { generateNodeId } from './generateNodeId.js';

export const TEMPORARY_FOLDER_NODE_TYPE = 'temporary-folder' as NodeType;
export const TEMPORARY_FOLDER_NAME = 'Temporary';
export const TEMPORARY_STAGING_NODE_ERROR = 'temporary-staging-node-is-not-draft';

export function getTemporaryFolderNodeId(treeId: TreeId): NodeId {
  return `${treeId}:temporary-folder` as NodeId;
}

export function isTemporaryFolderHolderNode(node: TreeNode | undefined): boolean {
  return node?.nodeType === TEMPORARY_FOLDER_NODE_TYPE;
}

export async function ensureTemporaryFolderHolder(
  coreDB: CoreDB,
  treeId: TreeId = 'r' as TreeId
): Promise<TreeNode> {
  const holderId = getTemporaryFolderNodeId(treeId);
  const existing = await coreDB.getNode(holderId);
  if (existing) {
    assertValidTemporaryHolder(existing, treeId);
    return existing;
  }

  const tree = await coreDB.trees.get(treeId);
  if (!tree) {
    throw new Error('temporary-folder-tree-not-found');
  }

  const now = Date.now() as Timestamp;
  const holder: TreeNode = {
    id: holderId,
    parentId: tree.superRootId,
    nodeType: TEMPORARY_FOLDER_NODE_TYPE,
    depth: 0,
    createdAt: now,
    updatedAt: now,
    version: 1,
    metadata: {
      name: TEMPORARY_FOLDER_NAME,
      description: '',
      tags: [],
    },
    draftMetadata: null,
    data: null,
    draftData: undefined,
    visible: false,
  };
  await coreDB.createNode(holder);
  return holder;
}

export async function createTemporaryCopyStagingRoot(
  coreDB: CoreDB,
  input: {
    treeId?: TreeId;
    sourceNodeId: NodeId;
    stagingRootNodeId?: NodeId;
    name?: string;
  }
): Promise<TreeNode> {
  const treeId = input.treeId ?? ('r' as TreeId);
  const holder = await ensureTemporaryFolderHolder(coreDB, treeId);
  const source = await coreDB.getNode(input.sourceNodeId);
  if (!source) {
    throw new Error('temporary-copy-source-node-not-found');
  }

  const now = Date.now() as Timestamp;
  const stagingRoot: TreeNode = {
    id: input.stagingRootNodeId ?? generateNodeId(),
    parentId: holder.id as NodeId,
    nodeType: source.nodeType,
    depth: holder.depth + 1,
    createdAt: now,
    updatedAt: now,
    version: 1,
    metadata: {
      name: input.name ?? source.metadata.name,
      description: source.metadata.description ?? '',
      tags: [...(source.metadata.tags ?? [])],
    },
    draftMetadata: null,
    data: null,
    draftData: undefined,
    isTemporary: true,
    visible: true,
    references: [source.id as NodeId],
  };

  await coreDB.createNode(stagingRoot);
  await refreshTemporaryFolderVisibility(coreDB, holder.id as NodeId);
  const stored = await coreDB.getNode(stagingRoot.id as NodeId);
  if (!stored) {
    throw new Error('temporary-staging-root-create-failed');
  }
  return stored;
}

export async function cleanupTemporaryStagingRoot(
  coreDB: CoreDB,
  stagingRootNodeId: NodeId
): Promise<void> {
  const stagingRoot = await coreDB.getNode(stagingRootNodeId);
  if (!stagingRoot) {
    return;
  }
  const holder = await coreDB.getNode(stagingRoot.parentId);
  if (!isTemporaryFolderHolderNode(holder)) {
    throw new Error('temporary-staging-root-parent-invalid');
  }

  await deleteSubtree(coreDB, stagingRootNodeId);
  await refreshTemporaryFolderVisibility(coreDB, holder.id as NodeId);
}

export async function refreshTemporaryFolderVisibility(
  coreDB: CoreDB,
  holderId: NodeId
): Promise<TreeNode | undefined> {
  const holder = await coreDB.getNode(holderId);
  if (!isTemporaryFolderHolderNode(holder)) {
    return undefined;
  }

  const children = await coreDB.listChildren(holderId);
  const nextVisible = children.length > 0;
  if (holder.visible !== nextVisible) {
    await coreDB.updateNode({
      id: holderId,
      visible: nextVisible,
      updatedAt: Date.now() as Timestamp,
      version: holder.version + 1,
    });
  }
  return await coreDB.getNode(holderId);
}

export async function isNodeInTemporaryFolderSubtree(
  coreDB: CoreDB,
  nodeId: NodeId
): Promise<boolean> {
  let current = await coreDB.getNode(nodeId);
  const visited = new Set<NodeId>();
  while (current) {
    if (visited.has(current.id as NodeId)) {
      throw new Error('temporary-folder-parent-cycle');
    }
    visited.add(current.id as NodeId);
    if (isTemporaryFolderHolderNode(current)) {
      return true;
    }
    if (!current.parentId || current.parentId === current.id) {
      return false;
    }
    current = await coreDB.getNode(current.parentId);
  }
  return false;
}

export async function assertNodeIsNotTemporaryStagingNode(
  coreDB: CoreDB,
  nodeId: NodeId
): Promise<void> {
  if (await isNodeInTemporaryFolderSubtree(coreDB, nodeId)) {
    throw new Error(TEMPORARY_STAGING_NODE_ERROR);
  }
}

async function deleteSubtree(coreDB: CoreDB, rootId: NodeId): Promise<void> {
  const children = await coreDB.listChildren(rootId);
  for (const child of children) {
    await deleteSubtree(coreDB, child.id as NodeId);
  }
  await coreDB.deleteNode(rootId);
}

function assertValidTemporaryHolder(node: TreeNode, treeId: TreeId): void {
  if (
    node.id !== getTemporaryFolderNodeId(treeId) ||
    node.nodeType !== TEMPORARY_FOLDER_NODE_TYPE ||
    node.parentId !== (`${treeId}:superRoot` as NodeId)
  ) {
    throw new Error('temporary-folder-holder-invalid');
  }
}
