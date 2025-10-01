import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import * as Comlink from 'comlink';
import { MessageChannel } from 'worker_threads';
import type { NodeId, TreeId } from '@hierarchidb/common-type';
import {
  decodeTrashHolderName,
  decodeWorkingCopyHolderName,
  isValidTrashHolderName,
} from '../../services/utils/holder-encoding.js';
import { exposeTestAPI } from '../test-worker.entry.js';

const endpointFromPort = (port: MessagePort): Comlink.Endpoint => {
  const listeners = new Map<(event: MessageEvent) => void, (value: unknown) => void>();
  return {
    postMessage(value, transfer) {
      if (transfer && transfer.length > 0) {
        port.postMessage(value, transfer);
      } else {
        port.postMessage(value);
      }
    },
    addEventListener(_type, handler) {
      const wrapped = (data: unknown) => handler({ data } as MessageEvent);
      listeners.set(handler, wrapped);
      port.on('message', wrapped);
    },
    removeEventListener(_type, handler) {
      const wrapped = listeners.get(handler);
      if (wrapped) {
        port.off('message', wrapped);
        listeners.delete(handler);
      }
    },
    start() {
      port.start?.();
    },
  };
};

type TestWorkerAPI = {
  getQueryAPI(): Promise<import('@hierarchidb/common-api').TreeQueryAPI>;
  getMutationAPI(): Promise<import('@hierarchidb/common-api').TreeMutationAPI>;
  getWorkingCopyAPI(): Promise<import('@hierarchidb/common-api').WorkingCopyAPI>;
};

async function waitFor<T>(predicate: () => T | Promise<T>, opts?: { timeout?: number; interval?: number }) {
  const timeout = opts?.timeout ?? 10000;
  const interval = opts?.interval ?? 25;
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const value = await predicate();
    if (value) return value;
    if (Date.now() - start > timeout) throw new Error('waitFor: timeout');
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

describe('Comlink + fake-indexeddb integration: partial trash restore flow', () => {
  it('restores a subset of trashed nodes while keeping the remaining nodes under trash holders', async () => {
    const { port1, port2 } = new MessageChannel();
    await exposeTestAPI(endpointFromPort(port1));
    const client = Comlink.wrap<TestWorkerAPI>(endpointFromPort(port2));

    const queryAPI = await client.getQueryAPI();
    const mutationAPI = await client.getMutationAPI();
    const workingCopyAPI = await client.getWorkingCopyAPI();

    const treeId = 'r' as TreeId;
    const tree = await queryAPI.getTree(treeId);
    expect(tree?.rootId).toBeDefined();
    expect(tree?.trashRootId).toBeDefined();
    if (!tree?.rootId || !tree.trashRootId) {
      throw new Error('Expected tree roots to be defined');
    }

    const rootId = tree.rootId as NodeId;
    const trashRootId = tree.trashRootId as NodeId;

    const createAndCommit = async (name: string, parentId: NodeId): Promise<NodeId> => {
      const createResult = await mutationAPI.createNode({
        nodeType: 'folder',
        treeId,
        parentId,
        name,
      });
      expect(createResult?.success).toBe(true);
      if (!createResult?.nodeId) {
        throw new Error(`createNode did not return nodeId for ${name}`);
      }

      const workingCopy = await queryAPI.getNode(createResult.nodeId as NodeId);
      if (!workingCopy) {
        throw new Error(`working copy missing for ${name}`);
      }

      const holder = await queryAPI.getNode(workingCopy.parentId as NodeId);
      if (!holder) {
        throw new Error(`holder missing for ${name}`);
      }

      const { targetNodeId } = decodeWorkingCopyHolderName(holder.name);
      const canonicalId = targetNodeId as NodeId;

      const commitResult = await workingCopyAPI.commitWorkingCopy(createResult.nodeId as NodeId);
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

    const holderByTarget = await waitFor(async () => {
      const trashChildren = await queryAPI.listChildren(trashRootId);
      const map = new Map<NodeId, NodeId>();
      for (const node of trashChildren) {
        if (node.nodeType === 'trash' && isValidTrashHolderName(node.name)) {
          const decoded = decodeTrashHolderName(node.name);
          map.set(decoded.trashedNodeId, node.id as NodeId);
        }
      }
      return map.size >= 2 ? map : undefined;
    });

    const holderForChildOne = holderByTarget.get(childOneId);
    const holderForChildTwo = holderByTarget.get(childTwoId);
    expect(holderForChildOne).toBeDefined();
    expect(holderForChildTwo).toBeDefined();
    if (!holderForChildOne || !holderForChildTwo) {
      throw new Error('Expected trash holders for both trashed nodes');
    }

    const restoreResult = await mutationAPI.restoreNodesFromTrash({ nodeIds: [childOneId], toParentId: parentId });
    expect(restoreResult.success).toBe(true);

    await waitFor(async () => {
      const parentChildren = await queryAPI.listChildren(parentId);
      return parentChildren.some((node) => node.id === childOneId);
    });

    const childOneAfterRestore = await queryAPI.getNode(childOneId);
    expect(childOneAfterRestore?.parentId).toBe(parentId);

    const childTwoAfterRestore = await queryAPI.getNode(childTwoId);
    expect(childTwoAfterRestore?.parentId).toBe(holderForChildTwo);

    const trashChildrenAfterRestore = await queryAPI.listChildren(trashRootId);
    const remainingHolderIds = new Set<NodeId>();
    for (const node of trashChildrenAfterRestore) {
      if (node.nodeType === 'trash' && isValidTrashHolderName(node.name)) {
        const decoded = decodeTrashHolderName(node.name);
        remainingHolderIds.add(node.id as NodeId);
        expect(decoded.trashedNodeId).not.toBe(childOneId);
      }
    }

    expect(remainingHolderIds.has(holderForChildTwo)).toBe(true);
    expect(remainingHolderIds.has(holderForChildOne)).toBe(false);

    const secondMoveResult = await mutationAPI.moveNodesToTrash([childOneId]);
    expect(secondMoveResult.success).toBe(true);

    await waitFor(async () => {
      const trashChildren = await queryAPI.listChildren(trashRootId);
      return trashChildren.some((node) => {
        if (node.nodeType !== 'trash' || !isValidTrashHolderName(node.name)) return false;
        try {
          return decodeTrashHolderName(node.name).trashedNodeId === childOneId;
        } catch {
          return false;
        }
      });
    });

    const release = (client as unknown as { [Comlink.releaseProxy]?: () => Promise<void> })[Comlink.releaseProxy];
    if (release) {
      await release.call(client);
    }
    port1.close();
    port2.close();
  }, 20_000);
});
