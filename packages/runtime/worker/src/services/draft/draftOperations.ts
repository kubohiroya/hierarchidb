import {
  generateNodeId,
  type NodeId,
  type NodeType,
  type TreeId,
  type TreeNode,
  type Timestamp,
} from '@hierarchidb/common-types';
import type { CoreDB } from '../CoreDB.js';
import { createNewName, getChildNames } from './nameUtilities.js';

/**
 * Initialize a new tree node builder with default metadata (unique name, empty description, empty tags).
 * Draft fields start as null. Returns the node id.
 */
export async function initTreeNode(
  coreDB: CoreDB,
  _treeId: TreeId,
  parentId: NodeId,
  nodeType: NodeType,
  baseName: string,
  fixedId?: NodeId
): Promise<NodeId> {
  return await coreDB.runInTx('rw', ['nodes'], async () => {
    const siblingNames = await getChildNames(coreDB, parentId);
    const resolvedBaseName = createNewName(siblingNames, baseName);
    const wcNodeId = fixedId ?? generateNodeId();
    const now = Date.now() as Timestamp;
    const parent = await coreDB.nodes.get(parentId);
    const depth = typeof parent?.depth === 'number' ? (parent.depth ?? 0) + 1 : 1;

    // If a fixed ID is provided and the node already exists, reuse it.
    if (fixedId) {
      const existing = await coreDB.nodes.get(fixedId);
      if (existing) {
        await coreDB.nodes.update(fixedId, {
          metadata: {
            ...(existing as { metadata?: TreeNode['metadata'] }).metadata ?? {
              name: resolvedBaseName,
              description: '',
              tags: [],
            },
            name: resolvedBaseName,
            description: '',
            tags: [],
          },
          draftMetadata: null,
          draftData: null,
          updatedAt: now,
          lastTouchedAt: now,
        });
        return fixedId;
      }
    }

    await coreDB.createNode({
      id: wcNodeId,
      parentId,
      nodeType,
      metadata: {
        name: resolvedBaseName,
        description: '',
        tags: [],
      },
      draftMetadata: null,
      data: null,
      draftData: null,
      depth,
      createdAt: now,
      updatedAt: now,
      version: 1,
      lastTouchedAt: now,
    });

    return wcNodeId;
  });
}

// Backward-compatible alias
export const createDraftBase = initTreeNode;

export async function touchDraftNodeIds(
  coreDB: CoreDB,
  nodeIds: NodeId[],
  timestamp: Timestamp = Date.now() as Timestamp
): Promise<void> {
  await Promise.all(nodeIds.map((id) => coreDB.nodes.update(id, { lastTouchedAt: timestamp })));
}

export async function touchDraftNode(
  coreDB: CoreDB,
  node: TreeNode,
  timestamp: Timestamp = Date.now() as Timestamp
): Promise<void> {
  await touchDraftNodeIds(coreDB, [node.id], timestamp);
}

export async function touchDraftById(
  coreDB: CoreDB,
  wcNodeId: NodeId,
  timestamp: Timestamp = Date.now() as Timestamp
): Promise<void> {
  await touchDraftNodeIds(coreDB, [wcNodeId], timestamp);
}
