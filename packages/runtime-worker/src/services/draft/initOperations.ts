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
  * Initialize a working-copy TreeNode for creation.
  * - Ensures sibling name uniqueness.
  * - Seeds metadata/draftMetadata with name/description/tags defaults.
  * - Seeds draftData with provided payload or an empty object.
  */
export async function initTreeNode(
  coreDB: CoreDB,
  _treeId: TreeId,
  parentId: NodeId,
  nodeType: NodeType,
  baseName: string,
  fixedId?: NodeId,
  initial?: Partial<TreeNode>
): Promise<NodeId> {
  return await coreDB.runInTx('rw', ['nodes'], async () => {
    const siblingNames = await getChildNames(coreDB, parentId);
    const resolvedBaseName = createNewName(siblingNames, baseName);
    const wcNodeId = fixedId ?? generateNodeId();
    const now = Date.now() as Timestamp;
    const parent = await coreDB.nodes.get(parentId);
    const depth = typeof parent?.depth === 'number' ? (parent.depth ?? 0) + 1 : 1;

    // When fixedId is provided and the node already exists, reuse it as the draft.
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
              ...(initial?.draftMetadata ?? initial?.metadata ?? {}),
            },
            draftData: {
              ...(initial?.draftData ?? initial?.data ?? {}),
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

    const initialMeta = (initial?.metadata ?? {}) as Partial<TreeNode['metadata']>;
    const metadata = {
      description: initialMeta.description ?? undefined,
      tags: initialMeta.tags ?? [],
      ...initialMeta,
      name: initialMeta.name ?? resolvedBaseName,
    };

    await coreDB.createNode({
      id: wcNodeId,
      parentId,
      nodeType,
      metadata,
      draftMetadata: {
        name: resolvedBaseName,
        description: undefined,
        tags: [],
        ...(initial?.draftMetadata ?? initial?.metadata ?? {}),
      },
      data: null,
      draftData: {
        ...(initial?.draftData ?? initial?.data ?? {}),
      },
      depth,
      createdAt: now,
      updatedAt: now,
      version: 1,
      lastTouchedAt: now,
    });

    return wcNodeId;
  });
}
