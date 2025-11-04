import type { CommandResult, NodeId, NodeType, TreeNode } from '@hierarchidb/common-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoreDB } from '../../CoreDB.js';

const FOLDER_TYPE = 'folder' as NodeType;

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

function makeNode(
  id: string,
  parentId: string,
  name: string,
  nodeType: NodeType = FOLDER_TYPE
): TreeNode {
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
        for (const node of nodes) {
          state.set(node.id, { ...node });
        }
      }),
    };

    const { CommandProcessor } = await import('../../CommandProcessor.js');
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
        for (const id of ids) {
          state.delete(id);
        }
      }),
    };

    const { CommandProcessor } = await import('../../CommandProcessor.js');
    const cp = new CommandProcessor(core as unknown as CoreDB);
    const env = cp.createEnvelope('remove', { nodeIds: ['a' as NodeId, 'b' as NodeId] });
    const result = await cp.processCommand(env);
    expect(result.success).toBe(true);
    expect(core.bulkDeleteNodes).toHaveBeenCalledTimes(1);
    expect(state.has('a' as NodeId)).toBe(false);
    expect(state.has('b' as NodeId)).toBe(false);
  });

  it('restoreFromTrash uses bulkUpdateNodes for multiple nodes (without holders)', async () => {
    const removedAt = Date.now();
    const trashed1: TreeNode = {
      ...makeNode('t1', 'trash', 'n1'),
      originalName: 'n1',
      originalParentId: 'root' as NodeId,
      removedAt,
      holderType: 'trash',
      holderTargetId: 't1' as NodeId,
      holderMetaParentId: 'root' as NodeId,
    };
    const trashed2: TreeNode = {
      ...makeNode('t2', 'trash', 'n2'),
      originalName: 'n2',
      originalParentId: 'root' as NodeId,
      removedAt,
      holderType: 'trash',
      holderTargetId: 't2' as NodeId,
      holderMetaParentId: 'root' as NodeId,
    };

    const state: TreeNodeState = new Map([
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
        for (const node of nodes) {
          state.set(node.id, { ...node });
        }
      }),
      bulkDeleteNodes: vi.fn(async (ids) => {
        for (const id of ids) {
          state.delete(id);
        }
      }),
    };

    const { CommandProcessor } = await import('../../CommandProcessor.js');
    const cp = new CommandProcessor(core as unknown as CoreDB);
    const env = cp.createEnvelope('restoreFromTrash', {
      nodeIds: ['t1' as NodeId, 't2' as NodeId],
      toParentId: 'root' as NodeId,
    });
    const result = await cp.processCommand(env);
    expect(result.success).toBe(true);
    expect(core.bulkUpdateNodes).toHaveBeenCalledTimes(1);
    expect(core.bulkDeleteNodes).not.toHaveBeenCalled();
    expect(state.get('t1' as NodeId)?.parentId).toBe('root');
    expect(state.get('t2' as NodeId)?.parentId).toBe('root');
    expect(state.get('t1' as NodeId)?.holderType).toBeUndefined();
    expect(state.get('t2' as NodeId)?.holderType).toBeUndefined();
    expect(state.has('h1' as NodeId)).toBe(false);
  });

  it('restoreFromTrash auto-renames conflicting nodes when requested', async () => {
    const parentId = 'root' as NodeId;
    const existing = makeNode('existing', parentId, 'Folder');
    const removedAt = Date.now();
    const trashed1: TreeNode = {
      ...makeNode('t1', 'trash', 'Folder'),
      originalName: 'Folder',
      originalParentId: parentId,
      removedAt,
    };
    const trashed2: TreeNode = {
      ...makeNode('t2', 'trash', 'Folder'),
      originalName: 'Folder',
      originalParentId: parentId,
      removedAt,
    };

    const state: TreeNodeState = new Map([
      [existing.id, existing],
      [trashed1.id, trashed1],
      [trashed2.id, trashed2],
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
      async listChildren(parent) {
        return Array.from(state.values()).filter((node) => node.parentId === parent);
      },
      bulkUpdateNodes: vi.fn(async (nodes) => {
        for (const node of nodes) {
          state.set(node.id, { ...node });
        }
      }),
    };

    const { CommandProcessor } = await import('../../CommandProcessor.js');
    const cp = new CommandProcessor(core as unknown as CoreDB);
    const env = cp.createEnvelope('restoreFromTrash', {
      nodeIds: ['t1' as NodeId, 't2' as NodeId],
      toParentId: parentId,
      onNameConflict: 'auto-rename',
    });
    const result = await cp.processCommand(env);
    expect(result.success).toBe(true);
    expect(core.bulkUpdateNodes).toHaveBeenCalledTimes(1);

    const restoredNames = [state.get('t1' as NodeId)?.name, state.get('t2' as NodeId)?.name].filter(
      (name): name is string => typeof name === 'string'
    );

    expect(restoredNames).toHaveLength(2);
    expect(new Set(restoredNames).size).toBe(2);
    expect(restoredNames.every((name) => name.startsWith('Folder'))).toBe(true);
  });

  it('restoreFromTrash returns NAME_NOT_UNIQUE when conflicts remain and policy is error', async () => {
    const parentId = 'root' as NodeId;
    const existing = makeNode('existing', parentId, 'Folder');
    const removedAt = Date.now();
    const trashed: TreeNode = {
      ...makeNode('t1', 'trash', 'Folder'),
      originalName: 'Folder',
      originalParentId: parentId,
      removedAt,
    };

    const state: TreeNodeState = new Map([
      [existing.id, existing],
      [trashed.id, trashed],
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
      async listChildren(parent) {
        return Array.from(state.values()).filter((node) => node.parentId === parent);
      },
      bulkUpdateNodes: vi.fn(async (nodes) => {
        for (const node of nodes) {
          state.set(node.id, { ...node });
        }
      }),
    };

    const { CommandProcessor } = await import('../../CommandProcessor.js');
    const cp = new CommandProcessor(core as unknown as CoreDB);
    const env = cp.createEnvelope('restoreFromTrash', {
      nodeIds: ['t1' as NodeId],
      toParentId: parentId,
      onNameConflict: 'error',
    });
    const result = await cp.processCommand(env);
    if (result.success) {
      throw new Error('Expected restoreFromTrash to fail with NAME_NOT_UNIQUE');
    }
    const failure = result as Extract<CommandResult, { success: false }>;
    expect(failure.code).toBe('NAME_NOT_UNIQUE');
    expect(core.bulkUpdateNodes).not.toHaveBeenCalled();
    expect(state.get('t1' as NodeId)?.parentId).toBe('trash');
  });
});
