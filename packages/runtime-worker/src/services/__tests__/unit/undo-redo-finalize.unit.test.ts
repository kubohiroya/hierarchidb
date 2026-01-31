import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { describe, expect, it } from 'vitest';
import type { CoreDB } from '../../CoreDB.js';

// fulltext tables removed; core stub only

type TreeNodeState = Partial<Record<NodeId, TreeNode>>;

interface CoreStubBase {
  state: TreeNodeState;
  getNode: (id: NodeId) => Promise<TreeNode | undefined>;
  createNode: (node: TreeNode) => Promise<NodeId>;
  updateNode: (node: Partial<TreeNode> & { id: NodeId }) => Promise<void>;
  deleteNode: (id: NodeId) => Promise<void>;
  listChildren: (parentId: NodeId) => Promise<TreeNode[]>;
}

function makeCore(): CoreStubBase {
  const state: TreeNodeState = {};

  return {
    state,
    async getNode(id: NodeId) {
      return state[id];
    },
    async createNode(node: TreeNode) {
      state[node.id] = { ...node };
      return node.id;
    },
    async updateNode(node: Partial<TreeNode> & { id: NodeId }) {
      const current = state[node.id];
      if (!current) throw new Error(`Node ${String(node.id)} not found`);
      state[node.id] = { ...current, ...node };
    },
    async deleteNode(id: NodeId) {
      delete state[id];
    },
    async listChildren(parentId: NodeId) {
      return Object.values(state).filter((n): n is TreeNode =>
        Boolean(n && n.parentId === parentId)
      );
    },
  };
}

describe('Undo/Redo finalize: create -> undo -> redo', () => {
  it('removes created node on undo and restores on redo with same id', async () => {
    const core = makeCore();
    const { CommandProcessor } = await import('../../CommandProcessor.js');
    const cp = new CommandProcessor(core as unknown as CoreDB);

    const parentId = 'p1' as NodeId;
    const env = cp.createEnvelope('createNode', {
      parentId,
      nodeType: 'folder' as NodeType,
      metadata: { name: 'X' },
    });
    const res = await cp.processCommand(env);
    expect(res.success).toBe(true);
    if (!res.success) {
      throw new Error('Expected command to succeed');
    }
    if (!res.nodeId) {
      throw new Error('Expected command result to include nodeId');
    }
    const createdId = res.nodeId;
    expect(core.state[createdId]).toBeDefined();

    // Undo should delete the created node
    const u = await cp.undo();
    expect(u.success).toBe(true);
    expect(core.state[createdId]).toBeUndefined();

    // Redo should re-create with the same id
    const r = await cp.redo();
    expect(r.success).toBe(true);
    expect(core.state[createdId]).toBeDefined();
    expect(core.state[createdId]?.metadata.name).toBe('X');
  }, 20000);
});
