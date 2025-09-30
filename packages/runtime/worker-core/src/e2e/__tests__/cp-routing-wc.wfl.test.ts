import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import * as Comlink from 'comlink';
import { MessageChannel } from 'worker_threads';
import type { NodeId, TreeId } from '@hierarchidb/common-type';
import {
  decodeWorkingCopyHolderName,
  decodeTrashHolderName,
  isValidTrashHolderName,
} from '../../services/utils/holder-encoding.js';
import { exposeTestAPI } from '../test-worker.entry.js';
import { SingletonMixin } from '@hierarchidb/util';

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
  getWorkingCopyAPI(): Promise<import('@hierarchidb/common-api').WorkingCopyAPI>;
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

const createAndCommit = async (
  mutationAPI: import('@hierarchidb/common-api').TreeMutationAPI,
  workingCopyAPI: import('@hierarchidb/common-api').WorkingCopyAPI,
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

  const wcNodeId = createResult.nodeId as NodeId;
  const workingCopy = await waitFor(async () => queryAPI.getNode(wcNodeId));
  if (!workingCopy?.parentId) throw new Error('working copy holder missing');
  const holder = await queryAPI.getNode(workingCopy.parentId as NodeId);
  if (!holder) throw new Error('working copy holder not found');
  const { targetNodeId } = decodeWorkingCopyHolderName(holder.name);
  const canonicalId = targetNodeId as NodeId;

  const commitResult = await workingCopyAPI.commitWorkingCopy(wcNodeId);
  expect(commitResult.status).toBe('ok');

  await waitFor(async () => {
    const committed = await queryAPI.getNode(canonicalId);
    return committed ?? undefined;
  });

  return canonicalId;
};

describe.each(scenarios)('Comlink CP routing batch flow ($label)', ({ flagValue }) => {
  it('handles create, update, move, trash, and restore via Worker API', async () => {
    SingletonMixin.terminateAll();
    process.env[WORKER_FLAG] = flagValue;

    const { port1, port2 } = new MessageChannel();
    await exposeTestAPI(endpointFromPort(port1));
    const client = Comlink.wrap<TestWorkerAPI>(endpointFromPort(port2));

    try {
      const queryAPI = await client.getQueryAPI();
      const mutationAPI = await client.getMutationAPI();
      const workingCopyAPI = await client.getWorkingCopyAPI();

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

      const sourceId = await createAndCommit(mutationAPI, workingCopyAPI, queryAPI, treeId, rootId, 'CP Flow Source');

      await workingCopyAPI.createWorkingCopyFromNode(sourceId);
      await workingCopyAPI.updateWorkingCopy(sourceId, { name: 'CP Flow Source Updated' } as Partial<import('@hierarchidb/common-type').TreeNode>);
      const renameResult = await workingCopyAPI.commitWorkingCopy(sourceId);
      expect(renameResult.status).toBe('ok');
      await waitFor(async () => {
        const node = await queryAPI.getNode(sourceId);
        return node?.name === 'CP Flow Source Updated';
      });

      const destinationId = await createAndCommit(
        mutationAPI,
        workingCopyAPI,
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
      SingletonMixin.terminateAll();
      const release = (client as unknown as { [Comlink.releaseProxy]?: () => Promise<void> })[Comlink.releaseProxy];
      if (release) {
        await release.call(client);
      }
      port1.close();
      port2.close();
    }
  }, 30_000);
});
