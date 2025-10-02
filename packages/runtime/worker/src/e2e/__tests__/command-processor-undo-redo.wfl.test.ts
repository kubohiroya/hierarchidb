import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import * as Comlink from 'comlink';
import { MessageChannel } from 'worker_threads';
import type { NodeId, NodeType, TreeId, TreeNode } from '@hierarchidb/common-type';
import { exposeTestAPI } from '../test-worker.entry.js';

const endpointFromPort = (port: MessagePort): Comlink.Endpoint => {
  const listeners = new Map<(event: MessageEvent) => void, (value: unknown) => void>();
  return {
    postMessage(value, transfer) {
      if (transfer && transfer.length > 0) {
        port.postMessage(value, transfer);
      } else {
        port.postMessage(value);
      }
    },
    addEventListener(_type, handler) {
      const wrapped = (data: unknown) => handler({ data } as MessageEvent);
      listeners.set(handler, wrapped);
      port.on('message', wrapped);
    },
    removeEventListener(_type, handler) {
      const wrapped = listeners.get(handler);
      if (wrapped) {
        port.off('message', wrapped);
        listeners.delete(handler);
      }
    },
    start() {
      port.start?.();
    },
  };
};

type WorkerTestAPI = {
  getQueryAPI(): Promise<import('@hierarchidb/common-api').TreeQueryAPI>;
  getMutationAPI(): Promise<import('@hierarchidb/common-api').TreeMutationAPI>;
  getWorkingCopyAPI(): Promise<import('@hierarchidb/common-api').WorkingCopyAPI>;
  getCommandProcessor(): Promise<import('../../services/CommandProcessor.js').CommandProcessor>;
};

const UNDOABLE_COMMANDS = new Set([
  'createNode',
  'updateNode',
  'moveNodes',
  'moveToTrash',
  'restoreFromTrash',
  'remove',
  'commitWorkingCopy',
]);

