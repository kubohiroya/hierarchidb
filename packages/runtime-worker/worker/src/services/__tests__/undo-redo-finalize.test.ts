import { describe, it, expect, vi } from 'vitest';
import type { NodeId, NodeType, TreeNode } from '@hierarchidb/common-type';

function makeCore() {
  const state: Record<string, TreeNode> = Object.create(null);
  return {
    state,
    getNode: vi.fn(async (id: NodeId) => state[id]),
    createNode: vi.fn(async (node: TreeNode) => {
      state[node.id] = { ...node };
      return node.id;
    }),
    updateNode: vi.fn(async (node: Partial<TreeNode> & { id: NodeId }) => {
      state[node.id] = { ...(state[node.id] as any), ...node } as TreeNode;
    }),
    deleteNode: vi.fn(async (id: NodeId) => {
      delete state[id];
    }),
    listChildren: vi.fn(async (_parentId: NodeId) => Object.values(state)),
  } as any;
}

describe('Undo/Redo finalize: create -> undo -> redo', () => {
  it('removes created node on undo and restores on redo with same id', async () => {
    const core = makeCore();
    const { CommandProcessor } = await import('~/services/CommandProcessor');
    const cp = new CommandProcessor(core);

    const parentId = 'p1' as NodeId;
    const env = cp.createEnvelope('createNode', {
      parentId,
      nodeType: 'folder' as NodeType,
      name: 'X',
    });
    const res = await cp.processCommand(env as any);
    expect(res.success).toBe(true);
    const createdId = (res as any).nodeId as NodeId;
    expect(createdId).toBeTruthy();
    expect(core.state[createdId]).toBeDefined();

    // Undo should delete the created node
    const u = await cp.undo();
    expect(u.success).toBe(true);
    expect(core.state[createdId]).toBeUndefined();

    // Redo should re-create with the same id
    const r = await cp.redo();
    expect(r.success).toBe(true);
    expect(core.state[createdId]).toBeDefined();
    expect(core.state[createdId].name).toBe('X');
  });
});

