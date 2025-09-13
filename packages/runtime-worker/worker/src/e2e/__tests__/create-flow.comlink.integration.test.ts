import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import * as Comlink from 'comlink';
import { MessageChannel } from 'worker_threads';
import type { NodeId, TreeId } from '@hierarchidb/common-type';
import { exposeTestAPI } from '../test-worker.entry';

// Minimal adapter to make Node's MessagePort look like a Comlink endpoint
function toEndpoint(port: any) {
  const handlerMap = new Map<Function, Function>();
  const ep = {
    postMessage: (v: any, transfer?: any[]) => (transfer ? port.postMessage(v, transfer) : port.postMessage(v)),
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
    start: () => { try { port.start?.(); } catch {} },
  } as any;
  try { ep.start(); } catch {}
  return ep;
}

describe('Comlink + fake-indexeddb integration: create flow uses workingCopy before commit', () => {
  it('createNode returns a workingCopy nodeId under workingCopy root; canonical parent remains unchanged until commit', async () => {
    const { port1, port2 } = new MessageChannel();
    // Expose the test WorkerAPI on port1
    await exposeTestAPI(toEndpoint(port1));
    // Wrap a client on port2
    const client: any = Comlink.wrap(toEndpoint(port2));

    const queryAPI = await client.getQueryAPI();
    const mutationAPI = await client.getMutationAPI();
    const subscriptionAPI = await client.getSubscriptionAPI();

    const treeId = 'r' as TreeId; // Resources
    const tree = await queryAPI.getTree(treeId);
    expect(tree?.rootId).toBeDefined();
    const parentId = tree.rootId as NodeId;

    // Subscribe canonical subtree (should NOT see draft WC events)
    const subtreeEvents: any[] = [];
    const sid = await subscriptionAPI.subscribeSubtree(parentId, Comlink.proxy((ev: any) => { subtreeEvents.push(ev); }));

    // 1) UI requests creation (Worker creates working copy under workingCopy root and returns wc nodeId)
    const res = await mutationAPI.createNode({ nodeType: 'folder', treeId, parentId, name: 'Created From Test' });
    expect(res?.success).toBe(true);
    const newId = res.nodeId as NodeId;
    expect(typeof newId).toBe('string');
    expect(newId.length).toBeGreaterThan(0);

    // 2) Immediately after promise resolution, working copy node must exist and be queryable
    const created = await queryAPI.getNode(newId);
    expect(created).toBeTruthy();
    expect(created?.id).toBe(newId);
    expect(created?.name).toBe('Created From Test');
    expect(created?.nodeType).toBe('folder');
    // Its parent is a workingCopy holder; its grandparent is the workingCopy root
    const holder = await queryAPI.getNode(created!.parentId as NodeId);
    expect(holder?.parentId).toBe((tree.rootId as string).replace(':root', ':workingCopy'));

    // 3) Canonical parent listing should NOT include the new node yet
    const children = await queryAPI.listChildren(parentId);
    expect(children.some((n: any) => n.id === newId)).toBe(false);

    // 4) Canonical subtree subscription should NOT have seen a create event for the working copy
    const sawCreate = subtreeEvents.some((e) => e?.nodeId === newId && (e.type === 'created' || e.type === 'node-created'));
    expect(sawCreate).toBe(false);

    // Cleanup subscription
    await subscriptionAPI.unsubscribe(sid);

    // UI invariant: navigate to /t/:treeId/:pageNodeId/:newId/:nodeType/create AFTER createNode resolves,
    // where newId is a workingCopy nodeId. Commit happens from the dialog.
  }, 20_000);
});
