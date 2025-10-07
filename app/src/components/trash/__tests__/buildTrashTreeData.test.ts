import { describe, expect, it } from 'vitest';
import type { NodeId, TreeNode } from '@hierarchidb/common-types';
import { buildTrashTreeData } from '../buildTrashTreeData.js';

function createNode(
  id: string,
  overrides: Partial<TreeNode> & { parentId?: NodeId; depth?: number } = {},
): TreeNode {
  const nodeId = id as NodeId;
  const parentId = overrides.parentId ?? (`parent-${id}` as NodeId);
  const now = Date.now();

  return {
    id: nodeId,
    parentId,
    nodeType: (overrides.nodeType ?? 'folder') as TreeNode['nodeType'],
    name: overrides.name ?? `Node ${id}`,
    depth: overrides.depth ?? 0,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    version: overrides.version ?? 1,
    holderType: overrides.holderType,
    holderTargetId: overrides.holderTargetId,
    holderMetaParentId: overrides.holderMetaParentId,
    hasChildren: overrides.hasChildren,
    description: overrides.description,
    originalName: overrides.originalName,
    originalParentId: overrides.originalParentId,
    removedAt: overrides.removedAt,
  } satisfies TreeNode;
}

describe('buildTrashTreeData', () => {
  const root = createNode('trash-root', { parentId: 'tree-root' as NodeId, depth: 0 });

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
    expect(parentEntry?.name).toBe('Original Leaf 1');
    expect(parentEntry?.holderType).toBe('trash');
    expect(parentEntry?.holderTargetId).toBe(trashedParent.id);
    expect(parentEntry?.holderMetaParentId).toBe('r:root');
    expect(parentEntry?.parentId).toBe(root.id);
    expect(parentEntry?.hasChildren).toBe(true);
    expect(parentEntry?.removedAt).toBeDefined();
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
    expect(entry?.name).toBe(`Node ${orphan.id}`);
    expect(entry?.holderMetaParentId).toBeUndefined();
    expect(entry?.parentId).toBe(root.id);
  });
});
