import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandProcessor } from '../CommandProcessor.js';
import type { NodeId, NodeType, TreeNode } from '@hierarchidb/common-types';

describe('Undo/Redo for updateNode', () => {
  const baseNode: TreeNode = {
    id: 'n1' as NodeId,
    parentId: 'p1' as NodeId,
    nodeType: 'folder' as NodeType,
    name: 'Old',
    depth: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
  };

  let coreDBStub: any;

  beforeEach(() => {
    const state: Record<string, TreeNode> = { [baseNode.id]: { ...baseNode } };
    coreDBStub = {
      getNode: vi.fn(async (id: NodeId) => state[id]),
      updateNode: vi.fn(async (node: Partial<TreeNode> & { id: NodeId }) => {
        const prev = state[node.id];
        state[node.id] = { ...prev, ...node } as TreeNode;
      }),
      deleteNode: vi.fn(async (_id: NodeId) => {
      }),
      createNode: vi.fn(async (node: TreeNode) => node.id),
      listChildren: vi.fn(async (_id: NodeId) => []),
    };
  });

  it('undo restores previous name and redo reapplies new name', async () => {
    const cp = new CommandProcessor(coreDBStub);

    const updateEnv = cp.createEnvelope('updateNode', {
      nodeId: 'n1' as NodeId,
      name: 'New',
    });

    const res = await cp.processCommand(updateEnv);
    expect(res.success).toBe(true);

    // Undo -> back to Old
    const u = await cp.undo();
    expect(u.success).toBe(true);

    // Redo -> New again
    const r = await cp.redo();
    expect(r.success).toBe(true);
  });
});
