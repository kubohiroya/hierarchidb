import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeId, NodeType, Timestamp, TreeNode } from '@hierarchidb/common-type';

const makeNode = (id: string, parentId: string, name: string): TreeNode => ({
  id: id as NodeId,
  parentId: parentId as NodeId,
  nodeType: 'folder' as NodeType,
  name,
  depth: 1,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  version: 1,
});

describe('TreeMutationService bulk paths', () => {
  beforeEach(() => vi.resetModules());

  it('pasteNodes uses bulkCreateNodes for multiple nodes', async () => {
    const core: any = {
      listChildren: vi.fn(async (_p: NodeId) => []),
      createNode: vi.fn(async (_n: TreeNode) => {
      }),
      bulkCreateNodes: vi.fn(async (_nodes: TreeNode[]) => {
      }),
    };
    const { TreeMutationService } = await import('~/services/TreeMutationService');
    const svc = new TreeMutationService(core as any, { processCommand: vi.fn() } as any);
    const payload = {
      nodes: {
        a: makeNode('a', 'x', 'A'),
        b: makeNode('b', 'x', 'B'),
      } as any,
      nodeIds: ['a' as NodeId, 'b' as NodeId],
      toParentId: 'p' as NodeId,
      onNameConflict: 'error' as const,
    };
    const env = {
      commandId: 'c1',
      groupId: 'g1',
      kind: 'pasteNodes' as const,
      payload,
      issuedAt: Date.now() as Timestamp,
    };
    const r = await svc.pasteNodes(env as any);
    expect(r.success).toBe(true);
    expect(core.bulkCreateNodes).toHaveBeenCalledOnce();
  });
});

