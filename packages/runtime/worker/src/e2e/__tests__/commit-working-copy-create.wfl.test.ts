import 'fake-indexeddb/auto';
import type { NodeId, TreeNodeEvent } from '@hierarchidb/common-types';
import { toNodeType } from '@hierarchidb/common-types';
import * as Comlink from 'comlink';
import { describe, expect, it } from 'vitest';
import { MessageChannel } from 'worker_threads';
import { createEndpointFromMessagePort } from '../test-utils/messagePortEndpoint.js';
import { exposeTestAPI } from '../test-worker.entry.js';

type TestWorkerAPI = {
  ping(): Promise<{ response: string; timestamp: number }>;
  getQueryAPI(): Promise<import('@hierarchidb/common-api').TreeQueryAPI>;
  getMutationAPI(): Promise<import('@hierarchidb/common-api').TreeMutationAPI>;
  getSubscriptionAPI(): Promise<import('@hierarchidb/common-api').TreeSubscriptionAPI>;
};

type SubscriptionEvent = TreeNodeEvent;

describe('Comlink + fake-indexeddb integration: create flow uses workingCopy before commit', () => {
  it('createNode returns a workingCopy nodeId under workingCopy root; canonical parent remains unchanged until commit', async () => {
    const { port1, port2 } = new MessageChannel();
    await exposeTestAPI(createEndpointFromMessagePort(port1));
    const client = Comlink.wrap<TestWorkerAPI>(createEndpointFromMessagePort(port2));

    const queryAPI = await client.getQueryAPI();
    const mutationAPI = await client.getMutationAPI();
    const subscriptionAPI = await client.getSubscriptionAPI();

    const treeId = 'r';
    const tree = await queryAPI.getTree(treeId);
    expect(tree?.rootId).toBeDefined();
    if (!tree?.rootId) throw new Error('rootId missing');
    const parentId = tree.rootId as NodeId;

    const subtreeEvents: SubscriptionEvent[] = [];
    const sid = await subscriptionAPI.subscribeSubtree(
      parentId,
      Comlink.proxy((event: TreeNodeEvent) => {
        subtreeEvents.push(event);
      }) as (event: TreeNodeEvent) => void
    );

    const res = await mutationAPI.createNode({
      nodeType: toNodeType('folder'),
      treeId,
      parentId,
      name: 'Created From Test',
    });
    if (!res.success) {
      const message = 'error' in res ? res.error : 'unknown error';
      throw new Error(`createNode failed: ${message}`);
    }
    const newId = res.nodeId;

    const created = await queryAPI.getNode(newId);
    expect(created).toBeTruthy();
    if (!created) throw new Error('working copy not created');
    expect(created.id).toBe(newId);
    expect(created.name).toBe('Created From Test');
    expect(created.nodeType).toBe('folder');

    const holder = await queryAPI.getNode(created.parentId as NodeId);
    expect(holder).toBeTruthy();
    if (!holder) throw new Error('holder not found');
    expect(holder.parentId).toBe((tree.rootId as string).replace(':root', ':workingCopy'));

    const children = await queryAPI.listChildren(parentId);
    expect(children.some((node) => node.id === newId)).toBe(false);

    const sawCreate = subtreeEvents.some(
      (event) => event?.nodeId === newId && typeof event.type === 'string'
    );
    expect(sawCreate).toBe(false);

    await subscriptionAPI.unsubscribe(sid);
  }, 20_000);
});
