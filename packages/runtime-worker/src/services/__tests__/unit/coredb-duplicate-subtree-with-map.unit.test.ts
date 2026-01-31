import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { describe, expect, it } from 'vitest';
import { CoreDB } from '../../CoreDB.js';

function node(
  id: string,
  parentId: string,
  name: string,
  depth = 1,
  type: NodeType = 'folder' as NodeType
): TreeNode {
  return {
    id: id as NodeId,
    parentId: parentId as NodeId,
    nodeType: type,
    metadata: { name, description: undefined, tags: [] },
    draftMetadata: null,
    data: {},
    draftData: null,
    depth,
    visible: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
  };
}

describe('CoreDB.duplicateSubtreeWithMap', () => {
  it('duplicates subtree and returns idMap', async () => {
    const map = new Map<NodeId, TreeNode>();
    // console: p -> a -> b
    const p = 'p' as NodeId;
    const a = 'a' as NodeId;
    const b = 'b' as NodeId;
    map.set(p, node('p', 'root', 'P', 0));
    map.set(a, node('a', 'p', 'A', 1));
    map.set(b, node('b', 'a', 'B', 2));

    const created: TreeNode[] = [];
    const fake = {
      nodes: {
        async get(id: NodeId) {
          return map.get(id);
        },
      },
      async listChildren(parentId: NodeId) {
        return Array.from(map.values()).filter((n) => n.parentId === parentId);
      },
      async bulkCreateNodes(nodes: TreeNode[]) {
        created.push(...nodes);
      },
    } satisfies {
      nodes: { get(id: NodeId): Promise<TreeNode | undefined> };
      listChildren(parentId: NodeId): Promise<TreeNode[]>;
      bulkCreateNodes(nodes: TreeNode[]): Promise<void>;
    };

    const context = fake as unknown as CoreDB;
    const { idMap, newRootId } = await CoreDB.prototype.duplicateSubtreeWithMap.call(context, a, p);
    expect(newRootId).toBe(idMap.get(a));
    // mapping should contain a and b
    expect(idMap.get(a)).toBeDefined();
    expect(idMap.get(b)).toBeDefined();
    // created should contain 2 nodes with remapped parent of b to new a
    const newAId = idMap.get(a);
    const newBId = idMap.get(b);
    const newA = created.find((n) => n.id === newAId);
    const newB = created.find((n) => n.id === newBId);
    expect(newA?.parentId).toBe(p);
    expect(newB?.parentId).toBe(newA?.id);
  });
});
