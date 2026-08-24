import type { NodeId } from '@hierarchidb/core-types';
import { toNodeId, toNodeType } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { describe, expect, it } from 'vitest';
import { filterNodesBySearch, getNodePath } from '../utils/index.js';

const ROOT_PARENT_ID = null as NodeId;
const TIMESTAMP = 0;

const createNode = (
  id: string,
  name: string,
  nodeType: string,
  parentId: string | null,
  depth: number
): TreeNode => ({
  id: toNodeId(id),
  name,
  metadata: { name },
  nodeType: toNodeType(nodeType),
  parentId: parentId === null ? ROOT_PARENT_ID : toNodeId(parentId),
  depth,
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
  version: 1,
});

const nodes: TreeNode[] = [
  createNode('r', 'root', 'folder', null, 0),
  createNode('a', 'alpha', 'folder', 'r', 1),
  createNode('b', 'beta', 'folder', 'r', 1),
  createNode('c', 'charlie', 'note', 'a', 2),
  createNode('d', 'delta', 'note', 'a', 2),
  createNode('e', 'echo', 'note', 'b', 2),
];

describe('filterNodesBySearch + getNodePath', () => {
  it('includes matching nodes and their ancestors/descendants', () => {
    const r = filterNodesBySearch(nodes, 'char');
    const ids = r.map((n) => n.id).sort();
    // match: c (charlie); include ancestors: a, r; include descendants: none
    expect(ids).toEqual(['a', 'c', 'r']);
  });

  it('produces a readable path', () => {
    const path = getNodePath(toNodeId('c'), nodes, ' / ');
    expect(path).toBe('root / alpha / charlie');
  });
});
