import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import * as Comlink from 'comlink';
import { MessageChannel } from 'worker_threads';
import type { NodeId, TreeId, TreeNode, TreeChangeEvent, SubscriptionId } from '@hierarchidb/common-type';
import { withWorkerFlagEnvOverrides } from '../utils/worker-flag-helpers.js';

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
  getSubscriptionAPI(): Promise<import('@hierarchidb/common-api').TreeSubscriptionAPI>;
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

const waitForNodeEventDuring = async <T>(
  subscriptionAPI: import('@hierarchidb/common-api').TreeSubscriptionAPI,
  nodeId: NodeId,
  action: () => Promise<T>,
  predicate?: (event: TreeChangeEvent) => boolean,
  opts?: { timeout?: number; interval?: number },
): Promise<{ result: T; event: TreeChangeEvent }> => {
  let matched: TreeChangeEvent | undefined;
  const handler = Comlink.proxy((event: TreeChangeEvent) => {
    if (!matched && (predicate ? predicate(event) : true)) {
      matched = event;
    }
  });

  const subscriptionId: SubscriptionId = await subscriptionAPI.subscribeNode(nodeId, handler);
  try {
    const result = await action();
    const event = await waitFor(() => matched, opts);
    return { result, event };
  } finally {
    await subscriptionAPI.unsubscribe(subscriptionId);
    const release = (handler as unknown as { [Comlink.releaseProxy]?: () => Promise<void> })[Comlink.releaseProxy];
    if (typeof release === 'function') {
      await release.call(handler);
    }
  }
};

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
  restoreEnv: () => void;
};

