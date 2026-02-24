import 'fake-indexeddb/auto';
import type { NodeId, NodeType, TreeId } from '@hierarchidb/core-types';
import * as Comlink from 'comlink';
import { describe, expect, it, vi } from 'vitest';
import { MessageChannel, type MessagePort as NodeMessagePort } from 'worker_threads';
import { createEndpointFromMessagePort } from '~/e2e/test-utils/messagePortEndpoint';

type WorkerTestAPI = {
  getQueryAPI(): Promise<import('@hierarchidb/tree-api').TreeQueryAPI>;
  getMutationAPI(): Promise<import('@hierarchidb/tree-api').TreeMutationAPI>;
  getCommandProcessor(): Promise<import('../../services/CommandProcessor.js').CommandProcessor>;
};

type WorkerSetup = {
  client: Comlink.Remote<WorkerTestAPI>;
  port1: NodeMessagePort;
  port2: NodeMessagePort;
  terminateAll: () => void;
};
const setupWorker = async (): Promise<WorkerSetup> => {
  vi.resetModules();
  const [{ SingletonMixin }, { exposeTestAPI }] = await Promise.all([
    import('@hierarchidb/util'),
    import('~/e2e/test-worker.entry'),
  ]);
  SingletonMixin.terminateAll();
  const { port1, port2 } = new MessageChannel();
  await exposeTestAPI(createEndpointFromMessagePort(port1));
  const client = Comlink.wrap<WorkerTestAPI>(createEndpointFromMessagePort(port2));
  return {
    client,
    port1,
    port2,
    terminateAll: () => SingletonMixin.terminateAll(),
  };
};

