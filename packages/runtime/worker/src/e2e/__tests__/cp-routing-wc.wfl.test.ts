import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import * as Comlink from 'comlink';
import { MessageChannel } from 'worker_threads';
import type { NodeId, TreeId } from '@hierarchidb/common-type';
import { decodeTrashHolderName, isValidTrashHolderName } from '../../services/utils/holder-encoding.js';

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

type TestWorkerAPI = {
  getQueryAPI(): Promise<import('@hierarchidb/common-api').TreeQueryAPI>;
  getMutationAPI(): Promise<import('@hierarchidb/common-api').TreeMutationAPI>;
  getCommandProcessor(): Promise<import('../../services/CommandProcessor.js').CommandProcessor>;
};

async function waitFor<T>(predicate: () => T | Promise<T>, opts?: { timeout?: number; interval?: number }) {
  const timeout = opts?.timeout ?? 10_000;
  const interval = opts?.interval ?? 25;
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const value = await predicate();
    if (value) return value;
    if (Date.now() - start > timeout) throw new Error('waitFor: timeout');
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

type Scenario = {
  label: string;
  flagValue: '0' | '1';
};

const scenarios: Scenario[] = [
  { label: 'legacy routing (flag off)', flagValue: '0' },
  { label: 'CommandProcessor routing (flag on)', flagValue: '1' },
];

const WORKER_FLAG = 'WORKER_USE_CMDPROC_MOVE_REMOVE';

type WorkerSetup = {
  client: Comlink.Remote<TestWorkerAPI>;
  port1: MessagePort;
  port2: MessagePort;
  terminateAll: () => void;
};

const setupWorker = async (flagValue: '0' | '1'): Promise<WorkerSetup> => {
  vi.resetModules();
  process.env[WORKER_FLAG] = flagValue;
  const [{ SingletonMixin }, { exposeTestAPI }] = await Promise.all([
    import('@hierarchidb/util'),
    import('../test-worker.entry.js'),
  ]);
  SingletonMixin.terminateAll();
  const { port1, port2 } = new MessageChannel();
  await exposeTestAPI(endpointFromPort(port1));
  const client = Comlink.wrap<TestWorkerAPI>(endpointFromPort(port2));
  return {
    client,
    port1,
    port2,
    terminateAll: () => SingletonMixin.terminateAll(),
  };
};

const createAndCommit = async (
  mutationAPI: import('@hierarchidb/common-api').TreeMutationAPI,
  commandProcessor: import('../../services/CommandProcessor.js').CommandProcessor,
  queryAPI: import('@hierarchidb/common-api').TreeQueryAPI,
  treeId: TreeId,
  parentId: NodeId,
  name: string,
): Promise<NodeId> => {
  const createResult = await mutationAPI.createNode({
    nodeType: 'folder',
    treeId,
    parentId,
    name,
  });
  expect(createResult?.success).toBe(true);
  if (!createResult?.nodeId) throw new Error('createNode did not provide nodeId');

  const workingCopyId = createResult.nodeId as NodeId;
  const commitEnvelope = await commandProcessor.createEnvelope('commitWorkingCopy', {
    workingCopyId,
    onNameConflict: 'auto-rename' as const,
  });
  const commitResult = await commandProcessor.processCommand(commitEnvelope);
  expect(commitResult.success).toBe(true);
  const canonicalId = commitResult.nodeId as NodeId;

  await waitFor(async () => queryAPI.getNode(canonicalId));
  return canonicalId;
};

describe.each(scenarios)('Comlink CP routing batch flow ($label)', ({ flagValue }) => {
  it('handles create, update, move, trash, and restore via Worker API', async () => {
    const { client, port1, port2, terminateAll } = await setupWorker(flagValue);

    try {
      const queryAPI = await client.getQueryAPI();
      const mutationAPI = await client.getMutationAPI();
      const commandProcessor = await client.getCommandProcessor();

      const trees = await queryAPI.listTrees();
      expect(trees.length).toBeGreaterThan(0);
      const treeId = (trees[0]?.id ?? 'r') as TreeId;
      const tree = await queryAPI.getTree(treeId);
      if (!tree?.rootId || !tree.trashRootId) {
        throw new Error('Tree roots not available');
      }
      const rootId = tree.rootId as NodeId;
      const trashRootId = tree.trashRootId as NodeId;

      await waitFor(async () => queryAPI.getNode(rootId));
      await waitFor(async () => queryAPI.getNode(trashRootId));

      const sourceId = await createAndCommit(mutationAPI, commandProcessor, queryAPI, treeId, rootId, 'CP Flow Source');

      const updatedName = `CP Flow Source Updated ${flagValue}`;
      const renameEnvelope = await commandProcessor.createEnvelope('updateNode', {
        nodeId: sourceId,
        name: updatedName,
      });
      const renameResult = await commandProcessor.processCommand(renameEnvelope);
      if (!renameResult.success) {
        console.error('[cp-routing-wc.wfl] rename failed', renameResult);
      }
      expect(renameResult.success).toBe(true);
      await waitFor(async () => {
        const node = await queryAPI.getNode(sourceId);
        return node?.name === updatedName;
      });

      const destinationId = await createAndCommit(
        mutationAPI,
        commandProcessor,
        queryAPI,
        treeId,
        rootId,
        'CP Flow Destination',
      );

      const moveResult = await mutationAPI.moveNodes({
        nodeIds: [sourceId],
        toParentId: destinationId,
        onNameConflict: 'auto-rename',
      });
      expect(moveResult.success).toBe(true);

      await waitFor(async () => {
        const children = await queryAPI.listChildren(destinationId);
        return children.some((child) => child.id === sourceId);
      });

      const movedNode = await queryAPI.getNode(sourceId);
      expect(movedNode?.parentId).toBe(destinationId);

      const trashResult = await mutationAPI.moveNodesToTrash([sourceId]);
      expect(trashResult.success).toBe(true);

      const holderId = await waitFor(async () => {
        const trashChildren = await queryAPI.listChildren(trashRootId);
        for (const node of trashChildren) {
          if (node.id === sourceId) {
            return trashRootId; // direct placement without holder
          }
          if (node.nodeType !== 'trash' || !isValidTrashHolderName(node.name)) continue;
          const decoded = decodeTrashHolderName(node.name);
          if (decoded.trashedNodeId === sourceId) {
            return node.id as NodeId;
          }
        }
        return undefined;
      });
      expect(holderId).toBeTruthy();

      const restoreResult = await mutationAPI.restoreNodesFromTrash({ nodeIds: [sourceId], toParentId: rootId });
      expect(restoreResult.success).toBe(true);

      await waitFor(async () => {
        const children = await queryAPI.listChildren(rootId);
        return children.some((child) => child.id === sourceId);
      });

      const restoredNode = await queryAPI.getNode(sourceId);
      expect(restoredNode?.parentId).toBe(rootId);
    } finally {
      delete process.env[WORKER_FLAG];
      terminateAll();
      const release = (client as unknown as { [Comlink.releaseProxy]?: () => Promise<void> })[Comlink.releaseProxy];
      if (release) {
        await release.call(client);
      }
      port1.close();
      port2.close();
    }
  }, 30_000);
});
