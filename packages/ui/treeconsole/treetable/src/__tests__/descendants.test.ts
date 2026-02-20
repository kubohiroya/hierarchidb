import { describe, it, expect } from 'vitest';
import type { TreeNode } from '@hierarchidb/tree-api';
import { computeDescendants, collectDescendantIdList } from '~/utils/descendants';

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

describe('computeDescendants', () => {
  it('includes self and all descendants', () => {
    const data: TreeNode[] = [
      N('a'), N('b','a'), N('c','a'), N('d','b'), N('e','b'), N('f','c'),
    ];
    const set = computeDescendants(data, 'a' as any);
    expect(set.size).toBe(6);
    expect(set.has('a' as any)).toBe(true);
    expect(set.has('d' as any)).toBe(true);
  });

  it('handles multiple roots correctly', () => {
    const data: TreeNode[] = [ N('r1'), N('r2'), N('x','r2') ];
    const s1 = computeDescendants(data, 'r1' as any);
    const s2 = computeDescendants(data, 'r2' as any);
    expect(s1.size).toBe(1);
    expect(s2.size).toBe(2);
  });

  it('collects descendant id list as strings without duplicates', () => {
    const data: TreeNode[] = [
      N('root'),
      N('child','root'),
      N('leaf','child'),
    ];
    const list = collectDescendantIdList(data, 'root' as any);
    const sorted = [...new Set(list)].sort();
    expect(sorted).toEqual(['child', 'leaf', 'root']);
    expect(list.length).toBe(new Set(list).size);
    expect(list.every((id) => typeof id === 'string')).toBe(true);
  });

  it('includes start id when descendants map is empty', () => {
    const data: TreeNode[] = [N('solo')];
    const list = collectDescendantIdList(data, 'solo' as any);
    expect(list).toEqual(['solo']);
  });
});
