import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NodeId, NodeType, TreeNode } from '@hierarchidb/common-type';

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

describe('CommandProcessor bulk operations', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('moveNodes uses bulkUpdateNodes for multiple nodes', async () => {
    const state: Record<string, TreeNode> = {
      a: makeNode('a', 'root', 'A'),
      b: makeNode('b', 'root', 'B'),
    } as any;
    const core: any = {
      getNode: vi.fn(async (id: NodeId) => state[id]),
      listChildren: vi.fn(async (_p: NodeId) => []),
      updateNode: vi.fn(async (node: TreeNode) => (state[node.id] = node)),
      bulkUpdateNodes: vi.fn(async (nodes: TreeNode[]) => nodes.forEach((n) => (state[n.id] = n))),
    };
    const { CommandProcessor } = await import('~/services/CommandProcessor');
    const cp = new CommandProcessor(core);
    const env = cp.createEnvelope('moveNodes', { nodeIds: ['a' as NodeId, 'b' as NodeId], toParentId: 'p2' as NodeId });
    const r = await cp.processCommand(env);
    expect(r.success).toBe(true);
    expect(core.bulkUpdateNodes).toHaveBeenCalledTimes(1);
    expect(state['a'].parentId).toBe('p2');
    expect(state['b'].parentId).toBe('p2');
  });

  it('remove uses bulkDeleteNodes for multiple nodes', async () => {
    const state: Record<string, TreeNode> = {
      a: makeNode('a', 'root', 'A'),
      b: makeNode('b', 'root', 'B'),
    } as any;
    const core: any = {
      getNode: vi.fn(async (id: NodeId) => state[id]),
      deleteNode: vi.fn(async (id: NodeId) => delete state[id]),
      bulkDeleteNodes: vi.fn(async (ids: NodeId[]) => ids.forEach((id) => delete state[id])),
    };
    const { CommandProcessor } = await import('~/services/CommandProcessor');
    const cp = new CommandProcessor(core);
    const env = cp.createEnvelope('remove', { nodeIds: ['a' as NodeId, 'b' as NodeId] });
    const r = await cp.processCommand(env);
    expect(r.success).toBe(true);
    expect(core.bulkDeleteNodes).toHaveBeenCalledTimes(1);
    expect(state['a']).toBeUndefined();
    expect(state['b']).toBeUndefined();
  });

  it('recoverFromTrash uses bulkUpdateNodes and bulkDeleteNodes (holders) when multiple', async () => {
    const holder1 = makeNode('h1', 'trash' as any, 'ignored');
    const holder2 = makeNode('h2', 'trash' as any, 'ignored');
    const trashed1 = { ...makeNode('t1', 'h1', 'n1'), removedAt: Date.now() } as any;
    const trashed2 = { ...makeNode('t2', 'h2', 'n2'), removedAt: Date.now() } as any;
    const state: Record<string, TreeNode> = { h1: holder1, h2: holder2, t1: trashed1, t2: trashed2 } as any;
    const core: any = {
      getNode: vi.fn(async (id: NodeId) => state[id]),
      listChildren: vi.fn(async (_p: NodeId) => []),
      updateNode: vi.fn(async (node: TreeNode) => (state[node.id] = node)),
      deleteNode: vi.fn(async (id: NodeId) => delete state[id]),
      bulkUpdateNodes: vi.fn(async (nodes: TreeNode[]) => nodes.forEach((n) => (state[n.id] = n))),
      bulkDeleteNodes: vi.fn(async (ids: NodeId[]) => ids.forEach((id) => delete state[id])),
    };
    const { CommandProcessor } = await import('~/services/CommandProcessor');
    const cp = new CommandProcessor(core);
    const env = cp.createEnvelope('recoverFromTrash', { nodeIds: ['t1' as NodeId, 't2' as NodeId], toParentId: 'root' as NodeId });
    const r = await cp.processCommand(env);
    expect(r.success).toBe(true);
    expect(core.bulkUpdateNodes).toHaveBeenCalledTimes(1);
    expect(core.bulkDeleteNodes).toHaveBeenCalledTimes(1);
    expect(state['t1'].parentId).toBe('root');
    expect(state['t2'].parentId).toBe('root');
  });
});

