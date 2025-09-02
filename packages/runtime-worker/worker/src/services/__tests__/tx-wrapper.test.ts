import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NodeId, NodeType, TreeNode } from '@hierarchidb/common-type';

type CoreStub = {
  state: Record<string, TreeNode>;
  getNode: (id: NodeId) => Promise<TreeNode | undefined>;
  updateNode: (node: Partial<TreeNode> & { id: NodeId }) => Promise<void>;
  listChildren: (parentId: NodeId) => Promise<TreeNode[]>;
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

async function loadCPWithFlag(flag: '0' | '1') {
  vi.resetModules();
  (process as any).env.WORKER_TX_ENABLED = flag;
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

describe('WORKER_TX_ENABLED wrapper', () => {
  beforeEach(() => {
    delete (process as any).env.WORKER_TX_ENABLED;
  });

  it('wraps moveNodes in runInTx when flag ON', async () => {
    const core = makeCore();
    core.state['a'] = makeNode('a', 'root', 'A');

    const { CommandProcessor } = await loadCPWithFlag('1');
    const cp = new CommandProcessor(core as any);

    const env = cp.createEnvelope('moveNodes', { nodeIds: ['a' as NodeId], toParentId: 'p2' as NodeId });
    const r = await cp.processCommand(env);
    expect(r.success).toBe(true);
    expect(core.runInTx).toHaveBeenCalledTimes(1);
    expect(core.state['a'].parentId).toBe('p2');
  });

  it('does not call runInTx when flag OFF', async () => {
    const core = makeCore();
    core.state['a'] = makeNode('a', 'root', 'A');

    const { CommandProcessor } = await loadCPWithFlag('0');
    const cp = new CommandProcessor(core as any);

    const env = cp.createEnvelope('moveNodes', { nodeIds: ['a' as NodeId], toParentId: 'p2' as NodeId });
    const r = await cp.processCommand(env);
    expect(r.success).toBe(true);
    expect(core.runInTx).not.toHaveBeenCalled();
    expect(core.state['a'].parentId).toBe('p2');
  });

  it('simulates rollback on failure inside transaction', async () => {
    // update will throw to simulate mid-transaction failure
    const core = makeCore({ throwOnUpdate: true });
    core.state['a'] = makeNode('a', 'root', 'A');

    const { CommandProcessor } = await loadCPWithFlag('1');
    const cp = new CommandProcessor(core as any);

    const env = cp.createEnvelope('moveNodes', { nodeIds: ['a' as NodeId], toParentId: 'p2' as NodeId });
    const r = await cp.processCommand(env);
    expect(r.success).toBe(false);
    // state should be restored to original due to rollback simulation
    expect(core.state['a'].parentId).toBe('root');
    expect(core.runInTx).toHaveBeenCalledTimes(1);
  });
});

