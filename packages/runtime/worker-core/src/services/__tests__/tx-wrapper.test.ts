import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeId, NodeType, TreeNode } from '@hierarchidb/common-type';
import type { CoreDB } from '../CoreDB.js';

type CoreStub = Pick<CoreDB,
  'getNode' | 'updateNode' | 'listChildren' | 'deleteNode' | 'bulkDeleteNodes' | 'runInTx'
> & {
  state: Map<NodeId, TreeNode>;
};

function makeCore({ throwOnUpdate = false }: { throwOnUpdate?: boolean } = {}): CoreStub {
  const state = new Map<NodeId, TreeNode>();
  const listChildren = async (parentId: NodeId): Promise<TreeNode[]> =>
    Array.from(state.values()).filter((node) => node.parentId === parentId);

  const core: CoreStub = {
    state,
    getNode: vi.fn(async (id: NodeId) => state.get(id)),
    updateNode: vi.fn(async (node: Partial<TreeNode> & { id: NodeId }) => {
      if (throwOnUpdate) throw new Error('simulated update failure');
      const current = state.get(node.id);
      if (!current) {
        throw new Error(`Node ${String(node.id)} not found`);
      }
      state.set(node.id, { ...current, ...node });
    }),
    listChildren: vi.fn(listChildren),
    deleteNode: vi.fn(async (id: NodeId) => {
      state.delete(id);
    }),
    bulkDeleteNodes: vi.fn(async (ids: NodeId[]) => {
      ids.forEach((id) => state.delete(id));
    }),
    runInTx: vi.fn(async (_mode, _tables, fn) => {
      const snapshot = new Map<NodeId, TreeNode>(
        Array.from(state.entries()).map(([id, node]) => [id, { ...node }]),
      );
      try {
        return await fn();
      } catch (error) {
        state.clear();
        for (const [id, node] of snapshot) state.set(id, node);
        throw error;
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
    core.state.set('a' as NodeId, makeNode('a', 'root', 'A'));

    const { CommandProcessor } = await loadCommandProcessor();
    const cp = new CommandProcessor(core as unknown as CoreDB);

    const env = cp.createEnvelope('moveNodes', { nodeIds: ['a' as NodeId], toParentId: 'p2' as NodeId });
    const r = await cp.processCommand(env);
    expect(r.success).toBe(true);
    expect(core.runInTx).toHaveBeenCalledTimes(1);
    expect(core.state.get('a' as NodeId)?.parentId).toBe('p2');
  });

  it('falls back when runInTx is unavailable', async () => {
    const core = makeCore();
    core.state.set('a' as NodeId, makeNode('a', 'root', 'A'));
    // Simulate minimal CoreDB stub without transactional support
    // @ts-expect-error - delete to emulate legacy mocks
    delete core.runInTx;

    const { CommandProcessor } = await loadCommandProcessor();
    const cp = new CommandProcessor(core as unknown as CoreDB);

    const env = cp.createEnvelope('moveNodes', { nodeIds: ['a' as NodeId], toParentId: 'p2' as NodeId });
    const r = await cp.processCommand(env);
    expect(r.success).toBe(true);
    expect(core.runInTx).toBeUndefined();
    expect(core.state.get('a' as NodeId)?.parentId).toBe('p2');
  });

  it('simulates rollback on failure inside transaction', async () => {
    // update will throw to simulate mid-transaction failure
    const core = makeCore({ throwOnUpdate: true });
    core.state.set('a' as NodeId, makeNode('a', 'root', 'A'));

    const { CommandProcessor } = await loadCommandProcessor();
    const cp = new CommandProcessor(core as unknown as CoreDB);

    const env = cp.createEnvelope('moveNodes', { nodeIds: ['a' as NodeId], toParentId: 'p2' as NodeId });
    const r = await cp.processCommand(env);
    expect(r.success).toBe(false);
    // state should be restored to original due to rollback simulation
    expect(core.state.get('a' as NodeId)?.parentId).toBe('root');
    expect(core.runInTx).toHaveBeenCalledTimes(1);
  });

  it('defers peer-entity cleanup until after transaction commits', async () => {
    const core = makeCore();
    core.state.set('root' as NodeId, makeNode('root', 'root', 'Root'));
    core.state.set('child' as NodeId, makeNode('child', 'root', 'Child'));

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
    const cp = new CommandProcessor(core as unknown as CoreDB);

    const cpInternals = cp as unknown as { deletePeerEntitiesForNodes(nodeIds: NodeId[]): Promise<void> };

    const cleanupSpy = vi
      .spyOn(cpInternals, 'deletePeerEntitiesForNodes')
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
      expect(core.state.has('child' as NodeId)).toBe(false);
    } finally {
      cleanupSpy.mockRestore();
    }
  });
});
