import type { NodeId, NodeType, TreeNode } from '@hierarchidb/common-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandProcessor } from '../../CommandProcessor.js';
import type { CoreDB } from '../../CoreDB.js';

describe('Undo/Redo for moveNodes and remove', () => {
  type CoreStub = Pick<
    CoreDB,
    'getNode' | 'updateNode' | 'deleteNode' | 'createNode' | 'listChildren'
  > & {
    state: Map<NodeId, TreeNode>;
  };

  let core: CoreStub;
  let state: Map<NodeId, TreeNode>;
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
    state = new Map<NodeId, TreeNode>([
      ['r_root' as NodeId, makeNode('r_root', 'r_super', 'root')],
      ['a' as NodeId, makeNode('a', 'r_root', 'A')],
      ['b' as NodeId, makeNode('b', 'r_root', 'B')],
      ['p2' as NodeId, makeNode('p2', 'r_root', 'P2')],
    ]);

    const listChildren = async (parentId: NodeId): Promise<TreeNode[]> =>
      Array.from(state.values()).filter((node) => node.parentId === parentId);

    core = {
      state,
      getNode: vi.fn(async (id: NodeId) => state.get(id)),
      updateNode: vi.fn(async (node: Partial<TreeNode> & { id: NodeId }) => {
        const current = state.get(node.id);
        if (!current) throw new Error(`Node ${String(node.id)} not found`);
        state.set(node.id, { ...current, ...node });
      }),
      deleteNode: vi.fn(async (id: NodeId) => {
        state.delete(id);
      }),
      createNode: vi.fn(async (node: TreeNode) => {
        state.set(node.id, { ...node });
        return node.id;
      }),
      listChildren: vi.fn(listChildren),
    };
  });

  it('undo/redo moveNodes', async () => {
    const cp = new CommandProcessor(core as unknown as CoreDB);
    const env = cp.createEnvelope('moveNodes', {
      nodeIds: ['a' as NodeId],
      toParentId: 'p2' as NodeId,
    });
    const r = await cp.processCommand(env);
    expect(r.success).toBe(true);
    expect(state.get('a' as NodeId)?.parentId).toBe('p2');

    const u = await cp.undo();
    expect(u.success).toBe(true);
    expect(state.get('a' as NodeId)?.parentId).toBe('r_root');

    const re = await cp.redo();
    expect(re.success).toBe(true);
    expect(state.get('a' as NodeId)?.parentId).toBe('p2');
  });

  it('undo/redo remove', async () => {
    const cp = new CommandProcessor(core as unknown as CoreDB);
    const env = cp.createEnvelope('remove', { nodeIds: ['b' as NodeId] });
    const r = await cp.processCommand(env);
    expect(r.success).toBe(true);
    expect(state.has('b' as NodeId)).toBe(false);

    const u = await cp.undo();
    expect(u.success).toBe(true);
    expect(state.has('b' as NodeId)).toBe(true);

    const re = await cp.redo();
    expect(re.success).toBe(true);
    expect(state.has('b' as NodeId)).toBe(false);
  });
});
