import type { NodeId, NodeType, Timestamp, TreeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import type { CoreDB } from '~/services/CoreDB';
import { generateNodeId } from '~/services/generateNodeId';
import { createNewName, getChildNames } from './nameUtils.js';

/**
 * Initialize a draft TreeNode (TreeNodeUpdater) for creation.
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
        if (typeof initial?.isTemporary === 'boolean') {
          await coreDB.nodes.update(fixedId, { isTemporary: initial.isTemporary });
        }
        const hasDraftMeta =
          (existing as { draftMetadata?: unknown }).draftMetadata !== null &&
          typeof (existing as { draftMetadata?: unknown }).draftMetadata !== 'undefined';
        const hasDraftData = typeof (existing as { draftData?: unknown }).draftData !== 'undefined';

        if (!hasDraftMeta || !hasDraftData) {
          const nextDraftMetadata = hasDraftMeta
            ? ((existing as { draftMetadata?: TreeNode['metadata'] }).draftMetadata ?? null)
            : ((existing as { metadata?: TreeNode['metadata'] }).metadata ?? null);

          await coreDB.nodes.update(fixedId, {
            metadata: {
              ...((existing as { metadata?: TreeNode['metadata'] }).metadata ?? {
                name: resolvedBaseName,
                description: '',
                tags: [],
              }),
              name: resolvedBaseName,
            },
            draftMetadata: nextDraftMetadata ?? {
              name: resolvedBaseName,
              description: '',
              tags: [],
              ...(initial?.draftMetadata ?? initial?.metadata ?? {}),
            },
            draftData: {
              ...(hasDraftData
                ? ((existing as { draftData?: Record<string, unknown> }).draftData ?? {})
                : (initial?.draftData ?? {})),
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
      description: initialMeta.description ?? '',
      tags: Array.isArray(initialMeta.tags) ? initialMeta.tags : [],
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
        description: '',
        tags: [],
        ...(initial?.draftMetadata ?? initial?.metadata ?? {}),
      },
      data: null,
      draftData: {
        ...(initial?.draftData ?? {}),
      },
      isTemporary: initial?.isTemporary,
      depth,
      visible: true,
      createdAt: now,
      updatedAt: now,
      version: 0,
      lastTouchedAt: now,
    });

    return wcNodeId;
  });
}
