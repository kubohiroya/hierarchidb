import type { NodeId, TreeNode } from '@hierarchidb/common-types';
import { describe, expect, it } from 'vitest';
import { buildTrashTreeData } from '../../buildTrashTreeData.js';

function createNode(
  id: string,
  overrides: Partial<TreeNode> & {
    parentId?: NodeId;
    depth?: number;
    name?: string;
    description?: string;
  } = {}
): TreeNode {
  const nodeId = id as NodeId;
  const parentId = overrides.parentId ?? (`parent-${id}` as NodeId);
  const now = Date.now();

  return {
    id: nodeId,
    parentId,
    nodeType: (overrides.nodeType ?? 'folder') as TreeNode['nodeType'],
    metadata: {
      name: overrides.name ?? `Node ${id}`,
      description: overrides.description ?? '',
      tags: [],
    },
    draftMetadata: null,
    depth: overrides.depth ?? 0,
    visible: overrides.visible ?? true,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    version: overrides.version ?? 1,
    hasChildren: overrides.hasChildren,
    originalName: overrides.originalName,
    originalParentId: overrides.originalParentId,
    removedAt: overrides.removedAt,
    data: overrides.data ?? {},
    draftData: overrides.draftData ?? null,
  } satisfies TreeNode;
}

describe('buildTrashTreeData', () => {
  const root = createNode('trash-root', { parentId: 'console-root' as NodeId, depth: 0 });

  it('prefers original metadata and marks entries as trash', () => {
    const trashedParent = createNode('leaf-1', {
      parentId: root.id as NodeId,
      depth: 1,
      hasChildren: true,
      originalName: 'Original Leaf 1',
      originalParentId: 'r:root' as NodeId,
      removedAt: Date.now(),
    });
    const child = createNode('leaf-1-child', {
      parentId: trashedParent.id as NodeId,
      depth: 2,
      hasChildren: false,
    });

    const nodeMap = new Map<string, TreeNode>([
      [root.id, root],
      [trashedParent.id, trashedParent],
      [child.id, child],
    ]);

    const { nodes, rootId } = buildTrashTreeData({
      treeId: 'r',
      rootNode: root,
      nodeMap,
    });

    expect(rootId).toBe(String(root.id));
    expect(nodes).toHaveLength(2);

    const parentEntry = nodes.find((node) => node.id === trashedParent.id);
    expect(parentEntry?.metadata?.name).toBe('Original Leaf 1');
  });

  it('falls back to current metadata when original fields are absent', () => {
    const orphan = createNode('leaf-2', {
      parentId: root.id as NodeId,
      depth: 1,
      hasChildren: false,
      originalName: undefined,
      originalParentId: undefined,
    });

    const nodeMap = new Map<string, TreeNode>([
      [root.id, root],
      [orphan.id, orphan],
    ]);

    const { nodes } = buildTrashTreeData({
      treeId: 'r',
      rootNode: root,
      nodeMap,
    });

    expect(nodes).toHaveLength(1);
    const entry = nodes[0];
    expect(entry?.id).toBe(orphan.id);
    expect(entry?.metadata?.name).toBe(`Node ${orphan.id}`);
  });
});
