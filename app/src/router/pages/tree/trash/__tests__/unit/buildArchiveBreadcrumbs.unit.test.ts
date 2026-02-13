/**
 * Tests for trash breadcrumb normalisation utilities.
 */

import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { describe, expect, it } from 'vitest';
import { buildArchiveBreadcrumbs } from '../../buildArchiveBreadcrumbs.js';

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
    metadata: overrides.metadata ?? {
      name: overrides.name ?? `Node ${id}`,
      description: overrides.description ?? '',
      tags: [],
    },
    draftMetadata: null,
    data: overrides.data ?? {},
    draftData: overrides.draftData,
    depth: overrides.depth ?? 0,
    visible: overrides.visible ?? true,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    version: overrides.version ?? 1,
    hasChildren: overrides.hasChildren,
    originalName: overrides.originalName,
    originalParentId: overrides.originalParentId,
    removedAt: overrides.removedAt,
  } satisfies TreeNode;
}

describe('buildArchiveBreadcrumbs', () => {
  const trashRoot = createNode('r:trash', {
    parentId: 'r:root' as NodeId,
    nodeType: 'trash' as TreeNode['nodeType'],
    depth: 0,
    metadata: { name: 'Archive', description: '', tags: [] },
    draftMetadata: null,
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

    const breadcrumbs = buildArchiveBreadcrumbs({
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
      metadata: { name: 'Live Name B', description: '', tags: [] },
    });

    const nodeMap = new Map<string, TreeNode>([
      [String(trashRoot.id), trashRoot],
      [String(trashedNode.id), trashedNode],
    ]);

    const breadcrumbs = buildArchiveBreadcrumbs({
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
