import type { NodeId } from '@hierarchidb/core-types';
import type { CommandResult } from '@hierarchidb/tree-api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommandTestHarness } from '../../test-helpers/commandProcessorHarness.js';
import { createCommandTestHarness, seedNode } from '../../test-helpers/commandProcessorHarness.js';

describe('CommandProcessor bulk operations', () => {
  let harness: CommandTestHarness;
  let rootId: NodeId;
  let trashRootId: NodeId;
  let superRootId: NodeId;

  beforeEach(async () => {
    harness = await createCommandTestHarness('bulk-ops');
    const [tree] = await harness.core.trees.toArray();
    rootId = (tree?.rootId ?? 'r:root') as NodeId;
    trashRootId = (tree?.trashRootId ?? 'r:trash') as NodeId;
    superRootId = (tree?.superRootId ?? 'r:superRoot') as NodeId;
  });

  afterEach(async () => {
    await harness.cleanup();
  });

  it('moveNodes uses bulkUpdateNodes for multiple nodes', async () => {
    const { core, cp } = harness;
    const targetParent = await seedNode(core, {
      id: 'p2' as NodeId,
      parentId: superRootId,
      name: 'Target',
    });
    const nodeA = await seedNode(core, {
      id: 'a' as NodeId,
      parentId: rootId,
      name: 'A',
    });
    const nodeB = await seedNode(core, {
      id: 'b' as NodeId,
      parentId: rootId,
      name: 'B',
    });

    const bulkSpy = vi.spyOn(core, 'bulkUpdateNodes');
    const singleSpy = vi.spyOn(core, 'updateNode');

    const env = cp.createEnvelope('moveNodes', {
      nodeIds: [nodeA.id as NodeId, nodeB.id as NodeId],
      toParentId: targetParent.id as NodeId,
    });
    const result = await cp.processCommand(env);

    expect(result.success).toBe(true);
    expect(bulkSpy).toHaveBeenCalled();
    expect(singleSpy).not.toHaveBeenCalled();
    expect((await core.getNode(nodeA.id as NodeId))?.parentId).toBe(targetParent.id);
    expect((await core.getNode(nodeB.id as NodeId))?.parentId).toBe(targetParent.id);
  });

  it('remove uses bulkDeleteNodes for multiple nodes', async () => {
    const { core, cp } = harness;
    const parent = await seedNode(core, {
      id: 'folder-root' as NodeId,
      parentId: rootId,
      name: 'Folder Root',
    });
    const nodeA = await seedNode(core, {
      id: 'a' as NodeId,
      parentId: parent.id as NodeId,
      name: 'A',
    });
    const nodeB = await seedNode(core, {
      id: 'b' as NodeId,
      parentId: parent.id as NodeId,
      name: 'B',
    });

    const bulkDeleteSpy = vi.spyOn(core, 'bulkDeleteNodes');
    const singleDeleteSpy = vi.spyOn(core, 'deleteNode');

    const env = cp.createEnvelope('remove', { nodeIds: [nodeA.id as NodeId, nodeB.id as NodeId] });
    const result = await cp.processCommand(env);

    expect(result.success).toBe(true);
    expect(bulkDeleteSpy).toHaveBeenCalled();
    expect(singleDeleteSpy).not.toHaveBeenCalled();
    expect(await core.getNode(nodeA.id as NodeId)).toBeUndefined();
    expect(await core.getNode(nodeB.id as NodeId)).toBeUndefined();
  });

  it('restoreFromTrash uses bulkUpdateNodes for multiple nodes (without holders)', async () => {
    const { core, cp } = harness;
    const parent = await seedNode(core, {
      id: 'folder-root' as NodeId,
      parentId: rootId,
      name: 'Folder Root',
    });

    const trashed1 = await seedNode(core, {
      id: 't1' as NodeId,
      parentId: trashRootId,
      name: 'Trash Node 1',
      originalName: 'n1',
      originalParentId: parent.id as NodeId,
      removedAt: Date.now(),
    });
    const trashed2 = await seedNode(core, {
      id: 't2' as NodeId,
      parentId: trashRootId,
      name: 'Trash Node 2',
      originalName: 'n2',
      originalParentId: parent.id as NodeId,
      removedAt: Date.now(),
    });

    const bulkUpdateSpy = vi.spyOn(core, 'bulkUpdateNodes');
    const bulkDeleteSpy = vi.spyOn(core, 'bulkDeleteNodes');

    const env = cp.createEnvelope('restoreFromTrash', {
      nodeIds: [trashed1.id as NodeId, trashed2.id as NodeId],
      toParentId: parent.id as NodeId,
    });
    const result = await cp.processCommand(env);

    expect(result.success).toBe(true);
    expect(bulkUpdateSpy).toHaveBeenCalled();
    expect(bulkDeleteSpy).not.toHaveBeenCalled();

    const restored1 = await core.getNode(trashed1.id as NodeId);
    const restored2 = await core.getNode(trashed2.id as NodeId);
    expect(restored1?.parentId).toBe(parent.id);
    expect(restored2?.parentId).toBe(parent.id);
    expect(restored1?.removedAt).toBeUndefined();
    expect(restored2?.removedAt).toBeUndefined();
  });

  it('restoreFromTrash auto-renames conflicting nodes when requested', async () => {
    const { core, cp } = harness;
    const parent = await seedNode(core, {
      id: 'restore-parent' as NodeId,
      parentId: rootId,
      name: 'Parent',
    });
    await seedNode(core, {
      id: 'existing' as NodeId,
      parentId: parent.id as NodeId,
      name: 'Folder',
    });

    const trashed1 = await seedNode(core, {
      id: 't1' as NodeId,
      parentId: trashRootId,
      name: 'Trash Node 1',
      originalName: 'Folder',
      originalParentId: parent.id as NodeId,
      removedAt: Date.now(),
    });
    const trashed2 = await seedNode(core, {
      id: 't2' as NodeId,
      parentId: trashRootId,
      name: 'Trash Node 2',
      originalName: 'Folder',
      originalParentId: parent.id as NodeId,
      removedAt: Date.now(),
    });

    const bulkUpdateSpy = vi.spyOn(core, 'bulkUpdateNodes');

    const env = cp.createEnvelope('restoreFromTrash', {
      nodeIds: [trashed1.id as NodeId, trashed2.id as NodeId],
      toParentId: parent.id as NodeId,
      onNameConflict: 'auto-rename',
    });
    const result = await cp.processCommand(env);

    expect(result.success).toBe(true);
    expect(bulkUpdateSpy).toHaveBeenCalled();

    const restoredNames = [
      (await core.getNode(trashed1.id as NodeId))?.metadata.name,
      (await core.getNode(trashed2.id as NodeId))?.metadata.name,
    ].filter((name): name is string => typeof name === 'string');

    expect(new Set(restoredNames).size).toBe(2);
    expect(restoredNames.every((name) => name.length > 0)).toBe(true);
  });

  it('restoreFromTrash returns NAME_NOT_UNIQUE when conflicts remain and policy is error', async () => {
    const { core, cp } = harness;
    const parent = await seedNode(core, {
      id: 'restore-parent' as NodeId,
      parentId: rootId,
      name: 'Parent',
    });
    await seedNode(core, {
      id: 'existing' as NodeId,
      parentId: parent.id as NodeId,
      name: 'Folder',
    });

    const trashed = await seedNode(core, {
      id: 't1' as NodeId,
      parentId: trashRootId,
      name: 'Trash Node',
      originalName: 'Folder',
      originalParentId: parent.id as NodeId,
      removedAt: Date.now(),
    });

    const bulkUpdateSpy = vi.spyOn(core, 'bulkUpdateNodes');

    const env = cp.createEnvelope('restoreFromTrash', {
      nodeIds: [trashed.id as NodeId],
      toParentId: parent.id as NodeId,
      onNameConflict: 'error',
    });
    const result = await cp.processCommand(env);

    expect(result.success).toBe(false);
    const failure = result as Extract<CommandResult, { success: false }>;
    expect(failure.code).toBe('NAME_NOT_UNIQUE');
    expect(bulkUpdateSpy).not.toHaveBeenCalled();
    expect((await core.getNode(trashed.id as NodeId))?.parentId).toBe(trashRootId);
  });
});
