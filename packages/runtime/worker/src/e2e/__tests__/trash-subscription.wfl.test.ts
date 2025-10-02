import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import * as Comlink from 'comlink';
import { MessageChannel } from 'worker_threads';
import type { NodeId, TreeId } from '@hierarchidb/common-type';
import { decodeWorkingCopyHolderName } from '../../services/utils/holder-encoding.js';
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
    const trashNodeEvents: SubscriptionEvent[] = [];

    const subtreeSid = await subscriptionAPI.subscribeSubtree(
      rootId,
      Comlink.proxy((event: SubscriptionEvent) => { subtreeEvents.push(event); }),
    );
    const trashSid = await subscriptionAPI.subscribeSubtree(
      trashRootId,
      Comlink.proxy((event: SubscriptionEvent) => { trashEvents.push(event); }),
    );
    const trashNodeSid = await subscriptionAPI.subscribeNode(
      trashRootId,
      Comlink.proxy((event: SubscriptionEvent) => { trashNodeEvents.push(event); }),
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
    expect(commitRes?.status).toBe('ok');

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

    const trashedNode = afterTrashChildren.find((node) => node.id === canonicalId);
    expect(trashedNode).toBeTruthy();
    if (!trashedNode) throw new Error('Trashed node not found');
    expect(trashedNode.holderType).toBe('trash');
    expect(trashedNode.name).toBe('tmp');
    expect(trashedNode.originalName).toBe('tmp');
    expect(trashedNode.originalParentId).toBe(rootId);

    const subtreeEventsBeforeRestore = subtreeEvents.length;
    const restoreRes = await mutationAPI.restoreNodesFromTrash({ nodeIds: [canonicalId], toParentId: rootId });
    expect(restoreRes?.success).toBe(true);

    await waitFor(async () => {
      const rootChildrenAfterRestore = await queryAPI.listChildren(rootId);
      return rootChildrenAfterRestore.some((node) => node.id === canonicalId);
    });

    await waitFor(() => subtreeEvents.length > subtreeEventsBeforeRestore);

    const trashChildrenAfterRestore = await queryAPI.listChildren(trashRootId);
    expect(trashChildrenAfterRestore.some((node) => node.id === canonicalId)).toBe(false);

    const trashEventsBeforeSecondMove = trashEvents.length;
    const subtreeEventsBeforeSecondMove = subtreeEvents.length;
    const moveAgainRes = await mutationAPI.moveNodesToTrash([canonicalId]);
    if (!moveAgainRes?.success) {
      throw new Error(`moveNodesToTrash (second) failed: ${JSON.stringify(moveAgainRes)}`);
    }

    await waitFor(() =>
      subtreeEvents
        .slice(subtreeEventsBeforeSecondMove)
        .some(
          (event) =>
            (event.nodeId === canonicalId && (event.type === 'moved' || event.type === 'deleted')) ||
            (event.nodeId === rootId && event.type === 'updated'),
        ),
    );

    const afterSecondRootChildren = await queryAPI.listChildren(rootId);
    expect(afterSecondRootChildren.some((node) => node.id === canonicalId)).toBe(false);

    const afterSecondTrashChildren = await queryAPI.listChildren(trashRootId);
    const trashedAgain = afterSecondTrashChildren.find((node) => node.id === canonicalId);
    expect(trashedAgain).toBeTruthy();
    if (!trashedAgain) throw new Error('Trashed node (second) not found');
    expect(trashedAgain.holderType).toBe('trash');
    expect(trashedAgain.name).toBe('tmp');
    expect(trashedAgain.originalName).toBe('tmp');
    expect(trashedAgain.originalParentId).toBe(rootId);

    await waitFor(() => trashEvents.length > trashEventsBeforeSecondMove);
    expect(
      trashEvents
        .slice(trashEventsBeforeSecondMove)
        .some((event) => event.nodeId === canonicalId || event.nodeId === trashRootId),
    ).toBe(true);

    const trashEventsBeforeRemoval = trashEvents.length;
    const trashNodeEventsBeforeRemoval = trashNodeEvents.length;
    const removeCanonical = await mutationAPI.removeNodes([canonicalId]);
    expect(removeCanonical?.success).toBe(true);

    await waitFor(() => trashEvents.length > trashEventsBeforeRemoval);
    expect(
      trashEvents
        .slice(trashEventsBeforeRemoval)
        .some((event) => event.nodeId === canonicalId || event.nodeId === trashRootId),
    ).toBe(true);

    await waitFor(() =>
      trashNodeEvents
        .slice(trashNodeEventsBeforeRemoval)
        .some((event) => event.nodeId === trashRootId && String(event.type).length > 0),
    );

    const finalDesc = await queryAPI.listDescendants(trashRootId);
    expect(finalDesc.length).toBe(0);
    const finalChildren = await queryAPI.listChildren(trashRootId);
    expect(finalChildren.length).toBe(0);

    await subscriptionAPI.unsubscribe(subtreeSid);
    await subscriptionAPI.unsubscribe(trashSid);
    await subscriptionAPI.unsubscribe(trashNodeSid);
  }, 30_000);
});
