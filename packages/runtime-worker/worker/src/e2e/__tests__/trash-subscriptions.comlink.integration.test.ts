import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import * as Comlink from 'comlink';
import { MessageChannel } from 'worker_threads';
import type { NodeId, TreeId } from '@hierarchidb/common-type';
import { decodeTrashHolderName, decodeWorkingCopyHolderName, isValidTrashHolderName } from '../../services/utils/holder-encoding.js';
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

type TestWorkerAPI = {
  ping(): Promise<{ response: string; timestamp: number }>;
  getQueryAPI(): Promise<import('@hierarchidb/common-api').TreeQueryAPI>;
  getMutationAPI(): Promise<import('@hierarchidb/common-api').TreeMutationAPI>;
  getSubscriptionAPI(): Promise<import('@hierarchidb/common-api').TreeSubscriptionAPI>;
  getWorkingCopyAPI(): Promise<import('@hierarchidb/common-api').WorkingCopyAPI>;
};

type SubscriptionEvent = Record<string, unknown> & { nodeId?: NodeId; type?: string };

async function waitFor<T>(predicate: () => T | Promise<T>, opts?: { timeout?: number; interval?: number }) {
  const timeout = opts?.timeout ?? 10000;
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

describe('Comlink + fake-indexeddb integration: subtree/trash subscriptions', () => {
  it('subscribes subtree and trash, creates/moves/deletes with expected notifications', async () => {
    const { port1, port2 } = new MessageChannel();
    await exposeTestAPI(endpointFromPort(port1));
    const client = Comlink.wrap<TestWorkerAPI>(endpointFromPort(port2));

    const queryAPI = await client.getQueryAPI();
    const mutationAPI = await client.getMutationAPI();
    const subscriptionAPI = await client.getSubscriptionAPI();
    const wcAPI = await client.getWorkingCopyAPI();

    const treeId = 'r' as TreeId;
    const tree = await queryAPI.getTree(treeId);
    expect(tree?.rootId).toBeDefined();
    expect(tree?.trashRootId).toBeDefined();

    if (!tree?.rootId || !tree.trashRootId) {
      throw new Error('Expected tree roots to be defined');
    }
    const rootId = tree.rootId as NodeId;
    const trashRootId = tree.trashRootId as NodeId;

    const subtreeEvents: SubscriptionEvent[] = [];
    const trashEvents: SubscriptionEvent[] = [];

    const subtreeSid = await subscriptionAPI.subscribeSubtree(
      rootId,
      Comlink.proxy((event: SubscriptionEvent) => { subtreeEvents.push(event); }),
    );
    const trashSid = await subscriptionAPI.subscribeSubtree(
      trashRootId,
      Comlink.proxy((event: SubscriptionEvent) => { trashEvents.push(event); }),
    );

    const createRes = await mutationAPI.createNode({ nodeType: 'folder', treeId, parentId: rootId, name: 'tmp' });
    expect(createRes?.success).toBe(true);
    if (!createRes?.nodeId) throw new Error('createNode did not return nodeId');
    const wcNodeId = createRes.nodeId as NodeId;

    const wcNode = await queryAPI.getNode(wcNodeId);
    expect(wcNode).toBeTruthy();
    if (!wcNode) throw new Error('Working copy node missing');
    const wcHolder = await queryAPI.getNode(wcNode.parentId as NodeId);
    expect(wcHolder).toBeTruthy();
    if (!wcHolder) throw new Error('Working copy holder missing');

    const { targetNodeId } = decodeWorkingCopyHolderName(wcHolder.name);
    const canonicalId = targetNodeId as NodeId;

    const commitRes = await wcAPI.commitWorkingCopy(wcNodeId);
    expect(commitRes?.success).toBe(true);

    await waitFor(() =>
      subtreeEvents.some(
        (event) => event?.nodeId === canonicalId && typeof event.type === 'string',
      ),
    );

    const mvRes = await mutationAPI.moveNodesToTrash([canonicalId]);
    if (!mvRes?.success) {
      throw new Error(`moveNodesToTrash failed: ${JSON.stringify(mvRes)}`);
    }

    await waitFor(() => trashEvents.length > 0);

    const afterRootChildren = await queryAPI.listChildren(rootId);
    const afterTrashChildren = await queryAPI.listChildren(trashRootId);
    expect(afterRootChildren.some((node) => node.id === canonicalId)).toBe(false);

    const holder = afterTrashChildren.find(
      (node) =>
        node.nodeType === 'trash' &&
        isValidTrashHolderName(node.name) &&
        decodeTrashHolderName(node.name).trashedNodeId === canonicalId,
    );
    expect(holder).toBeTruthy();
    if (!holder) throw new Error('Trash holder not found');

    const nodesUnderHolder = await queryAPI.listChildren(holder.id as NodeId);
    expect(nodesUnderHolder.some((node) => node.id === canonicalId)).toBe(true);

    const delAll = await mutationAPI.removeSubtree(trashRootId);
    expect(delAll?.success).toBe(true);

    await waitFor(async () => {
      const remaining = await queryAPI.listDescendants(trashRootId);
      return remaining.length === 0;
    });

    const finalDesc = await queryAPI.listDescendants(trashRootId);
    expect(finalDesc.length).toBe(0);
    const finalChildren = await queryAPI.listChildren(trashRootId);
    expect(finalChildren.length).toBe(0);

    await subscriptionAPI.unsubscribe(subtreeSid);
    await subscriptionAPI.unsubscribe(trashSid);
  }, 30_000);
});
