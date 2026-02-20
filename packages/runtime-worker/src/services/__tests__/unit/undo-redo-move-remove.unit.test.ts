import type { NodeId } from '@hierarchidb/core-types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CommandTestHarness } from '../../test-helpers/commandProcessorHarness';
import { createCommandTestHarness, seedNode } from '../../test-helpers/commandProcessorHarness';

describe('Undo/Redo for moveNodes and remove', () => {
  let harness: CommandTestHarness;
  let rootId: NodeId;
  let moveTargetId: NodeId;

  beforeEach(async () => {
    harness = await createCommandTestHarness('undo-redo-move-remove');
    const [tree] = await harness.core.trees.toArray();
    rootId = (tree?.rootId ?? 'r:root') as NodeId;
    moveTargetId = (
      await seedNode(harness.core, {
        id: 'p2' as NodeId,
        parentId: rootId,
        name: 'P2',
      })
    ).id as NodeId;

    await seedNode(harness.core, {
      id: 'a' as NodeId,
      parentId: rootId,
      name: 'A',
    });
    await seedNode(harness.core, {
      id: 'b' as NodeId,
      parentId: rootId,
      name: 'B',
    });
  });

  afterEach(async () => {
    await harness.cleanup();
  });

  it('undo/redo moveNodes', async () => {
    const { core, cp } = harness;
    const env = cp.createEnvelope('moveNodes', {
      nodeIds: ['a' as NodeId],
      toParentId: moveTargetId,
    });
    const result = await cp.processCommand(env);
    expect(result.success).toBe(true);
    expect((await core.getNode('a' as NodeId))?.parentId).toBe(moveTargetId);

    const undoResult = await cp.undo();
    expect(undoResult.success).toBe(true);
    expect((await core.getNode('a' as NodeId))?.parentId).toBe(rootId);

    const redoResult = await cp.redo();
    expect(redoResult.success).toBe(true);
    expect((await core.getNode('a' as NodeId))?.parentId).toBe(moveTargetId);
  });

  it('undo/redo remove', async () => {
    const { core, cp } = harness;
    const env = cp.createEnvelope('remove', { nodeIds: ['b' as NodeId] });
    const result = await cp.processCommand(env);
    expect(result.success).toBe(true);
    expect(await core.getNode('b' as NodeId)).toBeUndefined();

    const undoResult = await cp.undo();
    expect(undoResult.success).toBe(true);
    expect(await core.getNode('b' as NodeId)).toBeTruthy();

    const redoResult = await cp.redo();
    expect(redoResult.success).toBe(true);
    expect(await core.getNode('b' as NodeId)).toBeUndefined();
  });
});
