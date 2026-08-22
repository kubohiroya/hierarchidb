import type { NodeId } from '@hierarchidb/core-types';
import { toNodeType } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoreDB } from '../../CoreDB';
import { TreeQueryService } from '../../TreeQueryService';

describe('TreeQueryService.listAncestors', () => {
  let nodes: Map<NodeId, TreeNode>;
  let service: TreeQueryService;

  const buildNode = (options: {
    id: string;
    parentId: string | null;
    name: string;
    depth: number;
  }): TreeNode => {
    const now = Date.now();
    return {
      id: options.id as NodeId,
      parentId: (options.parentId ?? 'super-root') as NodeId,
      nodeType: toNodeType('folder'),
      metadata: { name: options.name, description: undefined, tags: [] },
      draftMetadata: null,
      data: {},
      draftData: undefined,
      depth: options.depth,
      visible: true,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
  };

  beforeEach(() => {
    nodes = new Map<NodeId, TreeNode>();
    const coreDB = {
      getNode: vi.fn(async (id: NodeId) => nodes.get(id)),
    } as Partial<CoreDB> as CoreDB;
    service = new TreeQueryService(coreDB);
  });

  function registerNode(node: TreeNode): void {
    nodes.set(node.id, node);
  }

  it('returns the entire ancestor chain starting with the Resources root', async () => {
    registerNode(buildNode({ id: 'r:root', parentId: null, name: 'Resources', depth: 0 }));
    registerNode(buildNode({ id: 'r:alpha', parentId: 'r:root', name: 'Alpha', depth: 1 }));
    registerNode(buildNode({ id: 'r:beta', parentId: 'r:alpha', name: 'Beta', depth: 2 }));
    registerNode(buildNode({ id: 'r:gamma', parentId: 'r:beta', name: 'Gamma', depth: 3 }));
    registerNode(buildNode({ id: 'r:leaf', parentId: 'r:gamma', name: 'Leaf', depth: 4 }));

    const ancestors = await service.listAncestors('r:leaf' as NodeId);

    expect(ancestors.map((node) => node.id)).toEqual(['r:root', 'r:alpha', 'r:beta', 'r:gamma']);
  });

  it('includes the Resources root even when the node depth is even', async () => {
    registerNode(buildNode({ id: 'r:root', parentId: null, name: 'Resources', depth: 0 }));
    registerNode(buildNode({ id: 'r:alpha', parentId: 'r:root', name: 'Alpha', depth: 1 }));
    registerNode(buildNode({ id: 'r:branch', parentId: 'r:alpha', name: 'Branch', depth: 2 }));

    const ancestors = await service.listAncestors('r:branch' as NodeId);

    expect(ancestors.map((node) => node.id)).toEqual(['r:root', 'r:alpha']);
  });

  it('returns an empty list for the tree root', async () => {
    registerNode(buildNode({ id: 'r:root', parentId: null, name: 'Resources', depth: 0 }));

    const ancestors = await service.listAncestors('r:root' as NodeId);

    expect(ancestors).toEqual([]);
  });
});