const setupWorker = async (flagValue: '0' | '1'): Promise<WorkerSetup> => {
  vi.resetModules();
  const restoreEnv = withWorkerFlagEnvOverrides({ [WORKER_FLAG]: flagValue });
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
    restoreEnv,
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
    const { client, port1, port2, terminateAll, restoreEnv } = await setupWorker(flagValue);

    try {
      const queryAPI = await client.getQueryAPI();
      const mutationAPI = await client.getMutationAPI();
      const commandProcessor = await client.getCommandProcessor();
      const subscriptionAPI = await client.getSubscriptionAPI();

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
      await waitForNodeEventDuring(
        subscriptionAPI,
        sourceId,
        async () => {
          const renameEnvelope = await commandProcessor.createEnvelope('updateNode', {
            nodeId: sourceId,
            name: updatedName,
          });
          const renameResult = await commandProcessor.processCommand(renameEnvelope);
          if (!renameResult.success) {
            console.error('[cp-routing-wc.wfl] rename failed', renameResult);
          }
          expect(renameResult.success).toBe(true);
          return renameResult;
        },
      );
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

      const { result: moveResult } = await waitForNodeEventDuring(
        subscriptionAPI,
        sourceId,
        () =>
          mutationAPI.moveNodes({
            nodeIds: [sourceId],
            toParentId: destinationId,
            onNameConflict: 'auto-rename',
          }),
      );
      expect(moveResult.success).toBe(true);

      await waitFor(async () => {
        const children = await queryAPI.listChildren(destinationId);
        return children.some((child) => child.id === sourceId);
      });

      const movedNode = await queryAPI.getNode(sourceId);
      expect(movedNode?.parentId).toBe(destinationId);

      const { result: trashResult } = await waitForNodeEventDuring(
        subscriptionAPI,
        sourceId,
        () => mutationAPI.moveNodesToTrash([sourceId]),
      );
      expect(trashResult.success).toBe(true);

      const trashedNode = await waitFor(async () => {
        const trashChildren = await queryAPI.listChildren(trashRootId);
        return trashChildren.find((node) => node.id === sourceId);
      });
      expect(trashedNode).toBeDefined();
      const trashed = trashedNode as TreeNode;
      expect(trashed.parentId).toBe(trashRootId);
      expect(trashed.holderType).toBe('trash');
      expect(trashed.originalParentId).toBe(destinationId);
      expect(trashed.originalName).toBe(updatedName);

      const { result: restoreResult } = await waitForNodeEventDuring(
        subscriptionAPI,
        sourceId,
        () => mutationAPI.restoreNodesFromTrash({ nodeIds: [sourceId], toParentId: rootId }),
      );
      expect(restoreResult.success).toBe(true);

      await waitFor(async () => {
        const children = await queryAPI.listChildren(rootId);
        return children.some((child) => child.id === sourceId);
      });

      const restoredNode = await queryAPI.getNode(sourceId);
      expect(restoredNode?.parentId).toBe(rootId);
    } finally {
      restoreEnv();
      terminateAll();
      const release = (client as unknown as { [Comlink.releaseProxy]?: () => Promise<void> })[Comlink.releaseProxy];
      if (release) {
        await release.call(client);
      }
      port1.close();
      port2.close();
    }
  }, 30_000);

  it('supports undo/redo across create, move, trash, restore, and remove', async () => {
    const { client, port1, port2, terminateAll, restoreEnv } = await setupWorker(flagValue);

    try {
      const queryAPI = await client.getQueryAPI();
      const commandProcessor = await client.getCommandProcessor();
      const subscriptionAPI = await client.getSubscriptionAPI();

      const trees = await queryAPI.listTrees();
      expect(trees.length).toBeGreaterThan(0);
      const treeId = (trees[0]?.id ?? 'r') as TreeId;
      const tree = await queryAPI.getTree(treeId);
      if (!tree?.rootId || !tree.trashRootId) {
        throw new Error('Tree roots not available');
      }
      const rootId = tree.rootId as NodeId;
      const trashRootId = tree.trashRootId as NodeId;

      const runCommand = async <K extends string, P>(
        kind: K,
        payload: P,
        opts?: { expectNodeId?: NodeId },
      ) => {
        const execute = async () => {
          const envelope = await commandProcessor.createEnvelope(kind, payload as P);
          return commandProcessor.processCommand(envelope);
        };
        if (opts?.expectNodeId) {
          const { result } = await waitForNodeEventDuring(
            subscriptionAPI,
            opts.expectNodeId,
            async () => {
              const outcome = await execute();
              expect(outcome.success).toBe(true);
              return outcome;
            },
          );
          return { result: result as { nodeId?: NodeId } } as const;
        }
        const result = await execute();
        expect(result.success).toBe(true);
        return { result: result as { nodeId?: NodeId } } as const;
      };

      const { result: destinationRes } = await runCommand('createNode', {
        nodeType: 'folder' as const,
        treeId,
        parentId: rootId,
        name: `Undo Destination ${flagValue}`,
      });
      const destinationId = destinationRes.nodeId as NodeId;
      await waitFor(() => queryAPI.getNode(destinationId));

      const { result: subjectRes } = await runCommand('createNode', {
        nodeType: 'folder' as const,
        treeId,
        parentId: rootId,
        name: `Undo Subject ${flagValue}`,
      });
      const subjectId = subjectRes.nodeId as NodeId;
      await waitFor(() => queryAPI.getNode(subjectId));

      const renamed = `Undo Subject Renamed ${flagValue}`;
      await runCommand('updateNode', { nodeId: subjectId, name: renamed }, { expectNodeId: subjectId });
      await waitFor(async () => (await queryAPI.getNode(subjectId))?.name === renamed);

      await runCommand(
        'moveNodes',
        {
          nodeIds: [subjectId],
          toParentId: destinationId,
          onNameConflict: 'auto-rename' as const,
        },
        { expectNodeId: subjectId },
      );
      await waitFor(async () => (await queryAPI.getNode(subjectId))?.parentId === destinationId);

      await runCommand('moveToTrash', { nodeIds: [subjectId] }, { expectNodeId: subjectId });
      const trashedNode = (await waitFor(async () => {
        const node = await queryAPI.getNode(subjectId);
        return node?.holderType === 'trash' ? node : undefined;
      })) as TreeNode;
      expect(trashedNode.parentId).toBe(trashRootId);
      expect(trashedNode.originalParentId).toBe(destinationId);
      expect(trashedNode.originalName).toBe(renamed);

      await runCommand(
        'restoreFromTrash',
        {
          nodeIds: [subjectId],
          toParentId: rootId,
          onNameConflict: 'auto-rename' as const,
        },
        { expectNodeId: subjectId },
      );
      await waitFor(async () => (await queryAPI.getNode(subjectId))?.parentId === rootId);

      await runCommand('remove', { nodeIds: [subjectId] }, { expectNodeId: subjectId });
      await waitFor(async () => (await queryAPI.getNode(subjectId)) === undefined);

      const expectNameStartsWith = async (
        fetcher: () => Promise<import('@hierarchidb/common-type').TreeNode | undefined>,
        expectedPrefix: string,
      ) => {
        const node = await waitFor(fetcher);
        expect(node?.name.startsWith(expectedPrefix)).toBe(true);
        return node;
      };

      const expectInRootRenamed = async () => {
        const node = await expectNameStartsWith(() => queryAPI.getNode(subjectId), renamed);
        expect(node?.parentId).toBe(rootId);
        expect(node?.holderType).toBeUndefined();
      };

      const expectInTrash = async () => {
        const node = (await waitFor(async () => {
          const current = await queryAPI.getNode(subjectId);
          return current?.holderType === 'trash' ? current : undefined;
        })) as TreeNode;
        expect(node.parentId).toBe(trashRootId);
        expect(node.originalParentId).toBe(destinationId);
        expect(node.originalName).toBe(renamed);
      };

      const expectInDestination = async () => {
        const node = await expectNameStartsWith(() => queryAPI.getNode(subjectId), renamed);
        expect(node?.parentId).toBe(destinationId);
      };

      const expectOriginalName = async () => {
        const node = await waitFor(() => queryAPI.getNode(subjectId));
        expect(node?.parentId).toBe(rootId);
        expect(node?.name).toBe(`Undo Subject ${flagValue}`);
      };

      const undoStack = await commandProcessor.getUndoStackSize();
      expect(undoStack).toBeGreaterThanOrEqual(6);

      let result = await commandProcessor.undo(); // undo remove
      expect(result.success).toBe(true);
      await expectInRootRenamed();

      result = await commandProcessor.undo(); // undo restoreFromTrash
      expect(result.success).toBe(true);
      await expectInTrash();

      result = await commandProcessor.undo(); // undo moveToTrash
      expect(result.success).toBe(true);
      await expectInDestination();

      result = await commandProcessor.undo(); // undo moveNodes
      expect(result.success).toBe(true);
      await waitFor(async () => (await queryAPI.getNode(subjectId))?.parentId === rootId);

      result = await commandProcessor.undo(); // undo updateNode
      expect(result.success).toBe(true);
      await expectOriginalName();

      result = await commandProcessor.undo(); // undo createNode
      expect(result.success).toBe(true);
      await waitFor(async () => (await queryAPI.getNode(subjectId)) === undefined);

      result = await commandProcessor.redo(); // redo createNode
      expect(result.success).toBe(true);
      await waitFor(() => queryAPI.getNode(subjectId));

      result = await commandProcessor.redo(); // redo updateNode
      expect(result.success).toBe(true);
      await waitFor(async () => (await queryAPI.getNode(subjectId))?.name === renamed);

      result = await commandProcessor.redo(); // redo moveNodes
      expect(result.success).toBe(true);
      await expectInDestination();

      result = await commandProcessor.redo(); // redo moveToTrash
      expect(result.success).toBe(true);
      await expectInTrash();

      result = await commandProcessor.redo(); // redo restoreFromTrash
      expect(result.success).toBe(true);
      await expectInRootRenamed();

      result = await commandProcessor.redo(); // redo remove
      expect(result.success).toBe(true);
      await waitFor(async () => (await queryAPI.getNode(subjectId)) === undefined);
    } finally {
      restoreEnv();
      terminateAll();
      const release = (client as unknown as { [Comlink.releaseProxy]?: () => Promise<void> })[Comlink.releaseProxy];
      if (release) {
        await release.call(client);
      }
      port1.close();
      port2.close();
    }
  }, 40_000);

  it('times out when the subscribed node does not emit a change event', async () => {
    const { client, port1, port2, terminateAll, restoreEnv } = await setupWorker(flagValue);

    try {
      const queryAPI = await client.getQueryAPI();
      const mutationAPI = await client.getMutationAPI();
      const commandProcessor = await client.getCommandProcessor();
      const subscriptionAPI = await client.getSubscriptionAPI();

      const trees = await queryAPI.listTrees();
      expect(trees.length).toBeGreaterThan(0);
      const treeId = (trees[0]?.id ?? 'r') as TreeId;
      const tree = await queryAPI.getTree(treeId);
      if (!tree?.rootId) {
        throw new Error('Tree root not available');
      }

      const rootId = tree.rootId as NodeId;
      await waitFor(() => queryAPI.getNode(rootId));

      const idleNodeId = await createAndCommit(
        mutationAPI,
        commandProcessor,
        queryAPI,
        treeId,
        rootId,
        `Timeout Subject ${flagValue}`,
      );

      await expect(
        waitForNodeEventDuring(
          subscriptionAPI,
          idleNodeId,
          async () => 'noop',
          undefined,
          { timeout: 200, interval: 10 },
        ),
      ).rejects.toThrow(/timeout/);
    } finally {
      restoreEnv();
      terminateAll();
      const release = (client as unknown as { [Comlink.releaseProxy]?: () => Promise<void> })[Comlink.releaseProxy];
      if (release) {
        await release.call(client);
      }
      port1.close();
      port2.close();
    }
  }, 10_000);
});
