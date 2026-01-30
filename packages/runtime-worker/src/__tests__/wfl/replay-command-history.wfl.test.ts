import 'fake-indexeddb/auto';
import type { NodeId, NodeType, TreeId, TreeNode } from '@hierarchidb/common-types';
import * as Comlink from 'comlink';
import { describe, expect, it } from 'vitest';
import { MessageChannel } from 'worker_threads';
import { createEndpointFromMessagePort } from '../../e2e/test-utils/messagePortEndpoint.js';
import { exposeTestAPI } from '../../e2e/test-worker.entry.js';
import { assertCommandSuccess, type CommandResultSuccess } from '../../test-utils/assertions.js';

type WorkerTestAPI = {
  getQueryAPI(): Promise<import('@hierarchidb/tree-api').TreeQueryAPI>;
  getMutationAPI(): Promise<import('@hierarchidb/tree-api').TreeMutationAPI>;
  getTreeNodeUpdaterAPI(): Promise<import('@hierarchidb/tree-api').TreeNodeUpdaterAPI>;
  getCommandProcessor(): Promise<import('../../services/CommandProcessor.js').CommandProcessor>;
};

const UNDOABLE_COMMANDS = new Set([
  'createNode',
  'updateNode',
  'moveNodes',
  'moveToTrash',
  'restoreFromTrash',
  'remove',
  'commitDraft',
]);

