import 'fake-indexeddb/auto';
import type { NodeId, TreeId, TreeNode } from '@hierarchidb/common-types';
import { toNodeType } from '@hierarchidb/common-types';
import * as Comlink from 'comlink';
import { describe, expect, it } from 'vitest';
import { MessageChannel } from 'worker_threads';
import { createEndpointFromMessagePort } from '../../e2e/test-utils/messagePortEndpoint.js';
import { exposeTestAPI } from '../../e2e/test-worker.entry.js';

const decodeDraftHolderName = (name: string) => ({ targetNodeId: name as NodeId });

type TestWorkerAPI = {
  getQueryAPI(): Promise<import('@hierarchidb/common-api').TreeQueryAPI>;
  getMutationAPI(): Promise<import('@hierarchidb/common-api').TreeMutationAPI>;
  getTreeNodeUpdaterAPI(): Promise<import('@hierarchidb/common-api').TreeNodeUpdaterAPI>;
};

async function waitFor<T>(
  predicate: () => T | Promise<T>,
  opts?: { timeout?: number; interval?: number }
) {
  const timeout = opts?.timeout ?? 10000;
  const interval = opts?.interval ?? 25;
  const start = Date.now();
  while (true) {
    const value = await predicate();
    if (value) return value;
    if (Date.now() - start > timeout) throw new Error('waitFor: timeout');
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

describe('Comlink + fake-indexeddb integration: partial trash restore flow', () => {
  it.skip('restores a subset of trashed nodes while keeping the remaining nodes under trash holders', async () => {
    const { port1, port2 } = new MessageChannel();
    await exposeTestAPI(createEndpointFromMessagePort(port1));
    const client = Comlink.wrap<TestWorkerAPI>(createEndpointFromMessagePort(port2));

    const queryAPI = await client.getQueryAPI();
    const mutationAPI = await client.getMutationAPI();
    const updaterAPI = await client.getTreeNodeUpdaterAPI();

    const treeId = 'r' as TreeId;
    const tree = await queryAPI.getTree(treeId);
    expect(tree?.rootId).toBeDefined();
    expect(tree?.trashRootId).toBeDefined();
    if (!tree?.rootId || !tree.trashRootId) {
      throw new Error('Expected console roots to be defined');
    }

    const rootId = tree.rootId as NodeId;
    const trashRootId = tree.trashRootId as NodeId;

    const createAndCommit = async (name: string, parentId: NodeId): Promise<NodeId> => {
      const createResult = await mutationAPI.createNode({
        nodeType: toNodeType('folder'),
        treeId,
        parentId,
        name,
      });
      if (!createResult.success) {
        const message = 'error' in createResult ? createResult.error : 'unknown error';
        throw new Error(`createNode failed for ${name}: ${message}`);
      }

      const draftNode = await queryAPI.getNode(createResult.nodeId);
      if (!draftNode) {
        throw new Error(`draft node missing for ${name}`);
      }

      const holder = await queryAPI.getNode(draftNode.parentId as NodeId);
      if (!holder) {
        throw new Error(`holder missing for ${name}`);
      }

      const { targetNodeId } = decodeDraftHolderName(holder.metadata.name);
      const canonicalId = targetNodeId as NodeId;

      const commitResult = await updaterAPI.commitDraft(createResult.nodeId);
      expect(commitResult.status).toBe('ok');
      await waitFor(async () => {
        const committed = await queryAPI.getNode(canonicalId);
        return Boolean(committed);
      });

      return canonicalId;
    };

    const parentId = await createAndCommit('Integration Trash Parent', rootId);
    const childOneId = await createAndCommit('Integration Trash Child C', parentId);
    const childTwoId = await createAndCommit('Integration Trash Child D', parentId);

    const moveResult = await mutationAPI.moveNodesToTrash([childOneId, childTwoId]);
    expect(moveResult.success).toBe(true);

    await waitFor(async () => {
      const children = await queryAPI.listChildren(parentId);
      return children.every((node) => node.id !== childOneId && node.id !== childTwoId);
    });

    const trashedLookup = await waitFor(async () => {
      const trashChildren = await queryAPI.listChildren(trashRootId);
      const ids = new Map<NodeId, TreeNode>();
      for (const node of trashChildren) {
        const nodeId = node.id as NodeId;
        ids.set(nodeId, node);
      }
      return ids.has(childOneId) && ids.has(childTwoId) ? ids : undefined;
    });

    const trashedChildOne = trashedLookup.get(childOneId);
    const trashedChildTwo = trashedLookup.get(childTwoId);
    if (!trashedChildOne || !trashedChildTwo) {
      throw new Error('expected trashed children to be present');
    }
    expect(trashedChildOne.parentId).toBe(trashRootId);
    expect(trashedChildTwo.parentId).toBe(trashRootId);
    expect(trashedChildOne.removedAt).toBeTruthy();
    expect(trashedChildTwo.removedAt).toBeTruthy();
    expect(trashedChildOne.metadata.name).not.toBe('Integration Trash Child C');
    expect(trashedChildTwo.metadata.name).not.toBe('Integration Trash Child D');
    expect(trashedChildOne.originalName).toBe('Integration Trash Child C');
    expect(trashedChildTwo.originalName).toBe('Integration Trash Child D');
    expect(trashedChildOne.originalParentId).toBe(parentId);
    expect(trashedChildTwo.originalParentId).toBe(parentId);

    const restoreResult = await mutationAPI.restoreNodesFromTrash({
      nodeIds: [childOneId],
      toParentId: parentId,
    });
    expect(restoreResult.success).toBe(true);

    await waitFor(async () => {
      const parentChildren = await queryAPI.listChildren(parentId);
      return parentChildren.some((node) => node.id === childOneId);
    });

    const childOneAfterRestore = await queryAPI.getNode(childOneId);
    expect(childOneAfterRestore?.parentId).toBe(parentId);

    const childTwoAfterRestore = await queryAPI.getNode(childTwoId);
    expect(childTwoAfterRestore?.parentId).toBe(trashRootId);
    expect(childTwoAfterRestore?.removedAt).toBeTruthy();
    expect(childTwoAfterRestore?.originalParentId).toBe(parentId);
    expect(childTwoAfterRestore?.originalName).toBe('Integration Trash Child D');

    const trashChildrenAfterRestore = await queryAPI.listChildren(trashRootId);
    expect(trashChildrenAfterRestore.some((node) => node.id === childTwoId)).toBe(true);
    expect(trashChildrenAfterRestore.some((node) => node.id === childOneId)).toBe(false);

    const secondMoveResult = await mutationAPI.moveNodesToTrash([childOneId]);
    expect(secondMoveResult.success).toBe(true);

    await waitFor(async () => {
      const trashChildren = await queryAPI.listChildren(trashRootId);
      return trashChildren.some((node) => node.id === childOneId);
    });

    const release = (client as unknown as { [Comlink.releaseProxy]?: () => Promise<void> })[
      Comlink.releaseProxy
    ];
    if (release) {
      await release.call(client);
    }
    port1.close();
    port2.close();
  }, 20_000);
});
