import 'fake-indexeddb/auto';
import type { NodeId, TreeId } from '@hierarchidb/common-types';
import { toNodeType, toTreeId } from '@hierarchidb/common-types';
import * as Comlink from 'comlink';
import { describe, expect, it } from 'vitest';
import { MessageChannel } from 'worker_threads';
import { createEndpointFromMessagePort } from '../../e2e/test-utils/messagePortEndpoint.js';
import { exposeTestAPI } from '../../e2e/test-worker.entry.js';

type TestWorkerAPI = {
  getQueryAPI(): Promise<import('@hierarchidb/common-api').TreeQueryAPI>;
  getWorkingCopyAPI(): Promise<import('@hierarchidb/common-api').WorkingCopyAPI>;
};

describe('Comlink + fake-idb integration: basemap edit working copy flow', () => {
  it('creating a second working copy with an existing WC id succeeds (no Node not found)', async () => {
    const { port1, port2 } = new MessageChannel();
    await exposeTestAPI(createEndpointFromMessagePort(port1));
    const client = Comlink.wrap<TestWorkerAPI>(createEndpointFromMessagePort(port2));

    const queryAPI = await client.getQueryAPI();
    const workingCopyAPI = await client.getWorkingCopyAPI();

    // Ensure basemap peer stores are registered, mirroring the host bootstrap.
    const { registerBasemapWorkerStores } = await import('@hierarchidb/basemap-plugin/worker');
    await registerBasemapWorkerStores?.();

    const treeId: TreeId = toTreeId('r');
    const tree = await queryAPI.getTree(treeId);
    expect(tree?.rootId).toBeDefined();
    if (!tree?.rootId) throw new Error('Tree root missing');
    const parentId = tree.rootId as NodeId;

    // Create and commit a basemap node so that we have a canonical node to edit.
    const draft = await workingCopyAPI.createDraftWorkingCopy(toNodeType('basemap'), parentId, {
      name: 'Integration Basemap',
    });
    await workingCopyAPI.commitWorkingCopy(draft.id as NodeId, { onNameConflict: 'auto-rename' });

    const children = await queryAPI.listChildren(parentId);
    const canonical = children.find((node) => node.name === 'Integration Basemap');
    expect(canonical).toBeTruthy();
    if (!canonical) throw new Error('Canonical basemap node not found after commit');
    const canonicalId = canonical.id as NodeId;

    const editWorkingCopy = await workingCopyAPI.createWorkingCopyFromNode(canonicalId);
    expect(editWorkingCopy).toBeTruthy();

    // Regression check: calling createWorkingCopyFromNode with the working copy id
    // should reuse the existing WC instead of throwing "Node not found".
    const reusedWorkingCopy = await workingCopyAPI.createWorkingCopyFromNode(
      editWorkingCopy.id as NodeId
    );
    expect(reusedWorkingCopy.id).toBe(editWorkingCopy.id);

    // Sanity: verify the basemap peer store is registered (no UIPersistence warning scenario).
    const runtime = await import('@hierarchidb/runtime-worker');
    const peerStore = runtime.storeRegistry.getPeer('basemap');
    expect(peerStore).toBeTruthy();
  }, 20_000);
});
