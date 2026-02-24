import { describe, it, expect } from 'vitest';
import type { TreeNode } from '@hierarchidb/tree-api';
import { toNodeId } from '@hierarchidb/core-types';
import { computeDescendants, collectDescendantIdList } from '../utils/descendants';

const N = (id: string, parentId?: string): TreeNode => ({
  id: toNodeId(id),
  name: id,
  nodeType: 'folder' as const,
  depth: 0,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  version: 1,
  parentId: parentId ? toNodeId(parentId) : toNodeId('__root__'),
});

describe('computeDescendants', () => {
  it('includes self and all descendants', () => {
    const data: TreeNode[] = [
      N('a'), N('b','a'), N('c','a'), N('d','b'), N('e','b'), N('f','c'),
    ];
    const set = computeDescendants(data, toNodeId('a'));
    expect(set.size).toBe(6);
    expect(set.has(toNodeId('a'))).toBe(true);
    expect(set.has(toNodeId('d'))).toBe(true);
  });

  it('handles multiple roots correctly', () => {
    const data: TreeNode[] = [ N('r1'), N('r2'), N('x','r2') ];
    const s1 = computeDescendants(data, toNodeId('r1'));
    const s2 = computeDescendants(data, toNodeId('r2'));
    expect(s1.size).toBe(1);
    expect(s2.size).toBe(2);
  });

  it('collects descendant id list as strings without duplicates', () => {
    const data: TreeNode[] = [
      N('root'),
      N('child','root'),
      N('leaf','child'),
    ];
    const list = collectDescendantIdList(data, toNodeId('root'));
    const sorted = [...new Set(list)].sort();
    expect(sorted).toEqual(['child', 'leaf', 'root']);
    expect(list.length).toBe(new Set(list).size);
    expect(list.every((id) => typeof id === 'string')).toBe(true);
  });

  it('includes start id when descendants map is empty', () => {
    const data: TreeNode[] = [N('solo')];
    const list = collectDescendantIdList(data, toNodeId('solo'));
    expect(list).toEqual(['solo']);
  });
});
