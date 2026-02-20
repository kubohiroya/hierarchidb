import type { NodeId, NodeType } from '@hierarchidb/core-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandProcessor } from '../../CommandProcessor';
import type { CoreDB } from '../../CoreDB';
import type { CommandTestHarness } from '../../test-helpers/commandProcessorHarness';
import { createCommandTestHarness, seedNode } from '../../test-helpers/commandProcessorHarness';

const TX_NODE_TYPE = 'tx-test' as NodeType;

describe('transaction wrapper', () => {
  let harness: CommandTestHarness;
  let rootId: NodeId;

  beforeEach(async () => {
    (
      globalThis as typeof globalThis & { __HDB_FORCE_WORKER_TRANSACTIONS__?: boolean }
    ).__HDB_FORCE_WORKER_TRANSACTIONS__ = true;
    harness = await createCommandTestHarness('tx-wrapper');
    const [tree] = await harness.core.trees.toArray();
    rootId = (tree?.rootId ?? 'r:root') as NodeId;
  });

  afterEach(async () => {
    delete (globalThis as typeof globalThis & { __HDB_FORCE_WORKER_TRANSACTIONS__?: boolean })
      .__HDB_FORCE_WORKER_TRANSACTIONS__;
    await harness.cleanup();
  });

  it('wraps moveNodes in a transaction when CoreDB supports runInTx', async () => {
    const { core } = harness;
    const originalRunInTx = core.runInTx.bind(core);
    (core as { runInTx: typeof originalRunInTx }).runInTx = async (mode, tables, fn) => {
      return await originalRunInTx(mode, tables, fn);
    };
    const cp = new CommandProcessor(core);
    const node = await seedNode(core, {
      id: 'a' as NodeId,
      parentId: rootId,
      name: 'A',
    });
    const target = await seedNode(core, {
      id: 'p2' as NodeId,
      parentId: rootId,
      name: 'Target',
    });

    const env = cp.createEnvelope('moveNodes', {
      nodeIds: [node.id as NodeId],
      toParentId: target.id as NodeId,
    });
    const result = await cp.processCommand(env);

    expect(result.success).toBe(true);
    expect((await core.getNode(node.id as NodeId))?.parentId).toBe(target.id);
  });

  it('falls back when runInTx is unavailable', async () => {
    const { core } = harness;
    const node = await seedNode(core, {
      id: 'a' as NodeId,
      parentId: rootId,
      name: 'A',
    });
    const target = await seedNode(core, {
      id: 'p2' as NodeId,
      parentId: rootId,
      name: 'Target',
    });

    (core as { runInTx?: CoreDB['runInTx'] }).runInTx = undefined;
    const cpWithoutTx = new CommandProcessor(core);
    const env = cpWithoutTx.createEnvelope('moveNodes', {
      nodeIds: [node.id as NodeId],
      toParentId: target.id as NodeId,
    });
    const result = await cpWithoutTx.processCommand(env);

    expect(result.success).toBe(true);
    expect((await core.getNode(node.id as NodeId))?.parentId).toBe(target.id);
  });

  it('simulates rollback on failure inside transaction', async () => {
    const { core } = harness;
    const cp = new CommandProcessor(core);
    const node = await seedNode(core, {
      id: 'a' as NodeId,
      parentId: rootId,
      name: 'A',
    });
    const target = await seedNode(core, {
      id: 'p2' as NodeId,
      parentId: rootId,
      name: 'Target',
    });

    const updateSpy = vi.spyOn(core, 'updateNode').mockImplementation(async () => {
      throw new Error('simulated update failure');
    });

    const env = cp.createEnvelope('moveNodes', {
      nodeIds: [node.id as NodeId],
      toParentId: target.id as NodeId,
    });
    const result = await cp.processCommand(env);

    expect(result.success).toBe(false);
    expect((await core.getNode(node.id as NodeId))?.parentId).toBe(rootId);
    expect(updateSpy).toHaveBeenCalled();
    updateSpy.mockRestore();
  });

  it('defers peer-entity cleanup until after transaction commits', async () => {
    const { core } = harness;
    const parent = await seedNode(core, {
      id: 'tx-root' as NodeId,
      parentId: rootId,
      name: 'TX Root',
      nodeType: TX_NODE_TYPE,
    });
    const child = await seedNode(core, {
      id: 'child' as NodeId,
      parentId: parent.id as NodeId,
      name: 'Child',
      nodeType: TX_NODE_TYPE,
    });

    const originalRunInTx = core.runInTx.bind(core);
    (core as { runInTx: typeof originalRunInTx }).runInTx = async (mode, tables, fn) => {
      return await originalRunInTx(mode, tables, fn);
    };
    const cp = new CommandProcessor(core);

    const env = cp.createEnvelope('remove', { nodeIds: [child.id as NodeId] });
    const result = await cp.processCommand(env);

    expect(result.success).toBe(true);
    expect(await core.getNode(child.id as NodeId)).toBeUndefined();
  });
});
