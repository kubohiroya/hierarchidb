import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandProcessor } from '../CommandProcessor';
import type { NodeId, NodeType, TreeNode } from '@hierarchidb/common-type';

describe('Undo/Redo for recoverFromTrash', () => {
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
    removedAt: Date.now(),
    originalParentId: parentId as NodeId,
    originalName: name,
  } as any);

  beforeEach(() => {
    state = {
      t_trash: makeNode('t_trash', 'r_root', 'Trash'),
      x: makeNode('x', 't_trash', 'X'),
    } as any;

    core = {
      getNode: vi.fn(async (id: NodeId) => state[id]),
      updateNode: vi.fn(async (node: Partial<TreeNode> & { id: NodeId }) => {
        state[node.id] = { ...(state[node.id] as any), ...node } as TreeNode;
      }),
      listChildren: vi.fn(async (parentId: NodeId) => Object.values(state).filter((n: any) => n.parentId === parentId)),
      deleteNode: vi.fn(async (_id: NodeId) => {
      }),
      createNode: vi.fn(async (_n: TreeNode) => _n.id),
    };
  });

  it('undo/redo recoverFromTrash', async () => {
    const cp = new CommandProcessor(core);
    const env = cp.createEnvelope('recoverFromTrash', { nodeIds: ['x' as NodeId], toParentId: 'r_root' as NodeId });
    const r = await cp.processCommand(env);
    expect(r.success).toBe(true);
    expect(state['x'].parentId).toBe('r_root');
    expect(state['x'].removedAt).toBeUndefined();

    // undo -> back to trash state
    const u = await cp.undo();
    expect(u.success).toBe(true);
    expect(state['x'].parentId).toBe('t_trash');

    // redo -> recovered again
    const re = await cp.redo();
    expect(re.success).toBe(true);
    expect(state['x'].parentId).toBe('r_root');
  });
});
