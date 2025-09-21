import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeId, NodeType, TreeNode } from '@hierarchidb/common-type';
import type { CoreDB } from '../CoreDB.js';

const FOLDER_TYPE = 'folder' as NodeType;
const TRASH_TYPE = 'trash' as NodeType;

type TreeNodeState = Map<NodeId, TreeNode>;

interface CoreStub {
  state: TreeNodeState;
  getNode: (id: NodeId) => Promise<TreeNode | undefined>;
  createNode: (node: TreeNode) => Promise<NodeId>;
  updateNode: (node: TreeNode) => Promise<void>;
  deleteNode: (id: NodeId) => Promise<void>;
  listChildren: (parentId: NodeId) => Promise<TreeNode[]>;
  bulkUpdateNodes?: (nodes: TreeNode[]) => Promise<void>;
  bulkDeleteNodes?: (ids: NodeId[]) => Promise<void>;
}

function makeNode(id: string, parentId: string, name: string, nodeType: NodeType = FOLDER_TYPE): TreeNode {
  const timestamp = Date.now();
  return {
    id: id as NodeId,
    parentId: parentId as NodeId,
    nodeType,
    name,
    depth: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
  };
}

describe('CommandProcessor bulk operations', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('moveNodes uses bulkUpdateNodes for multiple nodes', async () => {
    const state: TreeNodeState = new Map([
      ['a' as NodeId, makeNode('a', 'root', 'A')],
      ['b' as NodeId, makeNode('b', 'root', 'B')],
    ]);

    const core: CoreStub = {
      state,
      async getNode(id) {
        return state.get(id);
      },
      async createNode(node) {
        state.set(node.id, { ...node });
        return node.id;
      },
      async updateNode(node) {
        state.set(node.id, { ...node });
      },
      async deleteNode(id) {
        state.delete(id);
      },
      async listChildren() {
        return Array.from(state.values());
      },
      bulkUpdateNodes: vi.fn(async (nodes) => {
        nodes.forEach((node) => state.set(node.id, { ...node }));
      }),
    };

    const { CommandProcessor } = await import('~/services/CommandProcessor');
    const cp = new CommandProcessor(core as unknown as CoreDB);
    const env = cp.createEnvelope('moveNodes', {
      nodeIds: ['a' as NodeId, 'b' as NodeId],
      toParentId: 'p2' as NodeId,
    });
    const result = await cp.processCommand(env);
    expect(result.success).toBe(true);
    expect(core.bulkUpdateNodes).toHaveBeenCalledTimes(1);
    expect(state.get('a' as NodeId)?.parentId).toBe('p2');
    expect(state.get('b' as NodeId)?.parentId).toBe('p2');
  });

  it('remove uses bulkDeleteNodes for multiple nodes', async () => {
    const state: TreeNodeState = new Map([
      ['a' as NodeId, makeNode('a', 'root', 'A')],
      ['b' as NodeId, makeNode('b', 'root', 'B')],
    ]);

    const core: CoreStub = {
      state,
      async getNode(id) {
        return state.get(id);
      },
      async createNode(node) {
        state.set(node.id, { ...node });
        return node.id;
      },
      async updateNode(node) {
        state.set(node.id, { ...node });
      },
      async deleteNode(id) {
        state.delete(id);
      },
      async listChildren() {
        return Array.from(state.values());
      },
      bulkDeleteNodes: vi.fn(async (ids) => {
        ids.forEach((id) => state.delete(id));
      }),
    };

    const { CommandProcessor } = await import('~/services/CommandProcessor');
    const cp = new CommandProcessor(core as unknown as CoreDB);
    const env = cp.createEnvelope('remove', { nodeIds: ['a' as NodeId, 'b' as NodeId] });
    const result = await cp.processCommand(env);
    expect(result.success).toBe(true);
    expect(core.bulkDeleteNodes).toHaveBeenCalledTimes(1);
    expect(state.has('a' as NodeId)).toBe(false);
    expect(state.has('b' as NodeId)).toBe(false);
  });

  it('restoreFromTrash uses bulkUpdateNodes and bulkDeleteNodes (holders) when multiple', async () => {
    const holder1 = makeNode('h1', 'trash', 'ignored', TRASH_TYPE);
    const holder2 = makeNode('h2', 'trash', 'ignored', TRASH_TYPE);
    const trashed1: TreeNode = { ...makeNode('t1', 'h1', 'n1'), removedAt: Date.now() };
    const trashed2: TreeNode = { ...makeNode('t2', 'h2', 'n2'), removedAt: Date.now() };

    const state: TreeNodeState = new Map([
      ['h1' as NodeId, holder1],
      ['h2' as NodeId, holder2],
      ['t1' as NodeId, trashed1],
      ['t2' as NodeId, trashed2],
    ]);

    const core: CoreStub = {
      state,
      async getNode(id) {
        return state.get(id);
      },
      async createNode(node) {
        state.set(node.id, { ...node });
        return node.id;
      },
      async updateNode(node) {
        state.set(node.id, { ...node });
      },
      async deleteNode(id) {
        state.delete(id);
      },
      async listChildren() {
        return Array.from(state.values());
      },
      bulkUpdateNodes: vi.fn(async (nodes) => {
        nodes.forEach((node) => state.set(node.id, { ...node }));
      }),
      bulkDeleteNodes: vi.fn(async (ids) => {
        ids.forEach((id) => state.delete(id));
      }),
    };

    const { CommandProcessor } = await import('~/services/CommandProcessor');
    const cp = new CommandProcessor(core as unknown as CoreDB);
    const env = cp.createEnvelope('restoreFromTrash', {
      nodeIds: ['t1' as NodeId, 't2' as NodeId],
      toParentId: 'root' as NodeId,
    });
    const result = await cp.processCommand(env);
    expect(result.success).toBe(true);
    expect(core.bulkUpdateNodes).toHaveBeenCalledTimes(1);
    expect(core.bulkDeleteNodes).toHaveBeenCalledTimes(1);
    expect(state.get('t1' as NodeId)?.parentId).toBe('root');
    expect(state.get('t2' as NodeId)?.parentId).toBe('root');
  });
});
