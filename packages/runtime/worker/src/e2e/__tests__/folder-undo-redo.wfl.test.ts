import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import * as Comlink from 'comlink';
import { MessageChannel } from 'worker_threads';
import type { NodeId, NodeType, TreeId } from '@hierarchidb/common-type';

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
  getCommandProcessor(): Promise<import('../../services/CommandProcessor.js').CommandProcessor>;
};

const WORKER_FLAG = 'WORKER_USE_CMDPROC_MOVE_REMOVE';

type WorkerSetup = {
  client: Comlink.Remote<WorkerTestAPI>;
  port1: MessagePort;
  port2: MessagePort;
  terminateAll: () => void;
  restoreEnv: () => void;
};

const setupWorker = async (flagValue: '0' | '1'): Promise<WorkerSetup> => {
  vi.resetModules();
  const previousValue = process.env[WORKER_FLAG];
  process.env[WORKER_FLAG] = flagValue;
  const [{ SingletonMixin }, { exposeTestAPI }] = await Promise.all([
    import('@hierarchidb/util'),
    import('../test-worker.entry.js'),
  ]);
  SingletonMixin.terminateAll();
  const { port1, port2 } = new MessageChannel();
  await exposeTestAPI(endpointFromPort(port1));
  const client = Comlink.wrap<WorkerTestAPI>(endpointFromPort(port2));
  return {
    client,
    port1,
    port2,
    terminateAll: () => SingletonMixin.terminateAll(),
    restoreEnv: () => {
      if (previousValue === undefined) {
        delete process.env[WORKER_FLAG];
      } else {
        process.env[WORKER_FLAG] = previousValue;
      }
    },
  };
};

