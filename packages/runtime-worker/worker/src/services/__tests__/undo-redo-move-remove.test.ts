import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommandProcessor } from '~/services/CommandProcessor';
import type { NodeId, NodeType, TreeNode } from '@hierarchidb/common-type';

describe('Undo/Redo for moveNodes and remove', () => {
  let core: any;
  let state: Record<string, TreeNode>;
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

  beforeEach(() => {
    state = {
      r_root: makeNode('r_root', 'r_super', 'root'),
      a: makeNode('a', 'r_root', 'A'),
      b: makeNode('b', 'r_root', 'B'),
      p2: makeNode('p2', 'r_root', 'P2'),
    } as any;

    core = {
      getNode: vi.fn(async (id: NodeId) => state[id]),
      updateNode: vi.fn(async (node: Partial<TreeNode> & { id: NodeId }) => {
        state[node.id] = { ...(state[node.id] as any), ...node } as TreeNode;
      }),
      deleteNode: vi.fn(async (id: NodeId) => {
        delete state[id];
      }),
      createNode: vi.fn(async (node: TreeNode) => {
        state[node.id] = { ...node };
        return node.id;
      }),
      listChildren: vi.fn(async (parentId: NodeId) => Object.values(state).filter((n: any) => n.parentId === parentId)),
    };
  });

  it('undo/redo moveNodes', async () => {
    const cp = new CommandProcessor(core);
    const env = cp.createEnvelope('moveNodes', { nodeIds: ['a' as NodeId], toParentId: 'p2' as NodeId });
    const r = await cp.processCommand(env);
    expect(r.success).toBe(true);
    expect(state['a'].parentId).toBe('p2');

    const u = await cp.undo();
    expect(u.success).toBe(true);
    expect(state['a'].parentId).toBe('r_root');

    const re = await cp.redo();
    expect(re.success).toBe(true);
    expect(state['a'].parentId).toBe('p2');
  });

  it('undo/redo remove', async () => {
    const cp = new CommandProcessor(core);
    const env = cp.createEnvelope('remove', { nodeIds: ['b' as NodeId] });
    const r = await cp.processCommand(env);
    expect(r.success).toBe(true);
    expect(state['b']).toBeUndefined();

    const u = await cp.undo();
    expect(u.success).toBe(true);
    expect(state['b']).toBeDefined();

    const re = await cp.redo();
    expect(re.success).toBe(true);
    expect(state['b']).toBeUndefined();
  });
});

