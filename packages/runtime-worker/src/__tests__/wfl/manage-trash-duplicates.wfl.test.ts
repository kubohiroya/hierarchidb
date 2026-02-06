import 'fake-indexeddb/auto';
import type { NodeId, TreeId } from '@hierarchidb/core-types';
import { toNodeType } from '@hierarchidb/core-types';
import type { TreeNodeData } from '@hierarchidb/tree-api';
import * as Comlink from 'comlink';
import { describe, expect, it } from 'vitest';
import { MessageChannel } from 'worker_threads';
import { createEndpointFromMessagePort } from '../../e2e/test-utils/messagePortEndpoint.js';
import { exposeTestAPI } from '../../e2e/test-worker.entry.js';

type TestWorkerAPI = {
  getQueryAPI(): Promise<import('@hierarchidb/tree-api').TreeQueryAPI>;
  getMutationAPI(): Promise<import('@hierarchidb/tree-api').TreeMutationAPI>;
  getTreeNodeUpdaterAPI(): Promise<
    import('@hierarchidb/tree-api').TreeNodeUpdaterAPI<TreeNodeData>
  >;
};

async function createCommittedNode(
  worker: TestWorkerAPI,
  parentId: NodeId,
  name: string
): Promise<NodeId> {
  const mutationAPI = await worker.getMutationAPI();
  const updaterAPI = await worker.getTreeNodeUpdaterAPI();
  const queryAPI = await worker.getQueryAPI();
  const treeId = 'r' as TreeId;

  const res = await mutationAPI.createNode({
    nodeType: toNodeType('folder'),
    treeId,
    parentId,
    name,
  });
  if (!res.success || !res.nodeId) {
    const message = 'error' in res ? res.error : 'unknown error';
    throw new Error(`createNode failed: ${message}`);
  }

  const wcNodeId = res.nodeId as NodeId;
  const wcNode = await queryAPI.getNode(wcNodeId);
  if (!wcNode) throw new Error('draft node missing');
  const commitRes = await updaterAPI.commitDraft(wcNodeId);
  if (commitRes?.status !== 'ok') {
    throw new Error(`commitDraft failed: ${JSON.stringify(commitRes)}`);
  }

  return commitRes.nodeId;
}

describe('trash duplicate names handling', () => {
  it('allows moving multiple nodes with the same name into trash', async () => {
    const { port1, port2 } = new MessageChannel();
    await exposeTestAPI(createEndpointFromMessagePort(port1));
    const client = Comlink.wrap<TestWorkerAPI>(createEndpointFromMessagePort(port2));

    const queryAPI = await client.getQueryAPI();
    const mutationAPI = await client.getMutationAPI();
    const tree = await queryAPI.getTree('r' as TreeId);
    if (!tree?.rootId || !tree.trashRootId) {
      throw new Error('console roots not available');
    }
    const rootId = tree.rootId as NodeId;
    const trashRootId = tree.trashRootId as NodeId;

    const first = await createCommittedNode(client, rootId, 'duplicate');
    const second = await createCommittedNode(client, rootId, 'duplicate');

    const moveFirst = await mutationAPI.moveNodesToTrash([first]);
    expect(moveFirst?.success).toBe(true);

    const moveSecond = await mutationAPI.moveNodesToTrash([second]);
    expect(moveSecond?.success).toBe(true);

    const trashChildren = await queryAPI.listChildren(trashRootId);
    const names = trashChildren
      .filter((node) => node.id === first || node.id === second)
      .map((node) => node.metadata.name);
    expect(new Set(names).size).toBe(names.length);
  }, 20_000);
});
