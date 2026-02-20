/**
 * Tests for archive breadcrumb normalisation utilities.
 */

import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { describe, expect, it } from 'vitest';
import { buildArchiveBreadcrumbs } from '../../buildArchiveBreadcrumbs.ts';

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
  const archiveRoot = createNode('r:archive', {
    parentId: 'r:root' as NodeId,
    nodeType: 'archive' as TreeNode['nodeType'],
    depth: 0,
    metadata: { name: 'Archive', description: '', tags: [] },
    draftMetadata: null,
  });

  it('prefers originalName metadata when available', () => {
    const archiveedNode = createNode('node-a', {
      parentId: archiveRoot.id,
      originalName: 'Original A',
      originalParentId: 'r:root' as NodeId,
    });

    const nodeMap = new Map<string, TreeNode>([
      [String(archiveRoot.id), archiveRoot],
      [String(archiveedNode.id), archiveedNode],
    ]);

    const breadcrumbs = buildArchiveBreadcrumbs({
      treeId: 'r',
      rootNode: archiveRoot,
      targetNodeId: archiveedNode.id,
      nodeMap,
    });

    expect(breadcrumbs).toHaveLength(2);
    const [, target] = breadcrumbs;
    expect(target?.name).toBe('Original A');
    expect(target?.holderType).toBe('archive');
    expect(target?.holderTargetId).toBe(String(archiveedNode.id));
  });

  it('falls back to current name when original metadata is missing', () => {
    const archiveedNode = createNode('node-b', {
      parentId: archiveRoot.id,
      originalName: undefined,
      metadata: { name: 'Live Name B', description: '', tags: [] },
    });

    const nodeMap = new Map<string, TreeNode>([
      [String(archiveRoot.id), archiveRoot],
      [String(archiveedNode.id), archiveedNode],
    ]);

    const breadcrumbs = buildArchiveBreadcrumbs({
      treeId: 'r',
      rootNode: archiveRoot,
      targetNodeId: archiveedNode.id,
      nodeMap,
    });

    expect(breadcrumbs).toHaveLength(2);
    const [, target] = breadcrumbs;
    expect(target?.name).toBe('Live Name B');
  });
});
