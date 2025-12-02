import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import * as Comlink from 'comlink';
import { MessageChannel } from 'worker_threads';
import { toNodeType, toTreeId, type NodeId, type TreeId } from '@hierarchidb/common-types';
import type {
  TreeMutationAPI,
  TreeQueryAPI,
  TreeSubscriptionAPI,
  DraftAPI,
} from '@hierarchidb/common-api';
import { createEndpointFromMessagePort } from '../../e2e/test-utils/messagePortEndpoint.js';
import { exposeTestAPI } from '../../e2e/test-worker.entry.js';

type TestWorkerAPI = {
  getQueryAPI(): Promise<TreeQueryAPI>;
  getMutationAPI(): Promise<TreeMutationAPI>;
  getSubscriptionAPI(): Promise<TreeSubscriptionAPI>;
  getDraftAPI(): Promise<DraftAPI>;
};

describe('Comlink + fake-indexeddb: basemap create flow persists data', () => {
  it(
    'creates basemap draft node, fills steps, commits, and persists data',
    async () => {
      const { port1, port2 } = new MessageChannel();
      await exposeTestAPI(createEndpointFromMessagePort(port1));
      const client = Comlink.wrap<TestWorkerAPI>(createEndpointFromMessagePort(port2));

      const [queryAPI, mutationAPI, draftAPI] = await Promise.all([
        client.getQueryAPI(),
        client.getMutationAPI(),
        client.getDraftAPI(),
      ]);

      const treeId: TreeId = toTreeId('r');
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
      if (!createRes.success) throw new Error((createRes as { error?: string }).error ?? 'createNode failed');
      const wcId = createRes.nodeId as NodeId;

      // Step2: fill map style (draftData)
      await draftAPI.updateTreeNodeDraftData(wcId, { mapStyle: { style: 'streets' } });
      await draftAPI.updateTreeNodeDraftMetadata(wcId, { name: 'Basemap WFL', description: 'demo', tags: [] });

      // Step3: fill viewport and commit (Save/Create button相当)
      await draftAPI.updateTreeNodeDraftData(wcId, {
        mapStyle: { style: 'streets' },
        viewport: { center: [0, 0], zoom: 2, bearing: 0, pitch: 0 },
      });
      const commitRes = await draftAPI.commitDraft(wcId);
      expect(commitRes.status).toBe('ok');

      const canonical = await queryAPI.getNode(wcId);
      expect(canonical?.draftData).toBeNull();
      expect(canonical?.data).toEqual({
        mapStyle: { style: 'streets' },
        viewport: { center: [0, 0], zoom: 2, bearing: 0, pitch: 0 },
      });
      expect(canonical?.metadata.name).toBe('Basemap WFL');
      expect(canonical?.metadata.description).toBe('demo');
    },
    20_000
  );
});
