import 'fake-indexeddb/auto';
import type { NodeId, TreeId } from '@hierarchidb/core-types';
import { toNodeType } from '@hierarchidb/core-types';
import type { TreeNode, TreeNodeData } from '@hierarchidb/tree-api';
import * as Comlink from 'comlink';
import { describe, expect, it } from 'vitest';
import { MessageChannel } from 'worker_threads';
import { createEndpointFromMessagePort } from '~/e2e/test-utils/messagePortEndpoint';
import { exposeTestAPI } from '~/e2e/test-worker.entry';

type TestWorkerAPI = {
  getQueryAPI(): Promise<import('@hierarchidb/tree-api').TreeQueryAPI>;
  getMutationAPI(): Promise<import('@hierarchidb/tree-api').TreeMutationAPI>;
  getTreeNodeUpdaterAPI(): Promise<
    import('@hierarchidb/tree-api').TreeNodeUpdaterAPI<TreeNodeData>
  >;
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

describe('Comlink + fake-indexeddb integration: partial archive restore flow', () => {
  it('restores a subset of archiveed nodes while keeping the remaining nodes under archive holders', async () => {
    const { port1, port2 } = new MessageChannel();
    await exposeTestAPI(createEndpointFromMessagePort(port1));
    const client = Comlink.wrap<TestWorkerAPI>(createEndpointFromMessagePort(port2));

    const queryAPI = await client.getQueryAPI();
    const mutationAPI = await client.getMutationAPI();
    const updaterAPI = await client.getTreeNodeUpdaterAPI();

    const treeId = 'r' as TreeId;
    const tree = await queryAPI.getTree(treeId);
    expect(tree?.rootId).toBeDefined();
    expect(tree?.archiveRootId).toBeDefined();
    if (!tree?.rootId || !tree.archiveRootId) {
      throw new Error('Expected console roots to be defined');
    }

    const rootId = tree.rootId as NodeId;
    const archiveRootId = tree.archiveRootId as NodeId;

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

      const commitResult = await updaterAPI.commitDraft(createResult.nodeId);
      expect(commitResult.status).toBe('ok');
      if (commitResult.status !== 'ok') {
        throw new Error(`commitDraft failed for ${name}: ${JSON.stringify(commitResult)}`);
      }
      const canonicalId = commitResult.nodeId;
      await waitFor(async () => {
        const committed = await queryAPI.getNode(canonicalId);
        return Boolean(committed);
      });

      return canonicalId;
    };

    const parentId = await createAndCommit('Integration Archive Parent', rootId);
    const childOneId = await createAndCommit('Integration Archive Child C', parentId);
    const childTwoId = await createAndCommit('Integration Archive Child D', parentId);

    const moveResult = await mutationAPI.moveNodesToArchive([childOneId, childTwoId]);
    expect(moveResult.success).toBe(true);

    await waitFor(async () => {
      const children = await queryAPI.listChildren(parentId);
      return children.every((node) => node.id !== childOneId && node.id !== childTwoId);
    });

    const archiveedLookup = await waitFor(async () => {
      const archiveChildren = await queryAPI.listChildren(archiveRootId);
      const ids = new Map<NodeId, TreeNode>();
      for (const node of archiveChildren) {
        const nodeId = node.id as NodeId;
        ids.set(nodeId, node);
      }
      return ids.has(childOneId) && ids.has(childTwoId) ? ids : undefined;
    });

    const archiveedChildOne = archiveedLookup.get(childOneId);
    const archiveedChildTwo = archiveedLookup.get(childTwoId);
    if (!archiveedChildOne || !archiveedChildTwo) {
      throw new Error('expected archiveed children to be present');
    }
    expect(archiveedChildOne.parentId).toBe(archiveRootId);
    expect(archiveedChildTwo.parentId).toBe(archiveRootId);
    expect(archiveedChildOne.removedAt).toBeTruthy();
    expect(archiveedChildTwo.removedAt).toBeTruthy();
    expect(archiveedChildOne.metadata.name).not.toBe('Integration Archive Child C');
    expect(archiveedChildTwo.metadata.name).not.toBe('Integration Archive Child D');
    expect(archiveedChildOne.originalName).toBe('Integration Archive Child C');
    expect(archiveedChildTwo.originalName).toBe('Integration Archive Child D');
    expect(archiveedChildOne.originalParentId).toBe(parentId);
    expect(archiveedChildTwo.originalParentId).toBe(parentId);

    const restoreResult = await mutationAPI.restoreNodesFromArchive({
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
    expect(childTwoAfterRestore?.parentId).toBe(archiveRootId);
    expect(childTwoAfterRestore?.removedAt).toBeTruthy();
    expect(childTwoAfterRestore?.originalParentId).toBe(parentId);
    expect(childTwoAfterRestore?.originalName).toBe('Integration Archive Child D');

    const archiveChildrenAfterRestore = await queryAPI.listChildren(archiveRootId);
    expect(archiveChildrenAfterRestore.some((node) => node.id === childTwoId)).toBe(true);
    expect(archiveChildrenAfterRestore.some((node) => node.id === childOneId)).toBe(false);

    const secondMoveResult = await mutationAPI.moveNodesToArchive([childOneId]);
    expect(secondMoveResult.success).toBe(true);

    await waitFor(async () => {
      const archiveChildren = await queryAPI.listChildren(archiveRootId);
      return archiveChildren.some((node) => node.id === childOneId);
    });

    await client[Comlink.releaseProxy]?.();
    port1.close();
    port2.close();
  }, 20_000);
});
