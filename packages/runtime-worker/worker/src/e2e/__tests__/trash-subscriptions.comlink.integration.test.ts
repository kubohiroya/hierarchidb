import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import * as Comlink from 'comlink';
import { MessageChannel } from 'worker_threads';
import type { NodeId, TreeId } from '@hierarchidb/common-type';
import { decodeTrashHolderName, isValidTrashHolderName } from '../../services/utils/holder-encoding';
import { exposeTestAPI } from '../test-worker.entry';

// Minimal adapter to make Node's MessagePort look like a Comlink endpoint
function toEndpoint(port: any) {
  const handlerMap = new Map<Function, Function>();
  const ep = {
    postMessage: (v: any, transfer?: any[]) => transfer ? port.postMessage(v, transfer) : port.postMessage(v),
    addEventListener: (_type: 'message', h: (ev: MessageEvent) => void) => {
      const wrapped = (data: any) => h({ data } as MessageEvent);
      handlerMap.set(h, wrapped);
      port.on('message', wrapped);
    },
    removeEventListener: (_type: 'message', h: (ev: MessageEvent) => void) => {
      const wrapped = handlerMap.get(h);
      if (wrapped) {
        port.off('message', wrapped as any);
        handlerMap.delete(h);
      }
    },
    start: () => { port.start?.(); },
  } as any;
  // Proactively start message flow
  ep.start();
  return ep;
}

async function waitFor<T>(predicate: () => T | Promise<T>, opts?: { timeout?: number; interval?: number }) {
  const timeout = opts?.timeout ?? 10000;
  const interval = opts?.interval ?? 25;
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const v = await predicate();
    if (v) return v;
    if (Date.now() - start > timeout) throw new Error('waitFor: timeout');
    await new Promise((r) => setTimeout(r, interval));
  }
}

describe('Comlink + fake-indexeddb integration: subtree/trash subscriptions', () => {
  it('subscribes subtree and trash, creates/moves/deletes with expected notifications', async () => {
    const { port1, port2 } = new MessageChannel();
    // Expose the test API on port1
    await exposeTestAPI(toEndpoint(port1));
    // Wrap client on port2
    const client: any = Comlink.wrap(toEndpoint(port2));

    const queryAPI = await client.getQueryAPI();
    const mutationAPI = await client.getMutationAPI();
    const subscriptionAPI = await client.getSubscriptionAPI();
    const wcAPI = await client.getWorkingCopyAPI();

    const treeId = 'r' as TreeId; // Resources tree
    const tree = await queryAPI.getTree(treeId);
    expect(tree?.rootId).toBeDefined();
    expect(tree?.trashRootId).toBeDefined();

    const rootId = tree.rootId as NodeId;
    const trashRootId = tree.trashRootId as NodeId;

    // Track events
    const subtreeEvents: any[] = [];
    const trashEvents: any[] = [];

    const subtreeSid = await subscriptionAPI.subscribeSubtree(
      rootId,
      Comlink.proxy((ev: any) => { subtreeEvents.push(ev); }),
    );
    const trashSid = await subscriptionAPI.subscribeSubtree(
      trashRootId,
      Comlink.proxy((ev: any) => { trashEvents.push(ev); }),
    );

    // 1) Create a draft working copy under workingCopy root (returns wc nodeId)
    const createRes = await mutationAPI.createNode({ nodeType: 'folder', treeId, parentId: rootId, name: 'tmp' });
    expect(createRes?.success).toBe(true);
    const wcNodeId = createRes.nodeId as NodeId;
    const wcNode = await queryAPI.getNode(wcNodeId);
    expect(wcNode).toBeTruthy();
    const wcHolder = await queryAPI.getNode(wcNode!.parentId as NodeId);
    expect(wcHolder).toBeTruthy();
    // Decode canonical target id from holder name
    const { decodeWorkingCopyHolderName } = await import('../../services/utils/holder-encoding');
    const { targetNodeId } = decodeWorkingCopyHolderName((wcHolder as any).name as string);
    const canonicalId = targetNodeId as NodeId;

    // Commit working copy to create the canonical node under root
    const commitRes = await wcAPI.commitWorkingCopy(wcNodeId);
    expect(commitRes?.success).toBe(true);

    // Now expect a subtree notification for the canonical node
    await waitFor(() => subtreeEvents.some((e) => e?.nodeId === canonicalId && (e.type === 'created' || e.type === 'updated' || e.type === 'node-created' || e.type === 'node-updated')));

    // 2) Move it to trash
    const mvRes = await mutationAPI.moveNodesToTrash([canonicalId]);
    if (!mvRes?.success) {
      throw new Error('moveNodesToTrash failed: ' + JSON.stringify(mvRes));
    }

    // Expect: some trash subtree notification arrived (holder create or node update)
    await waitFor(() => trashEvents.length > 0);

    // Verify via query: node moved under a holder beneath trash root
    const afterRootChildren = await queryAPI.listChildren(rootId);
    const afterTrashChildren = await queryAPI.listChildren(trashRootId);
    expect(afterRootChildren.find((n: any) => n.id === canonicalId)).toBeFalsy();
    // Find a holder whose encoded name targets the new node
    const holder = afterTrashChildren.find((n: any) => n.nodeType === 'trash' && isValidTrashHolderName(n.name) && decodeTrashHolderName(n.name).trashedNodeId === canonicalId);
    expect(!!holder).toBe(true);
    const nodesUnderHolder = await queryAPI.listChildren(holder!.id as NodeId);
    expect(nodesUnderHolder.some((n: any) => n.id === canonicalId)).toBe(true);

    // 3) Empty the trash (permanently remove)
    // Simplified: get all descendants under trashRoot in one shot and bulk delete.
    const delAll = await mutationAPI.removeSubtree(trashRootId);
    expect(delAll?.success).toBe(true);

    // Expect: trash receives delete/update notifications and becomes empty
    await waitFor(async () => {
      const now = await queryAPI.listDescendants(trashRootId);
      return now.length === 0;
    });

    // Cleanup
    await subscriptionAPI.unsubscribe(subtreeSid);
    await subscriptionAPI.unsubscribe(trashSid);
  }, 30_000);
});
