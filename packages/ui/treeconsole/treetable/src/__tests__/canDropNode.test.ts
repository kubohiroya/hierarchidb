import { describe, it, expect } from 'vitest';
import type { TreeNode } from '@hierarchidb/common-type';
import { canDropNode } from '../utils/index.js';

const N = (id: string, parentId?: string): TreeNode => ({
  id: id as any,
  name: id,
  nodeType: 'folder' as any,
  depth: 0,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  version: 1,
  parentId: parentId as any,
});

describe('canDropNode', () => {
  const nodes: TreeNode[] = [ N('a'), N('b','a'), N('c','a'), N('d','b') ];

  it('denies dropping onto itself', () => {
    expect(canDropNode('a' as any, 'a' as any, 'into', nodes)).toBe(false);
  });

  it('denies dropping into own descendants', () => {
    expect(canDropNode('a' as any, 'd' as any, 'into', nodes)).toBe(false);
    expect(canDropNode('b' as any, 'd' as any, 'into', nodes)).toBe(false);
  });

  it('allows into/before/after for non-descendant targets', () => {
    expect(canDropNode('b' as any, 'c' as any, 'into', nodes)).toBe(true);
    expect(canDropNode('b' as any, 'c' as any, 'before', nodes)).toBe(true);
    expect(canDropNode('b' as any, 'c' as any, 'after', nodes)).toBe(true);
  });
});

