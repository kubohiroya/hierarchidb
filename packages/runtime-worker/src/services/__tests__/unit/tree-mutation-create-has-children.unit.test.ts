import { type NodeId, type TreeId, toNodeId, toNodeType } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommandProcessor } from '../../CommandProcessor';
import type { CoreDB } from '../../CoreDB';

const makeNode = (id: string, parentId: string, version = 1): TreeNode => ({
  id: toNodeId(id),
  parentId: toNodeId(parentId),
  nodeType: toNodeType('folder'),
  metadata: { name: id, description: undefined, tags: [] },
  draftMetadata: null,
  data: {},
  draftData: undefined,
  depth: 0,
  visible: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  version,
  hasChildren: false,
});

describe('TreeMutationService createNode hasChildren propagation', () => {
  beforeEach(() => vi.resetModules());

  it('marks the target parent as having children after draft node creation', async () => {
    const nodes = new Map<NodeId, TreeNode>([
      [toNodeId('r:root'), makeNode('r:root', 'r:root')],
      [toNodeId('parent'), makeNode('parent', 'r:root')],
    ]);

    const core = {
      nodes: {
        get: vi.fn(async (id: NodeId) => nodes.get(id)),
        update: vi.fn(async (id: NodeId, patch: Partial<TreeNode>) => {
          const existing = nodes.get(id);
          if (existing) nodes.set(id, { ...existing, ...patch });
        }),
      },
      runInTx: vi.fn(async (_mode: string, _tables: string[], task: () => Promise<NodeId>) =>
        task()
      ),
      listChildren: vi.fn(async (parentId: NodeId) =>
        Array.from(nodes.values()).filter((node) => node.parentId === parentId)
      ),
      createNode: vi.fn(async (node: TreeNode) => {
        nodes.set(node.id as NodeId, node);
        return node.id as NodeId;
      }),
      getNode: vi.fn(async (id: NodeId) => nodes.get(id)),
      updateNode: vi.fn(async (patch: Pick<TreeNode, 'id'> & Partial<TreeNode>) => {
        const existing = nodes.get(patch.id as NodeId);
        if (existing) nodes.set(patch.id as NodeId, { ...existing, ...patch });
      }),
    };

    const { TreeMutationService } = await import('../../TreeMutationService');
    const service = new TreeMutationService(core as unknown as CoreDB, {} as CommandProcessor);

    const result = await service.createNode({
      treeId: 'r' as TreeId,
      parentId: toNodeId('parent'),
      nodeType: toNodeType('folder'),
      name: 'Child',
    });

    expect(result.success).toBe(true);
    expect(nodes.get(toNodeId('parent'))?.hasChildren).toBe(true);
    expect(core.updateNode).toHaveBeenCalledWith(
      expect.objectContaining({
        id: toNodeId('parent'),
        hasChildren: true,
      })
    );
  });
});
