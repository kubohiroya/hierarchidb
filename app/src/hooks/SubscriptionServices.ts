import type { WorkerAPI } from '@hierarchidb/worker-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { SubscriptionId } from '@hierarchidb/tree-api';
import type { Remote } from 'comlink';

export type SubscriptionKind = 'trash' | 'page';
export type SubscriptionCallback = (event: unknown) => void;

interface SubscriptionInfo {
  subId: SubscriptionId;
  createdAt: number;
  callback: SubscriptionCallback;
  kind: SubscriptionKind;
  nodeId: NodeId;
}

const registry = new Map<string, SubscriptionInfo>();

function isDebugEnabled(): boolean {
  try {
    const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
    return env?.VITE_SUBSCRIPTION_DEBUG === '1';
  } catch {
    return false;
  }
}

function subscriptionKey(kind: SubscriptionKind, nodeId: NodeId): string {
  return `${kind}:${nodeId}`;
}

function resolvePrefetchOptions(kind: SubscriptionKind) {
  const prefetchDepth = kind === 'trash' ? 2 : 3;
  return { prefetch: { depth: prefetchDepth } };
}

async function subscribeImpl(
  kind: SubscriptionKind,
  client: Remote<WorkerAPI>,
  nodeId: NodeId,
  callback: SubscriptionCallback
): Promise<{ subId: SubscriptionId; created: boolean }> {
  const key = subscriptionKey(kind, nodeId);
  const existing = registry.get(key);
  if (existing) {
    existing.callback = callback;
    return { subId: existing.subId, created: false };
  }

  const subscriptionAPI = await client.getSubscriptionAPI();
  const options = resolvePrefetchOptions(kind);
  const debugEnabled = isDebugEnabled();

  if (debugEnabled) {
    console.log('[Subscriptions] subscribe: start', {
      kind,
      nodeId: String(nodeId),
      options,
    });
  }

  const create = async () => {
    switch (kind) {
      case 'trash':
      case 'page':
        return subscriptionAPI.subscribeSubtree(nodeId, callback, options);
      default:
        return subscriptionAPI.subscribeNode(nodeId, callback);
    }
  };

  let subId: SubscriptionId;
  try {
    subId = await create();
  } catch (error) {
    console.warn('[Subscriptions] Failed to create subscription', { kind, nodeId, error });
    throw error;
  }

  if (debugEnabled) {
    console.log('[Subscriptions] subscribe: success', {
      kind,
      nodeId: String(nodeId),
      subId,
    });
  }

  registry.set(key, {
    subId,
    createdAt: Date.now(),
    callback,
    kind,
    nodeId,
  });

  return { subId, created: true };
}

async function releaseImpl(
  kind: SubscriptionKind,
  client: Remote<WorkerAPI>,
  nodeId: NodeId
): Promise<void> {
  const key = subscriptionKey(kind, nodeId);
  const info = registry.get(key);
  registry.delete(key);
  if (!info) return;

  try {
    const subscriptionAPI = await client.getSubscriptionAPI();
    const debugEnabled = isDebugEnabled();
    if (debugEnabled) {
      console.log('[Subscriptions] release: start', {
        kind,
        nodeId: String(nodeId),
        subId: info.subId,
      });
    }
    await subscriptionAPI.unsubscribe(info.subId);
    if (debugEnabled) {
      console.log('[Subscriptions] release: success', {
        kind,
        nodeId: String(nodeId),
        subId: info.subId,
      });
    }
  } catch (error) {
    console.warn('[Subscriptions] Failed to release subscription', { kind, nodeId, error });
  }
}

export const Subscriptions = {
  getActive(kind: SubscriptionKind, nodeId: NodeId): SubscriptionInfo | undefined {
    return registry.get(subscriptionKey(kind, nodeId));
  },
  subscribe: subscribeImpl,
  release: releaseImpl,
};