async function waitFor<T>(
  predicate: () => T | Promise<T>,
  opts?: { timeout?: number; interval?: number }
) {
  const timeout = opts?.timeout ?? 15_000;
  const interval = opts?.interval ?? 25;
  const deadline = Date.now() + timeout;
  while (Date.now() <= deadline) {
    const result = await predicate();
    if (result) return result;
    if (Date.now() > deadline) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(`waitFor: timeout after ${timeout}ms`);
}

const runFolderUndoRedoFlow = async () => {
  const { client, port1, port2, terminateAll } = await setupWorker();

  const cleanup = async () => {
    const release = (client as { [Comlink.releaseProxy]?: () => Promise<void> })[
      Comlink.releaseProxy
    ];
    if (release) {
      await release.call(client);
    }
    port1.close();
    port2.close();
    terminateAll();
  };

  try {
    const queryAPI = await client.getQueryAPI();
    const commandProcessor = await client.getCommandProcessor();

    const treeId = 'r' as TreeId;
    const tree = await queryAPI.getTree(treeId);
    if (!tree?.rootId || !tree.archiveRootId) {
      throw new Error('expected default console with root and archive');
    }
    const rootId = tree.rootId as NodeId;
    const archiveRootId = tree.archiveRootId as NodeId;

    const createResult = await commandProcessor.processCommand(
      await commandProcessor.createEnvelope('createNode', {
        nodeType: 'folder' as NodeType,
        treeId,
        parentId: rootId,
        metadata: { name: 'UndoRedo WFL Original' },
      })
    );
    expect(createResult?.success).toBe(true);
    const nodeId = (createResult as { nodeId?: NodeId }).nodeId;
    expect(nodeId).toBeDefined();
    const resolvedNodeId = nodeId as NodeId;
    await waitFor(async () => (await queryAPI.getNode(resolvedNodeId))?.id === resolvedNodeId);

    const renameResult = await commandProcessor.processCommand(
      await commandProcessor.createEnvelope('updateNode', {
        nodeId: resolvedNodeId,
        metadata: { name: 'UndoRedo WFL Renamed' },
      })
    );
    expect(renameResult.success).toBe(true);
    await waitFor(
      async () => (await queryAPI.getNode(resolvedNodeId))?.metadata.name === 'UndoRedo WFL Renamed'
    );

    const archiveResult = await commandProcessor.processCommand(
      await commandProcessor.createEnvelope('moveToArchive', { nodeIds: [resolvedNodeId] })
    );
    expect(archiveResult.success).toBe(true);
    await waitFor(async () => {
      const node = await queryAPI.getNode(resolvedNodeId);
      return Boolean(node?.removedAt);
    });
    await waitFor(async () => {
      const archiveChildren = await queryAPI.listChildren(archiveRootId);
      return archiveChildren.some((child) => child.id === resolvedNodeId);
    });

    const restoreResult = await commandProcessor.processCommand(
      await commandProcessor.createEnvelope('restoreFromArchive', {
        nodeIds: [resolvedNodeId],
        toParentId: rootId,
        onNameConflict: 'auto-rename',
      })
    );
    expect(restoreResult.success).toBe(true);
    await waitFor(async () => {
      const node = await queryAPI.getNode(resolvedNodeId);
      return node?.parentId === rootId && node?.removedAt === undefined;
    });
    const nodeAfterRestore = await queryAPI.getNode(resolvedNodeId);
    expect(typeof nodeAfterRestore?.metadata.name).toBe('string');

    const expectInArchive = async () => {
      const node = await queryAPI.getNode(resolvedNodeId);
      expect(node?.removedAt).toBeTruthy();
      const archiveChildren = await queryAPI.listChildren(archiveRootId);
      expect(archiveChildren.some((child) => child.id === resolvedNodeId)).toBe(true);
    };

    const expectInTreeWithRenamed = async () => {
      const node = await queryAPI.getNode(resolvedNodeId);
      expect(node?.parentId).toBe(rootId);
      expect(node?.removedAt).toBeUndefined();
      expect(typeof node?.metadata.name).toBe('string');
    };

    const expectInTreeWithOriginal = async () => {
      const node = await queryAPI.getNode(resolvedNodeId);
      expect(node?.parentId).toBe(rootId);
      expect(node?.removedAt).toBeUndefined();
      expect(typeof node?.metadata.name).toBe('string');
    };

    const expectRemoved = async () => {
      await waitFor(async () => (await queryAPI.getNode(resolvedNodeId)) === undefined);
      const archiveChildren = await queryAPI.listChildren(archiveRootId);
      expect(archiveChildren.some((child) => child.id === resolvedNodeId)).toBe(false);
    };

    const undoRestore = await commandProcessor.undo();
    expect(undoRestore.success).toBe(true);
    await waitFor(async () => Boolean((await queryAPI.getNode(resolvedNodeId))?.removedAt));
    await expectInArchive();

    const undoArchive = await commandProcessor.undo();
    expect(undoArchive.success).toBe(true);
    await waitFor(async () => (await queryAPI.getNode(resolvedNodeId))?.removedAt === undefined);
    await expectInTreeWithRenamed();

    const undoRename = await commandProcessor.undo();
    expect(undoRename.success).toBe(true);
    await waitFor(async () => Boolean(await queryAPI.getNode(resolvedNodeId)));
    await expectInTreeWithOriginal();

    const undoCreate = await commandProcessor.undo();
    expect(undoCreate.success).toBe(true);
    await expectRemoved();

    const redoCreate = await commandProcessor.redo();
    expect(redoCreate.success).toBe(true);
    await waitFor(async () => Boolean(await queryAPI.getNode(resolvedNodeId)));
    await expectInTreeWithOriginal();

    const redoRename = await commandProcessor.redo();
    expect(redoRename.success).toBe(true);
    await waitFor(async () => Boolean(await queryAPI.getNode(resolvedNodeId)));
    await expectInTreeWithRenamed();

    const redoArchive = await commandProcessor.redo();
    expect(redoArchive.success).toBe(true);
    await waitFor(async () => Boolean((await queryAPI.getNode(resolvedNodeId))?.removedAt));
    await expectInArchive();

    const redoRestore = await commandProcessor.redo();
    expect(redoRestore.success).toBe(true);
    await waitFor(async () => (await queryAPI.getNode(resolvedNodeId))?.removedAt === undefined);
    await expectInTreeWithRenamed();
  } finally {
    await cleanup();
  }
};

describe('Comlink + fake-indexeddb integration: folder undo/redo flow (CommandProcessor mutations)', () => {
  it('create → rename → archive → restore sequence round-trips via undo/redo', async () => {
    await runFolderUndoRedoFlow();
  }, 35_000);
});
