import type { NodeId, Timestamp } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import type { CoreDB } from './CoreDB.js';
import { generateNodeId } from './generateNodeId.js';

export async function createCopyOnWriteSubtree(
  coreDB: CoreDB,
  input: CreateCopyOnWriteSubtreeInput
): Promise<TreeNode> {
  const sourceRoot = await coreDB.getNode(input.sourceNodeId);
  if (!sourceRoot) {
    throw new Error('copy-on-write-source-node-not-found');
  }
  const targetParent = await coreDB.getNode(input.targetParentNodeId);
  if (!targetParent) {
    throw new Error('copy-on-write-target-parent-not-found');
  }
  const subtreeNodes = await buildCopyOnWriteSubtreeNodes(coreDB, {
    sourceRoot,
    targetParent,
    stagingRootNodeId: input.stagingRootNodeId,
    rootNameOverride: input.rootNameOverride,
    isTemporary: input.isTemporary,
  });

  await coreDB.runInTx('rw', ['nodes'], async () => {
    await coreDB.bulkCreateNodes(subtreeNodes);
  });

  const root = subtreeNodes[0];
  if (!root) {
    throw new Error('copy-on-write-staging-root-create-failed');
  }
  const stored = await coreDB.getNode(root.id as NodeId);
  if (!stored) {
    throw new Error('copy-on-write-staging-root-create-failed');
  }
  return stored;
}

export interface CreateCopyOnWriteSubtreeInput {
  sourceNodeId: NodeId;
  targetParentNodeId: NodeId;
  stagingRootNodeId?: NodeId;
  rootNameOverride?: string;
  isTemporary?: boolean;
}

async function buildCopyOnWriteSubtreeNodes(
  coreDB: CoreDB,
  input: {
    sourceRoot: TreeNode;
    targetParent: TreeNode;
    stagingRootNodeId?: NodeId;
    rootNameOverride?: string;
    isTemporary?: boolean;
  }
): Promise<TreeNode[]> {
  const now = Date.now() as Timestamp;
  const nodes: TreeNode[] = [];
  const newIdsBySourceId = new Map<NodeId, NodeId>();
  const newDepthsBySourceId = new Map<NodeId, number>();

  const collect = async (source: TreeNode, parent: TreeNode | undefined): Promise<void> => {
    const sourceId = source.id as NodeId;
    const newId =
      parent === undefined && input.stagingRootNodeId !== undefined
        ? input.stagingRootNodeId
        : generateNodeId();
    newIdsBySourceId.set(sourceId, newId);

    const parentId =
      parent === undefined
        ? (input.targetParent.id as NodeId)
        : (newIdsBySourceId.get(parent.id as NodeId) as NodeId | undefined);
    if (parentId === undefined) {
      throw new Error('copy-on-write-parent-map-missing');
    }

    const parentDepth =
      parent === undefined
        ? input.targetParent.depth
        : (newDepthsBySourceId.get(parent.id as NodeId) as number | undefined);
    if (parentDepth === undefined) {
      throw new Error('copy-on-write-parent-depth-missing');
    }
    const depth = parentDepth + 1;
    newDepthsBySourceId.set(sourceId, depth);
    const references = new Set<NodeId>(source.references ?? []);
    references.add(sourceId);

    nodes.push({
      id: newId,
      parentId,
      nodeType: source.nodeType,
      depth,
      createdAt: now,
      updatedAt: now,
      version: 1,
      metadata: {
        name:
          parent === undefined && input.rootNameOverride !== undefined
            ? input.rootNameOverride
            : source.metadata.name,
        description: source.metadata.description ?? '',
        tags: [...(source.metadata.tags ?? [])],
        ...(source.metadata.buildMetadata === undefined
          ? {}
          : { buildMetadata: { ...source.metadata.buildMetadata } }),
      },
      draftMetadata: null,
      data: null,
      draftData: undefined,
      ...(input.isTemporary === undefined ? {} : { isTemporary: input.isTemporary }),
      visible: source.visible,
      references: [...references],
      copyOnWriteOf: sourceId,
    });

    const children = await coreDB.listChildren(sourceId);
    for (const child of children) {
      await collect(child, source);
    }
  };

  await collect(input.sourceRoot, undefined);
  return nodes;
}
