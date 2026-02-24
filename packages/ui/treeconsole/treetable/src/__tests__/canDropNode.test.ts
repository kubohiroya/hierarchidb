import { describe, it, expect } from 'vitest';
import type { TreeNode } from '@hierarchidb/tree-api';
import { toNodeId } from '@hierarchidb/core-types';
import { type NodeType } from '@hierarchidb/core-types';

const ROOT_PARENT_ID = toNodeId('__root__');
import { canDropNode } from '../utils/index';

const N = (id: string, parentId?: string): TreeNode => ({
  id: toNodeId(id),
  name: id,
  nodeType: 'folder' as NodeType,
  depth: 0,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  version: 1,
  parentId: parentId ? toNodeId(parentId) : ROOT_PARENT_ID,
});

describe('canDropNode', () => {
  const nodes: TreeNode[] = [ N('a'), N('b','a'), N('c','a'), N('d','b') ];

  it('denies dropping onto itself', () => {
    expect(canDropNode(toNodeId('a'), toNodeId('a'), 'into', nodes)).toBe(false);
  });

  it('denies dropping into own descendants', () => {
    expect(canDropNode(toNodeId('a'), toNodeId('d'), 'into', nodes)).toBe(false);
    expect(canDropNode(toNodeId('b'), toNodeId('d'), 'into', nodes)).toBe(false);
  });

  it('allows into/before/after for non-descendant targets', () => {
    expect(canDropNode(toNodeId('b'), toNodeId('c'), 'into', nodes)).toBe(true);
    expect(canDropNode(toNodeId('b'), toNodeId('c'), 'before', nodes)).toBe(true);
    expect(canDropNode(toNodeId('b'), toNodeId('c'), 'after', nodes)).toBe(true);
  });
});
