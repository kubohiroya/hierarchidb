import 'fake-indexeddb/auto';
import type { NodeId, TreeId } from '@hierarchidb/core-types';
import { toNodeType } from '@hierarchidb/core-types';
import type { TreeNodeData, TreeNodeEvent } from '@hierarchidb/tree-api';
import * as Comlink from 'comlink';
import { describe, expect, it } from 'vitest';
import { MessageChannel } from 'worker_threads';
import { createEndpointFromMessagePort } from '~/e2e/test-utils/messagePortEndpoint';
import { exposeTestAPI } from '~/e2e/test-worker.entry';

type TestWorkerAPI = {
  ping(): Promise<{ response: string; timestamp: number }>;
  getQueryAPI(): Promise<import('@hierarchidb/tree-api').TreeQueryAPI>;
  getMutationAPI(): Promise<import('@hierarchidb/tree-api').TreeMutationAPI>;
  getSubscriptionAPI(): Promise<import('@hierarchidb/tree-api').TreeSubscriptionAPI>;
  getTreeNodeUpdaterAPI(): Promise<
    import('@hierarchidb/tree-api').TreeNodeUpdaterAPI<TreeNodeData>
  >;
};

type SubscriptionEvent = TreeNodeEvent;

async function waitFor<T>(
  predicate: () => T | Promise<T>,
  opts?: { timeout?: number; interval?: number }
) {
  const timeout = opts?.timeout ?? 15_000;
  const interval = opts?.interval ?? 25;
  const deadline = Date.now() + timeout;
  while (Date.now() <= deadline) {
    const value = await predicate();
    if (value) return value;
    if (Date.now() > deadline) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(`waitFor: timeout after ${timeout}ms`);
}

describe('Comlink + fake-indexeddb integration: subtree/archive subscriptions', () => {
  it('subscribes subtree and archive, creates/moves/deletes with expected notifications', async () => {
    const { port1, port2 } = new MessageChannel();
    await exposeTestAPI(createEndpointFromMessagePort(port1));
    const client = Comlink.wrap<TestWorkerAPI>(createEndpointFromMessagePort(port2));

    const queryAPI = await client.getQueryAPI();
    const mutationAPI = await client.getMutationAPI();
    const subscriptionAPI = await client.getSubscriptionAPI();
    const wcAPI = await client.getTreeNodeUpdaterAPI();

    const treeId = 'r' as TreeId;
    const tree = await queryAPI.getTree(treeId);
    expect(tree?.rootId).toBeDefined();
    expect(tree?.archiveRootId).toBeDefined();

    if (!tree?.rootId || !tree.archiveRootId) {
      throw new Error('Expected console roots to be defined');
    }
    const rootId = tree.rootId as NodeId;
    const archiveRootId = tree.archiveRootId as NodeId;

    const subtreeEvents: SubscriptionEvent[] = [];
    const archiveEvents: SubscriptionEvent[] = [];
    const archiveNodeEvents: SubscriptionEvent[] = [];

    const subtreeSid = await subscriptionAPI.subscribeSubtree(
      rootId,
      Comlink.proxy((event: SubscriptionEvent) => {
        subtreeEvents.push(event);
      })
    );
    const archiveSid = await subscriptionAPI.subscribeSubtree(
      archiveRootId,
      Comlink.proxy((event: SubscriptionEvent) => {
        archiveEvents.push(event);
      })
    );
    const archiveNodeSid = await subscriptionAPI.subscribeNode(
      archiveRootId,
      Comlink.proxy((event: SubscriptionEvent) => {
        archiveNodeEvents.push(event);
      })
    );

    const createRes = await mutationAPI.createNode({
      nodeType: toNodeType('folder'),
      treeId,
      parentId: rootId,
      name: 'tmp',
    });
    if (!createRes.success) {
      const message = 'error' in createRes ? createRes.error : 'unknown error';
      throw new Error(`createNode failed: ${message}`);
    }
    const wcNodeId = createRes.nodeId;

    const wcNode = await queryAPI.getNode(wcNodeId);
    expect(wcNode).toBeTruthy();
    if (!wcNode) throw new Error('Working copy node missing');
    const commitRes = await wcAPI.commitDraft(wcNodeId);
    expect(commitRes?.status).toBe('ok');
    if (commitRes?.status !== 'ok') {
      throw new Error(`commitDraft failed: ${JSON.stringify(commitRes)}`);
    }
    const canonicalId = commitRes.nodeId;

    await waitFor(() =>
      subtreeEvents.some((event) => event?.nodeId === canonicalId && typeof event.type === 'string')
    );

    const mvRes = await mutationAPI.moveNodesToArchive([canonicalId]);
    if (!mvRes?.success) {
      throw new Error(`moveNodesToArchive failed: ${JSON.stringify(mvRes)}`);
    }

    await waitFor(() => archiveEvents.length > 0);

    const afterRootChildren = await queryAPI.listChildren(rootId);
    const afterArchiveChildren = await queryAPI.listChildren(archiveRootId);
    expect(afterRootChildren.some((node) => node.id === canonicalId)).toBe(false);

    const archiveedNode = afterArchiveChildren.find((node) => node.id === canonicalId);
    expect(archiveedNode).toBeTruthy();
    if (!archiveedNode) throw new Error('Archived node not found');
    expect(archiveedNode.parentId).toBe(archiveRootId);
    expect(archiveedNode.removedAt).toBeTruthy();
    expect(archiveedNode.metadata.name).not.toBe('tmp');
    expect(archiveedNode.originalName).toBe('tmp');
    expect(archiveedNode.originalParentId).toBe(rootId);

    const subtreeEventsBeforeRestore = subtreeEvents.length;
    const restoreRes = await mutationAPI.restoreNodesFromArchive({
      nodeIds: [canonicalId],
      toParentId: rootId,
    });
    expect(restoreRes?.success).toBe(true);

    await waitFor(async () => {
      const rootChildrenAfterRestore = await queryAPI.listChildren(rootId);
      return rootChildrenAfterRestore.some((node) => node.id === canonicalId);
    });

    await waitFor(() => subtreeEvents.length > subtreeEventsBeforeRestore);

    const archiveChildrenAfterRestore = await queryAPI.listChildren(archiveRootId);
    expect(archiveChildrenAfterRestore.some((node) => node.id === canonicalId)).toBe(false);

    const archiveEventsBeforeSecondMove = archiveEvents.length;
    const subtreeEventsBeforeSecondMove = subtreeEvents.length;
    const moveAgainRes = await mutationAPI.moveNodesToArchive([canonicalId]);
    if (!moveAgainRes?.success) {
      throw new Error(`moveNodesToArchive (second) failed: ${JSON.stringify(moveAgainRes)}`);
    }

    await waitFor(() =>
      subtreeEvents
        .slice(subtreeEventsBeforeSecondMove)
        .some(
          (event) =>
            (event.nodeId === canonicalId &&
              (event.type === 'moved' || event.type === 'deleted')) ||
            (event.nodeId === rootId && event.type === 'updated')
        )
    );

    const afterSecondRootChildren = await queryAPI.listChildren(rootId);
    expect(afterSecondRootChildren.some((node) => node.id === canonicalId)).toBe(false);

    const afterSecondArchiveChildren = await queryAPI.listChildren(archiveRootId);
    const archiveedAgain = afterSecondArchiveChildren.find((node) => node.id === canonicalId);
    expect(archiveedAgain).toBeTruthy();
    if (!archiveedAgain) throw new Error('Archived node (second) not found');
    expect(archiveedAgain.parentId).toBe(archiveRootId);
    expect(archiveedAgain.removedAt).toBeTruthy();
    expect(archiveedAgain.metadata.name).not.toBe('tmp');
    expect(archiveedAgain.originalName).toBe('tmp');
    expect(archiveedAgain.originalParentId).toBe(rootId);

    await waitFor(() => archiveEvents.length > archiveEventsBeforeSecondMove);
    expect(
      archiveEvents
        .slice(archiveEventsBeforeSecondMove)
        .some((event) => event.nodeId === canonicalId || event.nodeId === archiveRootId)
    ).toBe(true);

    const archiveEventsBeforeRemoval = archiveEvents.length;
    const archiveNodeEventsBeforeRemoval = archiveNodeEvents.length;
    const removeCanonical = await mutationAPI.removeNodes([canonicalId]);
    expect(removeCanonical?.success).toBe(true);

    await waitFor(() => archiveEvents.length > archiveEventsBeforeRemoval);
    expect(
      archiveEvents
        .slice(archiveEventsBeforeRemoval)
        .some((event) => event.nodeId === canonicalId || event.nodeId === archiveRootId)
    ).toBe(true);

    await waitFor(() =>
      archiveNodeEvents
        .slice(archiveNodeEventsBeforeRemoval)
        .some((event) => event.nodeId === archiveRootId && String(event.type).length > 0)
    );

    const finalDesc = await queryAPI.listDescendants(archiveRootId);
    expect(finalDesc.length).toBe(0);
    const finalChildren = await queryAPI.listChildren(archiveRootId);
    expect(finalChildren.length).toBe(0);

    await subscriptionAPI.unsubscribe(subtreeSid);
    await subscriptionAPI.unsubscribe(archiveSid);
    await subscriptionAPI.unsubscribe(archiveNodeSid);
  }, 30_000);
});