describe('WFL command processor undo/redo flow', () => {
  it('executes core commands, undoes them, and redoes them', async () => {
    const { port1, port2 } = new MessageChannel();
    await exposeTestAPI(endpointFromPort(port1));
    const client = Comlink.wrap<WorkerTestAPI>(endpointFromPort(port2));

    const queryAPI = await client.getQueryAPI();
    const workingCopyAPI = await client.getWorkingCopyAPI();
    const commandProcessor = await client.getCommandProcessor();

    const treeId = 'r' as TreeId;
    const tree = await queryAPI.getTree(treeId);
    if (!tree?.rootId) throw new Error('Root tree not found');
    const rootId = tree.rootId as NodeId;

    const executedUndoables: string[] = [];
    const runCommand = async <K extends string, P>(kind: K, payload: P) => {
      const envelope = await commandProcessor.createEnvelope(kind, payload);
      const result = await commandProcessor.processCommand(envelope);
      expect(result.success).toBe(true);
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
      name: 'UndoRedo Target',
    });
    const moveTargetId = moveTargetRes.nodeId as NodeId;

    // create subject node under root
    const subjectRes = await runCommand('createNode', {
      nodeType: 'folder' as NodeType,
      treeId,
      parentId: rootId,
      name: 'UndoRedo Subject',
    });
    const subjectId = subjectRes.nodeId as NodeId;

    await runCommand('updateNode', { nodeId: subjectId, name: 'UndoRedo Subject Renamed' });

    await runCommand('moveNodes', { nodeIds: [subjectId], toParentId: moveTargetId, onNameConflict: 'auto-rename' });

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
      name: 'UndoRedo Remove Target',
    });
    const removeTargetId = removeTargetRes.nodeId as NodeId;

    await runCommand('remove', { nodeIds: [removeTargetId] });

    const rootChildrenBeforeCommit = new Set((await queryAPI.listChildren(rootId)).map((node) => node.id));
    const workingCopy = await workingCopyAPI.createDraftWorkingCopy('folder', rootId, { name: 'UndoRedo Draft' });
    await runCommand('commitWorkingCopy', { workingCopyId: workingCopy.id, onNameConflict: 'auto-rename' });
    const rootChildrenAfterCommit = await queryAPI.listChildren(rootId);
    const committedNode = rootChildrenAfterCommit.find((node) => !rootChildrenBeforeCommit.has(node.id));
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
    if (committedNodeId) {
      expect(await queryAPI.getNode(committedNodeId)).toBeUndefined();
    }

    // Redo the same number of commands
    const redoStackSize = await commandProcessor.getRedoStackSize();
    expect(redoStackSize).toBe(undoStackSize);

    for (let i = 0; i < redoStackSize; i++) {
      const redoResult = await commandProcessor.redo();
      expect(redoResult.success).toBe(true);
    }

    const extraRedo = await commandProcessor.redo();
    expect(extraRedo.success).toBe(false);

    const moveTargetAfterRedo = await queryAPI.getNode(moveTargetId);
    expect(moveTargetAfterRedo).toBeTruthy();
    const subjectAfterRedo = await queryAPI.getNode(subjectId);
    expect(subjectAfterRedo).toBeTruthy();
    expect(subjectAfterRedo?.parentId).toBe(moveTargetId);
    expect(subjectAfterRedo?.name).toBe('UndoRedo Subject Renamed');
    expect(await queryAPI.getNode(removeTargetId)).toBeUndefined();
    if (committedNodeId) {
      expect(await queryAPI.getNode(committedNodeId)).toBeTruthy();
    }

    // Remove subtree (non-undoable command) to cover remaining handler
    const removeSubtreeResult = await commandProcessor.processCommand(
      await commandProcessor.createEnvelope('removeSubtree', { rootId: moveTargetId }),
    );
    expect(removeSubtreeResult.success).toBe(true);
    const childrenAfterRemoveSubtree = await queryAPI.listChildren(moveTargetId);
    expect(childrenAfterRemoveSubtree.length).toBe(0);
  }, 40_000);

  it('create -> rename -> trash -> restore sequence can be undone and redone step-by-step', async () => {
    const treeId = 'r' as TreeId;
    const { port1, port2 } = new MessageChannel();
    await exposeTestAPI(endpointFromPort(port1));
    const client = Comlink.wrap<WorkerTestAPI>(endpointFromPort(port2));

    const queryAPI = await client.getQueryAPI();
    const commandProcessor = await client.getCommandProcessor();

    const tree = await queryAPI.getTree(treeId);
    if (!tree) throw new Error('Expected default tree to exist');
    const rootId = tree.rootId as NodeId;
    const trashRootId = tree.trashRootId as NodeId;

    const createResult = await commandProcessor.processCommand(
      await commandProcessor.createEnvelope('createNode', {
        nodeType: 'folder' as NodeType,
        treeId,
        parentId: rootId,
        name: 'UndoRedo Headless Original',
      }),
    );
    expect(createResult.success).toBe(true);
    const nodeId = createResult.nodeId as NodeId;

    const renameResult = await commandProcessor.processCommand(
      await commandProcessor.createEnvelope('updateNode', { nodeId, name: 'UndoRedo Headless Renamed' }),
    );
    expect(renameResult.success).toBe(true);

    const moveToTrashResult = await commandProcessor.processCommand(
      await commandProcessor.createEnvelope('moveToTrash', { nodeIds: [nodeId] }),
    );
    expect(moveToTrashResult.success).toBe(true);

    const restoreResult = await commandProcessor.processCommand(
      await commandProcessor.createEnvelope('restoreFromTrash', {
        nodeIds: [nodeId],
        toParentId: rootId,
        onNameConflict: 'auto-rename',
      }),
    );
    expect(restoreResult.success).toBe(true);

    const restoredNode = await queryAPI.getNode(nodeId);
    expect(restoredNode?.name).toBe('UndoRedo Headless Renamed');
    expect(restoredNode?.holderType).toBeUndefined();

    const trashAfterRestore = await queryAPI.listChildren(trashRootId);
    expect(trashAfterRestore.some((node) => node.id === nodeId)).toBe(false);

    // Undo: restore -> moveToTrash -> rename -> create
    const undoRestore = await commandProcessor.undo();
    expect(undoRestore.success).toBe(true);
    const nodeAfterUndoRestore = (await queryAPI.getNode(nodeId)) as TreeNode | undefined;
    expect(nodeAfterUndoRestore?.holderType).toBe('trash');
    expect(nodeAfterUndoRestore?.name).toBe('UndoRedo Headless Renamed');
    expect(nodeAfterUndoRestore?.originalName).toBe('UndoRedo Headless Renamed');
    expect(nodeAfterUndoRestore?.originalParentId).toBe(rootId);
    expect(nodeAfterUndoRestore?.parentId).toBe(trashRootId);

    const undoMoveToTrash = await commandProcessor.undo();
    expect(undoMoveToTrash.success).toBe(true);
    const nodeAfterUndoTrash = await queryAPI.getNode(nodeId);
    expect(nodeAfterUndoTrash?.holderType).toBeUndefined();
    expect(nodeAfterUndoTrash?.parentId).toBe(rootId);
    expect(nodeAfterUndoTrash?.name).toBe('UndoRedo Headless Renamed');

    const undoRename = await commandProcessor.undo();
    expect(undoRename.success).toBe(true);
    const nodeAfterUndoRename = await queryAPI.getNode(nodeId);
    expect(nodeAfterUndoRename?.name).toBe('UndoRedo Headless Original');

    const undoCreate = await commandProcessor.undo();
    expect(undoCreate.success).toBe(true);
    const nodeAfterUndoCreate = await queryAPI.getNode(nodeId);
    expect(nodeAfterUndoCreate).toBeUndefined();

    // Redo operations in original order
    const redoCreate = await commandProcessor.redo();
    expect(redoCreate.success).toBe(true);
    const nodeAfterRedoCreate = await queryAPI.getNode(nodeId);
    expect(nodeAfterRedoCreate?.name).toBe('UndoRedo Headless Original');

    const redoRename = await commandProcessor.redo();
    expect(redoRename.success).toBe(true);
    const nodeAfterRedoRename = await queryAPI.getNode(nodeId);
    expect(nodeAfterRedoRename?.name).toBe('UndoRedo Headless Renamed');

    const redoMoveToTrash = await commandProcessor.redo();
    expect(redoMoveToTrash.success).toBe(true);
    const nodeAfterRedoTrash = (await queryAPI.getNode(nodeId)) as TreeNode | undefined;
    expect(nodeAfterRedoTrash?.holderType).toBe('trash');
    expect(nodeAfterRedoTrash?.name).toBe('UndoRedo Headless Renamed');
    expect(nodeAfterRedoTrash?.originalName).toBe('UndoRedo Headless Renamed');
    expect(nodeAfterRedoTrash?.originalParentId).toBe(rootId);
    expect(nodeAfterRedoTrash?.parentId).toBe(trashRootId);

    const redoRestore = await commandProcessor.redo();
    expect(redoRestore.success).toBe(true);
    const nodeAfterRedoRestore = await queryAPI.getNode(nodeId);
    expect(nodeAfterRedoRestore?.holderType).toBeUndefined();
    expect(nodeAfterRedoRestore?.parentId).toBe(rootId);
    expect(nodeAfterRedoRestore?.name).toBe('UndoRedo Headless Renamed');

    const finalTrashState = await queryAPI.listChildren(trashRootId);
    expect(finalTrashState.some((node) => node.id === nodeId)).toBe(false);

    port1.close();
    port2.close();
  }, 20_000);
});
