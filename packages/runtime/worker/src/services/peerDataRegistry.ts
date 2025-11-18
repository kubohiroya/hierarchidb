import type { NodeId, NodeType, TreeNode } from '@hierarchidb/common-types';
import { storeRegistry } from '../entity/store-registry.js';

export type PeerDataComposer = (node: TreeNode) => Promise<unknown> | unknown;

const peerDataComposers = new Map<NodeType, PeerDataComposer>();

export function registerPeerDataComposer(nodeType: NodeType, composer: PeerDataComposer): void {
  peerDataComposers.set(nodeType, composer);
}

export function unregisterPeerDataComposer(nodeType: NodeType): void {
  peerDataComposers.delete(nodeType);
}

export function getPeerDataComposer(nodeType: NodeType): PeerDataComposer | undefined {
  return peerDataComposers.get(nodeType);
}

export async function syncPeerDataFromNode(node?: TreeNode | null): Promise<void> {
  if (!node) return;
  const nodeId = node.id as NodeId | undefined;
  const nodeType = node.nodeType as NodeType | undefined;
  if (!nodeId || !nodeType) return;
  const composer = peerDataComposers.get(nodeType);
  if (!composer) return;
  const store = storeRegistry.getPeer(nodeType);
  if (!store) return;
  let data: unknown;
  try {
    data = await composer(node);
  } catch (error) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[peer-data] composer failed for nodeType', nodeType, error);
    }
    return;
  }

  try {
    const existing = await store.get(nodeId);
    await store.put({
      nodeId,
      ...(existing ?? {}),
      data,
      updatedAt: Date.now(),
    });
  } catch (error) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[peer-data] failed to persist peer data', { nodeId, nodeType, error });
    }
  }
}
