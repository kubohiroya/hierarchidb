import 'fake-indexeddb/auto';
import type {
  TreeMutationAPI,
  TreeNodeUpdaterAPI,
  TreeQueryAPI,
  TreeSubscriptionAPI,
} from '@hierarchidb/common-api';
import { type NodeId, type TreeId, toNodeType } from '@hierarchidb/common-types';
import * as Comlink from 'comlink';
import { describe, expect, it } from 'vitest';
import { MessageChannel } from 'worker_threads';
import { createEndpointFromMessagePort } from '../../e2e/test-utils/messagePortEndpoint.js';
import { exposeTestAPI } from '../../e2e/test-worker.entry.js';

type TestWorkerAPI = {
  getQueryAPI(): Promise<TreeQueryAPI>;
  getMutationAPI(): Promise<TreeMutationAPI>;
  getSubscriptionAPI(): Promise<TreeSubscriptionAPI>;
  getTreeNodeUpdaterAPI(): Promise<TreeNodeUpdaterAPI>;
};

describe('Comlink + fake-indexeddb: basemap create flow persists data', () => {
  it('creates basemap draft node, fills steps, commits, and persists data', async () => {
    const { port1, port2 } = new MessageChannel();
    await exposeTestAPI(createEndpointFromMessagePort(port1));
    const client = Comlink.wrap<TestWorkerAPI>(createEndpointFromMessagePort(port2));

    const [queryAPI, mutationAPI, updaterAPI] = await Promise.all([
      client.getQueryAPI(),
      client.getMutationAPI(),
      client.getTreeNodeUpdaterAPI(),
    ]);

    const treeId: TreeId = 'r' as TreeId;
    const tree = await queryAPI.getTree(treeId);
    expect(tree?.rootId).toBeDefined();
    const parentId = tree?.rootId as NodeId;

    // Step1: create draft node via mutation API (Create button相当)
    const createRes = await mutationAPI.createNode({
      nodeType: toNodeType('basemap'),
      treeId,
      parentId,
      name: 'Basemap WFL',
    });
    expect(createRes.success).toBe(true);
    if (!createRes.success)
      throw new Error((createRes as { error?: string }).error ?? 'createNode failed');
    const wcId = createRes.nodeId as NodeId;

    // Step2: fill map style (draftData)
    await updaterAPI.updateTreeNodeDraftData(wcId, { mapStyle: { style: 'streets' } });
    await updaterAPI.updateTreeNodeDraftMetadata(wcId, {
      name: 'Basemap WFL',
      description: 'demo',
      tags: [],
    });

    // Step3: fill viewport and commit (Save/Create button相当)
    await updaterAPI.updateTreeNodeDraftData(wcId, {
      mapStyle: { style: 'streets' },
      viewport: { center: [0, 0], zoom: 2, bearing: 0, pitch: 0 },
    });
    const commitRes = await updaterAPI.commitDraft(wcId);
    expect(commitRes.status).toBe('ok');

    const canonical = await queryAPI.getNode(wcId);
    expect(canonical?.draftData).toBeNull();
    expect(canonical?.data).toEqual({
      mapStyle: { style: 'streets' },
      viewport: { center: [0, 0], zoom: 2, bearing: 0, pitch: 0 },
    });
    expect(canonical?.metadata.name).toBe('Basemap WFL');
    expect(canonical?.metadata.description).toBe('demo');
  }, 20_000);
});
