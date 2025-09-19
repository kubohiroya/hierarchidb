import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeId, NodeType, TreeNode } from '@hierarchidb/common-type';

type CoreStub = {
  state: Record<string, TreeNode>;
  getNode: (id: NodeId) => Promise<TreeNode | undefined>;
  updateNode: (node: Partial<TreeNode> & { id: NodeId }) => Promise<void>;
  listChildren: (parentId: NodeId) => Promise<TreeNode[]>;
  deleteNode: (id: NodeId) => Promise<void>;
  bulkDeleteNodes: (ids: NodeId[]) => Promise<void>;
  runInTx: (mode: 'r' | 'rw', tables: string[], fn: () => Promise<any>) => Promise<any>;
};

function makeCore({ throwOnUpdate = false }: { throwOnUpdate?: boolean } = {}): CoreStub {
  const state: Record<string, TreeNode> = Object.create(null);
  const core: CoreStub = {
    state,
    getNode: vi.fn(async (id: NodeId) => state[id]),
    updateNode: vi.fn(async (node: Partial<TreeNode> & { id: NodeId }) => {
      if (throwOnUpdate) throw new Error('simulated update failure');
      state[node.id] = { ...(state[node.id] as any), ...node } as TreeNode;
    }),
    listChildren: vi.fn(async (parentId: NodeId) => Object.values(state).filter((n) => n.parentId === parentId)),
    deleteNode: vi.fn(async (id: NodeId) => {
      delete state[id];
    }),
    bulkDeleteNodes: vi.fn(async (ids: NodeId[]) => {
      for (const id of ids) delete state[id];
    }),
    runInTx: vi.fn(async (_mode, _tables, fn) => {
      // naive rollback simulation: snapshot, run, on error restore
      const snapshot = JSON.parse(JSON.stringify(state));
      try {
        const r = await fn();
        return r;
      } catch (e) {
        // restore snapshot
        for (const k of Object.keys(state)) delete (state as any)[k];
        Object.assign(state, snapshot);
        throw e;
      }
    }),
  };
  return core;
}

async function loadCommandProcessor() {
  vi.resetModules();
  const { CommandProcessor } = await import('~/services/CommandProcessor');
  return { CommandProcessor };
}

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

describe('transaction wrapper', () => {

  it('wraps moveNodes in a transaction when CoreDB supports runInTx', async () => {
    const core = makeCore();
    core.state['a'] = makeNode('a', 'root', 'A');

    const { CommandProcessor } = await loadCommandProcessor();
    const cp = new CommandProcessor(core as any);

    const env = cp.createEnvelope('moveNodes', { nodeIds: ['a' as NodeId], toParentId: 'p2' as NodeId });
    const r = await cp.processCommand(env);
    expect(r.success).toBe(true);
    expect(core.runInTx).toHaveBeenCalledTimes(1);
    expect(core.state['a'].parentId).toBe('p2');
  });

  it('falls back when runInTx is unavailable', async () => {
    const core = makeCore();
    core.state['a'] = makeNode('a', 'root', 'A');
    // Simulate minimal CoreDB stub without transactional support
    // @ts-expect-error - delete to emulate legacy mocks
    delete core.runInTx;

    const { CommandProcessor } = await loadCommandProcessor();
    const cp = new CommandProcessor(core as any);

    const env = cp.createEnvelope('moveNodes', { nodeIds: ['a' as NodeId], toParentId: 'p2' as NodeId });
    const r = await cp.processCommand(env);
    expect(r.success).toBe(true);
    expect(core.runInTx).toBeUndefined();
    expect(core.state['a'].parentId).toBe('p2');
  });

  it('simulates rollback on failure inside transaction', async () => {
    // update will throw to simulate mid-transaction failure
    const core = makeCore({ throwOnUpdate: true });
    core.state['a'] = makeNode('a', 'root', 'A');

    const { CommandProcessor } = await loadCommandProcessor();
    const cp = new CommandProcessor(core as any);

    const env = cp.createEnvelope('moveNodes', { nodeIds: ['a' as NodeId], toParentId: 'p2' as NodeId });
    const r = await cp.processCommand(env);
    expect(r.success).toBe(false);
    // state should be restored to original due to rollback simulation
    expect(core.state['a'].parentId).toBe('root');
    expect(core.runInTx).toHaveBeenCalledTimes(1);
  });

  it('defers peer-entity cleanup until after transaction commits', async () => {
    const core = makeCore();
    core.state['root'] = makeNode('root', 'root', 'Root');
    core.state['child'] = makeNode('child', 'root', 'Child');

    let inTx = false;
    let invokedDuringTx = false;
    const baseRunInTx = core.runInTx;
    core.runInTx = vi.fn(async (mode, tables, fn) => {
      inTx = true;
      try {
        return await baseRunInTx(mode, tables, fn);
      } finally {
        inTx = false;
      }
    });

    const { CommandProcessor } = await loadCommandProcessor();
    const cp = new CommandProcessor(core as any);

    const cleanupSpy = vi
      .spyOn(cp as any, 'deletePeerEntitiesForNodes')
      .mockImplementation(async () => {
        if (inTx) invokedDuringTx = true;
      });

    try {
      const env = cp.createEnvelope('remove', { nodeIds: ['child' as NodeId] });
      const result = await cp.processCommand(env);

      expect(result.success).toBe(true);
      expect(core.runInTx).toHaveBeenCalledTimes(1);
      expect(cleanupSpy).toHaveBeenCalledTimes(1);
      expect(invokedDuringTx).toBe(false);
      expect(core.state['child']).toBeUndefined();
    } finally {
      cleanupSpy.mockRestore();
    }
  });
});