async function waitFor<T>(predicate: () => T | Promise<T>, opts?: { timeout?: number; interval?: number }) {
  const timeout = opts?.timeout ?? 10_000;
  const interval = opts?.interval ?? 25;
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = await predicate();
    if (result) return result;
    if (Date.now() - start > timeout) {
      throw new Error('waitFor: timeout');
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

const runFolderUndoRedoFlow = async (flagValue: '0' | '1') => {
  const { client, port1, port2, terminateAll, restoreEnv } = await setupWorker(flagValue);

  const cleanup = async () => {
    const release = (client as unknown as { [Comlink.releaseProxy]?: () => Promise<void> })[Comlink.releaseProxy];
    if (release) {
      await release.call(client);
    }
    port1.close();
    port2.close();
    terminateAll();
    restoreEnv();
  };

  try {
    const queryAPI = await client.getQueryAPI();
    const commandProcessor = await client.getCommandProcessor();
    const mutationAPI = await client.getMutationAPI();

    const treeId = 'r' as TreeId;
    const tree = await queryAPI.getTree(treeId);
      if (!tree?.rootId || !tree.trashRootId) {
        throw new Error('expected default tree with root and trash');
      }
      const rootId = tree.rootId as NodeId;
      const trashRootId = tree.trashRootId as NodeId;

    const useCommandProcessor = flagValue === '1';

    const createResult = useCommandProcessor
      ? await commandProcessor.processCommand(
          await commandProcessor.createEnvelope('createNode', {
            nodeType: 'folder' as NodeType,
            treeId,
            parentId: rootId,
            name: 'UndoRedo WFL Original',
          }),
        )
      : await mutationAPI.createNode({
          nodeType: 'folder' as NodeType,
          treeId,
          parentId: rootId,
          name: 'UndoRedo WFL Original',
        });
    expect(createResult?.success).toBe(true);
    const nodeId = (createResult as { nodeId?: NodeId }).nodeId as NodeId | undefined;
      expect(nodeId).toBeDefined();
      await waitFor(async () => (await queryAPI.getNode(nodeId!))?.id === nodeId);

    const renameResult = useCommandProcessor
      ? await commandProcessor.processCommand(
          await commandProcessor.createEnvelope('updateNode', {
            nodeId: nodeId!,
            name: 'UndoRedo WFL Renamed',
          }),
        )
      : await mutationAPI.updateNode({ nodeId: nodeId!, name: 'UndoRedo WFL Renamed' });
      expect(renameResult.success).toBe(true);
      await waitFor(async () => (await queryAPI.getNode(nodeId!))?.name === 'UndoRedo WFL Renamed');

    const trashResult = useCommandProcessor
      ? await commandProcessor.processCommand(
          await commandProcessor.createEnvelope('moveToTrash', { nodeIds: [nodeId!] }),
        )
      : await mutationAPI.moveNodesToTrash([nodeId!]);
      expect(trashResult.success).toBe(true);
      await waitFor(async () => {
        const node = await queryAPI.getNode(nodeId!);
        return node?.holderType === 'trash';
      });
      await waitFor(async () => {
        const trashChildren = await queryAPI.listChildren(trashRootId);
        return trashChildren.some((child) => child.id === nodeId);
      });

    const restoreResult = useCommandProcessor
      ? await commandProcessor.processCommand(
          await commandProcessor.createEnvelope('restoreFromTrash', {
            nodeIds: [nodeId!],
            toParentId: rootId,
            onNameConflict: 'auto-rename',
          }),
        )
      : await mutationAPI.restoreNodesFromTrash({
          nodeIds: [nodeId!],
          toParentId: rootId,
          onNameConflict: 'auto-rename',
        });
      expect(restoreResult.success).toBe(true);
      await waitFor(async () => {
        const node = await queryAPI.getNode(nodeId!);
        return node?.parentId === rootId && node?.holderType === undefined;
      });
      const nodeAfterRestore = await queryAPI.getNode(nodeId!);
      expect(nodeAfterRestore?.name).toBe('UndoRedo WFL Renamed');

      const expectInTrash = async () => {
        const node = await queryAPI.getNode(nodeId!);
        expect(node?.holderType).toBe('trash');
        const trashChildren = await queryAPI.listChildren(trashRootId);
        expect(trashChildren.some((child) => child.id === nodeId)).toBe(true);
      };

      const expectInTreeWithRenamed = async () => {
        const node = await queryAPI.getNode(nodeId!);
        expect(node?.parentId).toBe(rootId);
        expect(node?.holderType).toBeUndefined();
        expect(node?.name).toBe('UndoRedo WFL Renamed');
      };

      const expectInTreeWithOriginal = async () => {
        const node = await queryAPI.getNode(nodeId!);
        expect(node?.parentId).toBe(rootId);
        expect(node?.holderType).toBeUndefined();
        expect(node?.name).toBe('UndoRedo WFL Original');
      };

      const expectRemoved = async () => {
        await waitFor(async () => (await queryAPI.getNode(nodeId!)) === undefined);
        const trashChildren = await queryAPI.listChildren(trashRootId);
        expect(trashChildren.some((child) => child.id === nodeId)).toBe(false);
      };

      const undoRestore = await commandProcessor.undo();
      expect(undoRestore.success).toBe(true);
      await waitFor(async () => (await queryAPI.getNode(nodeId!))?.holderType === 'trash');
      await expectInTrash();

      const undoTrash = await commandProcessor.undo();
      expect(undoTrash.success).toBe(true);
      await waitFor(async () => (await queryAPI.getNode(nodeId!))?.holderType === undefined);
      await expectInTreeWithRenamed();

      const undoRename = await commandProcessor.undo();
      expect(undoRename.success).toBe(true);
      await waitFor(async () => (await queryAPI.getNode(nodeId!))?.name === 'UndoRedo WFL Original');
      await expectInTreeWithOriginal();

      const undoCreate = await commandProcessor.undo();
      expect(undoCreate.success).toBe(true);
      await expectRemoved();

      const redoCreate = await commandProcessor.redo();
      expect(redoCreate.success).toBe(true);
      await waitFor(async () => (await queryAPI.getNode(nodeId!))?.name === 'UndoRedo WFL Original');
      await expectInTreeWithOriginal();

      const redoRename = await commandProcessor.redo();
      expect(redoRename.success).toBe(true);
      await waitFor(async () => (await queryAPI.getNode(nodeId!))?.name === 'UndoRedo WFL Renamed');
      await expectInTreeWithRenamed();

      const redoTrash = await commandProcessor.redo();
      expect(redoTrash.success).toBe(true);
      await waitFor(async () => (await queryAPI.getNode(nodeId!))?.holderType === 'trash');
      await expectInTrash();

      const redoRestore = await commandProcessor.redo();
      expect(redoRestore.success).toBe(true);
      await waitFor(async () => (await queryAPI.getNode(nodeId!))?.holderType === undefined);
      await expectInTreeWithRenamed();

  } finally {
    await cleanup();
  }
};

// Legacy path is on track for removal; keep the scenario documented but skipped.
describe.skip('Comlink + fake-indexeddb integration: folder undo/redo flow (legacy mutations)', () => {
  it('create → rename → trash → restore sequence round-trips via undo/redo', async () => {
    await runFolderUndoRedoFlow('0');
  }, 35_000);
});

describe('Comlink + fake-indexeddb integration: folder undo/redo flow (CommandProcessor mutations)', () => {
  it('create → rename → trash → restore sequence round-trips via undo/redo', async () => {
    await runFolderUndoRedoFlow('1');
  }, 35_000);
});
