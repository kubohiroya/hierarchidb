import { describe, expect, it } from 'vitest';
import type { NodeId, NodeType, TreeNode } from '@hierarchidb/common-type';
import { CoreDB } from '../CoreDB';

function node(id: string, parentId: string, name: string, depth = 1, type: NodeType = 'folder' as any): TreeNode {
  return {
    id: id as any,
    parentId: parentId as any,
    nodeType: type,
    name,
    depth,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
  } as any;
}

describe('CoreDB.duplicateSubtreeWithMap', () => {
  it('duplicates subtree and returns idMap', async () => {
    const map = new Map<string, TreeNode>();
    // Tree: p -> a -> b
    const p = 'p';
    const a = 'a';
    const b = 'b';
    map.set(p, node(p, 'root', 'P', 0));
    map.set(a, node(a, p, 'A', 1));
    map.set(b, node(b, a, 'B', 2));

    const created: TreeNode[] = [];
    const fake: any = {
      nodes: {
        async get(id: NodeId) {
          return map.get(id as any);
        },
      },
      async listChildren(parentId: NodeId) {
        return Array.from(map.values()).filter((n) => n.parentId === parentId) as any;
      },
      async bulkCreateNodes(nodes: TreeNode[]) {
        created.push(...nodes);
      },
    };

    const { idMap, newRootId } = await CoreDB.prototype.duplicateSubtreeWithMap.call(fake, a as any, p as any);
    expect(newRootId).toBe(idMap.get(a as any));
    // mapping should contain a and b
    expect(idMap.get(a as any)).toBeDefined();
    expect(idMap.get(b as any)).toBeDefined();
    // created should contain 2 nodes with remapped parent of b to new a
    const newA = created.find((n) => n.id === idMap.get(a as any));
    const newB = created.find((n) => n.id === idMap.get(b as any));
    expect(newA?.parentId).toBe(p);
    expect(newB?.parentId).toBe(newA?.id);
  });
});
