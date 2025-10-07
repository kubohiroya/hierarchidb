/**
 * Tests for trash breadcrumb normalisation utilities.
 *
 * Location: app/src/components/trash/__tests__/buildTrashBreadcrumbs.test.ts
 * Purpose: validate that breadcrumbs prefer preserved names and remain stable when metadata is missing.
 */
import { describe, expect, it } from 'vitest';
import type { NodeId, TreeNode } from '@hierarchidb/common-types';
import { buildTrashBreadcrumbs } from '../buildTrashBreadcrumbs.js';

function createNode(
  id: string,
  overrides: Partial<TreeNode> & { parentId?: NodeId; depth?: number } = {},
): TreeNode {
  const nodeId = id as NodeId;
  const parentId = overrides.parentId ?? ('parent-' + id) as NodeId;
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

describe('buildTrashBreadcrumbs', () => {
  const trashRoot = createNode('r:trash', {
    parentId: 'r:root' as NodeId,
    nodeType: 'trash' as TreeNode['nodeType'],
    depth: 0,
    name: 'Trash',
  });

  it('prefers originalName metadata when available', () => {
    const trashedNode = createNode('node-a', {
      parentId: trashRoot.id,
      originalName: 'Original A',
      originalParentId: 'r:root' as NodeId,
    });

    const nodeMap = new Map<string, TreeNode>([
      [String(trashRoot.id), trashRoot],
      [String(trashedNode.id), trashedNode],
    ]);

    const breadcrumbs = buildTrashBreadcrumbs({
      treeId: 'r',
      rootNode: trashRoot,
      targetNodeId: trashedNode.id,
      nodeMap,
    });

    expect(breadcrumbs).toHaveLength(2);
    const [, target] = breadcrumbs;
    expect(target?.name).toBe('Original A');
    expect(target?.holderType).toBe('trash');
    expect(target?.holderTargetId).toBe(String(trashedNode.id));
  });

  it('falls back to current name when original metadata is missing', () => {
    const trashedNode = createNode('node-b', {
      parentId: trashRoot.id,
      originalName: undefined,
      name: 'Live Name B',
    });

    const nodeMap = new Map<string, TreeNode>([
      [String(trashRoot.id), trashRoot],
      [String(trashedNode.id), trashedNode],
    ]);

    const breadcrumbs = buildTrashBreadcrumbs({
      treeId: 'r',
      rootNode: trashRoot,
      targetNodeId: trashedNode.id,
      nodeMap,
    });

    expect(breadcrumbs).toHaveLength(2);
    const [, target] = breadcrumbs;
    expect(target?.name).toBe('Live Name B');
  });
});