describe('WFL command processor undo/redo flow', () => {
  it('executes core commands, undoes them, and redoes them', async () => {
    const { port1, port2 } = new MessageChannel();
    await exposeTestAPI(createEndpointFromMessagePort(port1));
    const client = Comlink.wrap<WorkerTestAPI>(createEndpointFromMessagePort(port2));

    const queryAPI = await client.getQueryAPI();
    const updaterAPI = await client.getTreeNodeUpdaterAPI();
    const commandProcessor = await client.getCommandProcessor();

    const treeId = 'r' as TreeId;
    const tree = await queryAPI.getTree(treeId);
    if (!tree?.rootId) throw new Error('Root console not found');
    const rootId = tree.rootId as NodeId;

    const executedUndoables: string[] = [];
    const runCommand = async <K extends string, P>(
      kind: K,
      payload: P
    ): Promise<CommandResultSuccess> => {
      const envelope = await commandProcessor.createEnvelope(kind, payload);
      const result = await commandProcessor.processCommand(envelope);
      assertCommandSuccess(result, kind);
      if (UNDOABLE_COMMANDS.has(kind)) {
        executedUndoables.push(kind);
      }
      return result;
    };

    // create subtree root that will host the subject node
    const moveTargetRes = await runCommand('createNode', {
      nodeType: 'folder' as NodeType,
      treeId,
      parentId: rootId,
      metadata: { name: 'UndoRedo Target' },
    });
    const moveTargetId = moveTargetRes.nodeId as NodeId;

    // create subject node under root
    const subjectRes = await runCommand('createNode', {
      nodeType: 'folder' as NodeType,
      treeId,
      parentId: rootId,
      metadata: { name: 'UndoRedo Subject' },
    });
    const subjectId = subjectRes.nodeId as NodeId;

    await runCommand('updateNode', {
      nodeId: subjectId,
      metadata: { name: 'UndoRedo Subject Renamed' },
    });

    await runCommand('moveNodes', {
      nodeIds: [subjectId],
      toParentId: moveTargetId,
      onNameConflict: 'auto-rename',
    });

    await runCommand('moveToTrash', { nodeIds: [subjectId] });

    await runCommand('restoreFromTrash', {
      nodeIds: [subjectId],
      toParentId: moveTargetId,
      onNameConflict: 'auto-rename',
    });

    const removeTargetRes = await runCommand('createNode', {
      nodeType: 'folder' as NodeType,
      treeId,
      parentId: rootId,
      metadata: { name: 'UndoRedo Remove Target' },
    });
    const removeTargetId = removeTargetRes.nodeId as NodeId;

    await runCommand('remove', { nodeIds: [removeTargetId] });

    const rootChildrenBeforeCommit = new Set(
      (await queryAPI.listChildren(rootId)).map((node) => node.id)
    );
    const draftId = await updaterAPI.initTreeNode('folder' as NodeType, rootId, {
      metadata: { name: 'UndoRedo Draft' },
    } as Partial<TreeNode>);
    await updaterAPI.updateTreeNodeDraftMetadata(draftId.id as NodeId, { name: 'UndoRedo Draft' });
    await runCommand('commitDraft', {
      draftId: draftId.id,
      onNameConflict: 'auto-rename',
    });
    const rootChildrenAfterCommit = await queryAPI.listChildren(rootId);
    const committedNode = rootChildrenAfterCommit.find(
      (node) => !rootChildrenBeforeCommit.has(node.id)
    );
    const committedNodeId = committedNode?.id as NodeId | undefined;
    expect(committedNodeId).toBeDefined();

    const stateBeforeUndo = {
      moveTarget: await queryAPI.getNode(moveTargetId),
      subject: await queryAPI.getNode(subjectId),
      removeTarget: await queryAPI.getNode(removeTargetId),
      committedNode: committedNodeId ? await queryAPI.getNode(committedNodeId) : undefined,
    };
    expect(stateBeforeUndo.moveTarget).toBeTruthy();
    expect(stateBeforeUndo.subject).toBeTruthy();
    expect(stateBeforeUndo.removeTarget).toBeUndefined();
    expect(stateBeforeUndo.committedNode).toBeTruthy();

    // Undo all undoable commands
    const undoStackSize = await commandProcessor.getUndoStackSize();
    expect(undoStackSize).toBeGreaterThan(0);

    for (let i = 0; i < undoStackSize; i++) {
      const undoResult = await commandProcessor.undo();
      expect(undoResult.success).toBe(true);
    }

    const extraUndo = await commandProcessor.undo();
    expect(extraUndo.success).toBe(false);

    expect(await queryAPI.getNode(moveTargetId)).toBeUndefined();
    expect(await queryAPI.getNode(subjectId)).toBeUndefined();
    expect(await queryAPI.getNode(removeTargetId)).toBeUndefined();
    const committedAfterUndo = committedNodeId
      ? await queryAPI.getNode(committedNodeId)
      : undefined;
    expect(committedAfterUndo).toBeTruthy();

    // Redo the same number of commands
    const redoStackSize = await commandProcessor.getRedoStackSize();
    expect(redoStackSize).toBe(undoStackSize);

    for (let i = 0; i < redoStackSize; i++) {
      const redoResult = await commandProcessor.redo();
      if (!redoResult.success) {
        break;
      }
    }

    const extraRedo = await commandProcessor.redo();
    expect(extraRedo.success).toBe(false);

    const moveTargetAfterRedo = await queryAPI.getNode(moveTargetId);
    expect(moveTargetAfterRedo).toBeTruthy();
    const subjectAfterRedo = await queryAPI.getNode(subjectId);
    expect(subjectAfterRedo).toBeTruthy();
    expect(subjectAfterRedo?.parentId).toBe(moveTargetId);
    expect(subjectAfterRedo?.metadata.name).toBe('UndoRedo Subject Renamed');
    expect(await queryAPI.getNode(removeTargetId)).toBeUndefined();
    if (committedNodeId) {
      expect(await queryAPI.getNode(committedNodeId)).toBeTruthy();
    }

    // Remove subtree (non-undoable command) to cover remaining handler
    const removeSubtreeResult = await commandProcessor.processCommand(
      await commandProcessor.createEnvelope('removeSubtree', { rootId: moveTargetId })
    );
    expect(removeSubtreeResult.success).toBe(true);
    const childrenAfterRemoveSubtree = await queryAPI.listChildren(moveTargetId);
    expect(childrenAfterRemoveSubtree.length).toBe(0);
  }, 40_000);

  it('create -> rename -> trash -> restore sequence can be undone and redone step-by-step', async () => {
    const treeId = 'r' as TreeId;
    const { port1, port2 } = new MessageChannel();
    await exposeTestAPI(createEndpointFromMessagePort(port1));
    const client = Comlink.wrap<WorkerTestAPI>(createEndpointFromMessagePort(port2));

    const queryAPI = await client.getQueryAPI();
    const commandProcessor = await client.getCommandProcessor();

    const tree = await queryAPI.getTree(treeId);
    if (!tree) throw new Error('Expected default console to exist');
    const rootId = tree.rootId as NodeId;
    const trashRootId = tree.trashRootId as NodeId;

    const createResult = await commandProcessor.processCommand(
      await commandProcessor.createEnvelope('createNode', {
        nodeType: 'folder' as NodeType,
        treeId,
        parentId: rootId,
        metadata: { name: 'UndoRedo Headless Original' },
      })
    );
    assertCommandSuccess(createResult, 'createNode');
    const nodeId = createResult.nodeId as NodeId;

    const renameResult = await commandProcessor.processCommand(
      await commandProcessor.createEnvelope('updateNode', {
        nodeId,
        metadata: { name: 'UndoRedo Headless Renamed' },
      })
    );
    assertCommandSuccess(renameResult, 'updateNode');

    const moveToTrashResult = await commandProcessor.processCommand(
      await commandProcessor.createEnvelope('moveToTrash', { nodeIds: [nodeId] })
    );
    assertCommandSuccess(moveToTrashResult, 'moveToTrash');

    const restoreResult = await commandProcessor.processCommand(
      await commandProcessor.createEnvelope('restoreFromTrash', {
        nodeIds: [nodeId],
        toParentId: rootId,
        onNameConflict: 'auto-rename',
      })
    );
    expect(restoreResult.success).toBe(true);

    const restoredNode = await queryAPI.getNode(nodeId);
    expect(typeof restoredNode?.metadata.name).toBe('string');
    expect(restoredNode?.removedAt).toBeUndefined();

    const trashAfterRestore = await queryAPI.listChildren(trashRootId);
    expect(trashAfterRestore.some((node) => node.id === nodeId)).toBe(false);

    // Undo: restore -> moveToTrash -> rename -> create
    const undoRestore = await commandProcessor.undo();
    expect(undoRestore.success).toBe(true);
    const nodeAfterUndoRestore = (await queryAPI.getNode(nodeId)) as TreeNode | undefined;
    expect(nodeAfterUndoRestore?.removedAt).toBeTruthy();
    expect(nodeAfterUndoRestore?.originalName).toBe('UndoRedo Headless Renamed');
    expect(typeof nodeAfterUndoRestore?.metadata.name).toBe('string');
    expect(nodeAfterUndoRestore?.metadata.name).not.toBe(nodeAfterUndoRestore?.originalName);
    expect(nodeAfterUndoRestore?.originalParentId).toBe(rootId);
    expect(nodeAfterUndoRestore?.parentId).toBe(trashRootId);

    const undoMoveToTrash = await commandProcessor.undo();
    expect(undoMoveToTrash.success).toBe(true);
    const nodeAfterUndoTrash = await queryAPI.getNode(nodeId);
    expect(nodeAfterUndoTrash?.removedAt).toBeUndefined();
    expect(nodeAfterUndoTrash?.parentId).toBe(rootId);
    expect(typeof nodeAfterUndoTrash?.metadata.name).toBe('string');

    const undoRename = await commandProcessor.undo();
    expect(undoRename.success).toBe(true);
    const nodeAfterUndoRename = await queryAPI.getNode(nodeId);
    expect(typeof nodeAfterUndoRename?.metadata.name).toBe('string');

    const undoCreate = await commandProcessor.undo();
    expect(undoCreate.success).toBe(true);
    const nodeAfterUndoCreate = await queryAPI.getNode(nodeId);
    expect(nodeAfterUndoCreate).toBeUndefined();

    // Redo operations in original order
    const redoCreate = await commandProcessor.redo();
    expect(redoCreate.success).toBe(true);
    const nodeAfterRedoCreate = await queryAPI.getNode(nodeId);
    expect(typeof nodeAfterRedoCreate?.metadata.name).toBe('string');

    const redoRename = await commandProcessor.redo();
    expect(redoRename.success).toBe(true);
    const nodeAfterRedoRename = await queryAPI.getNode(nodeId);
    expect(typeof nodeAfterRedoRename?.metadata.name).toBe('string');

    const redoMoveToTrash = await commandProcessor.redo();
    expect(redoMoveToTrash.success).toBe(true);
    const nodeAfterRedoTrash = (await queryAPI.getNode(nodeId)) as TreeNode | undefined;
    expect(nodeAfterRedoTrash?.removedAt).toBeTruthy();
    expect(nodeAfterRedoTrash?.originalName).toBe('UndoRedo Headless Renamed');
    expect(typeof nodeAfterRedoTrash?.metadata.name).toBe('string');
    expect(nodeAfterRedoTrash?.originalParentId).toBe(rootId);
    expect(nodeAfterRedoTrash?.parentId).toBe(trashRootId);

    const redoRestore = await commandProcessor.redo();
    expect(redoRestore.success).toBe(true);
    const nodeAfterRedoRestore = await queryAPI.getNode(nodeId);
    expect(nodeAfterRedoRestore?.removedAt).toBeUndefined();
    expect(nodeAfterRedoRestore?.parentId).toBe(rootId);
    expect(typeof nodeAfterRedoRestore?.metadata.name).toBe('string');

    const finalTrashState = await queryAPI.listChildren(trashRootId);
    expect(finalTrashState.some((node) => node.id === nodeId)).toBe(false);

    port1.close();
    port2.close();
  }, 20_000);
});
