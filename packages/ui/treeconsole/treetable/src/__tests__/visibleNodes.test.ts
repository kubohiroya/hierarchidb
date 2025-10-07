import { describe, expect, it } from 'vitest';
import type { TreeNode } from '@hierarchidb/common-types';

import { buildVisibleNodes } from '../utils/visible-nodes.js';

const makeNode = (id: string, parentId: string | null, overrides: Partial<TreeNode> = {}): TreeNode => {
  const parentKey = parentId ?? '';
  return {
    id: id as TreeNode['id'],
    parentId: parentKey as TreeNode['parentId'],
    nodeType: 'folder' as TreeNode['nodeType'],
    name: id,
    depth: 0,
    createdAt: 0 as TreeNode['createdAt'],
    updatedAt: 0 as TreeNode['updatedAt'],
    version: 1,
    ...overrides,
  };
};

describe('buildVisibleNodes', () => {
  it('hides descendants when the parent node is collapsed', () => {
    const nodes: TreeNode[] = [
      makeNode('root', null),
      makeNode('child-a', 'root'),
      makeNode('child-b', 'root'),
      makeNode('grandchild', 'child-a'),
    ];

    const result = buildVisibleNodes(nodes, new Set(), { rootNodeId: 'root' });

    expect(result.map((node) => String(node.id))).toEqual(['root']);
  });

  it('preserves preorder when parents are expanded', () => {
    const nodes: TreeNode[] = [
      makeNode('root', null),
      makeNode('child-a', 'root'),
      makeNode('grandchild', 'child-a'),
      makeNode('child-b', 'root'),
    ];

    const expanded = new Set<string>(['root', 'child-a']);

    const result = buildVisibleNodes(nodes, expanded, { rootNodeId: 'root' });

    expect(result.map((node) => String(node.id))).toEqual([
      'root',
      'child-a',
      'grandchild',
      'child-b',
    ]);
  });

  it('shows children when the configured root node is not part of the dataset', () => {
    const nodes: TreeNode[] = [
      makeNode('child-a', 'virtual-root'),
      makeNode('grandchild', 'child-a'),
      makeNode('child-b', 'virtual-root'),
    ];

    const expanded = new Set<string>(['child-a']);

    const result = buildVisibleNodes(nodes, expanded, { rootNodeId: 'virtual-root' });

    expect(result.map((node) => String(node.id))).toEqual([
      'child-a',
      'grandchild',
      'child-b',
    ]);
  });
});
