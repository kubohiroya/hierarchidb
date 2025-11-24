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
 * Create a draft for a new node. The draft lives directly on the node record.
 */
export async function createDraftBase(
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

    // If a fixed ID is provided and the node already exists, reuse it as the draft.
    if (fixedId) {
      const existing = await coreDB.nodes.get(fixedId);
      if (existing) {
        const needsDraft =
          (existing as { draftData?: unknown }).draftData === null ||
          typeof (existing as { draftData?: unknown }).draftData === 'undefined';
        if (needsDraft) {
          await coreDB.nodes.update(fixedId, {
            metadata: {
              ...(existing as { metadata?: TreeNode['metadata'] }).metadata ?? {
                name: resolvedBaseName,
                description: undefined,
                tags: [],
              },
              name: resolvedBaseName,
            },
            draftMetadata: {
              name: resolvedBaseName,
              description: undefined,
              tags: [],
            },
            draftData: {
              ...(existing as { draftData?: Record<string, unknown> | null }).draftData ?? {},
            },
            updatedAt: now,
            lastTouchedAt: now,
          });
        } else {
          await coreDB.nodes.update(fixedId, { lastTouchedAt: now, updatedAt: now });
        }
        return fixedId;
      }
    }

    await coreDB.createNode({
      id: wcNodeId,
      parentId,
      nodeType,
      metadata: {
        name: resolvedBaseName,
        description: undefined,
        tags: [],
      },
      draftMetadata: {
        name: resolvedBaseName,
        description: undefined,
        tags: [],
      },
      data: null,
      draftData: {},
      depth,
      createdAt: now,
      updatedAt: now,
      version: 1,
      lastTouchedAt: now,
    });

    return wcNodeId;
  });
}

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
