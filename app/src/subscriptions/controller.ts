import type { NodeId, SubscriptionId } from '@hierarchidb/common-type';
import type { Remote } from 'comlink';
import type { WorkerAPI } from '@hierarchidb/common-api';

type SubscriptionKind = 'trash' | 'page';
export type SubscriptionCallback = (event: unknown) => void;

interface SubscriptionInfo {
  subId: SubscriptionId;
  createdAt: number;
  callback: SubscriptionCallback;
  kind: SubscriptionKind;
  nodeId: NodeId;
}

/**
 * Temporary in-memory subscription registry used by TreeConsoleIntegration.
 * Mimics the shape of the real controller but without worker communication.
 */
export class Subscriptions {
  private static registry = new Map<string, SubscriptionInfo>();

  static getInstance(): Subscriptions {
    return new Subscriptions();
  }

  static getActive(kind: SubscriptionKind, nodeId: NodeId): SubscriptionInfo | undefined {
    return this.registry.get(this.key(kind, nodeId));
  }

  static async subscribe(
    kind: SubscriptionKind,
    client: Remote<WorkerAPI>,
    nodeId: NodeId,
    callback: SubscriptionCallback,
  ): Promise<{ subId: SubscriptionId; created: boolean }> {
    const key = this.key(kind, nodeId);
    const existing = this.registry.get(key);
    if (existing) {
      // Update stored callback reference so callers always get the latest handler
      existing.callback = callback;
      return { subId: existing.subId, created: false };
    }
    const subscriptionAPI = await client.getSubscriptionAPI();

    let subId: SubscriptionId;
    try {
      switch (kind) {
        case 'trash':
          subId = await subscriptionAPI.subscribeSubtree(nodeId, callback as (event: any) => void);
          break;
        case 'page':
          subId = await subscriptionAPI.subscribeSubtree(nodeId, callback as (event: any) => void);
          break;
        default:
          subId = await subscriptionAPI.subscribeNode(nodeId, callback as (event: any) => void);
          break;
      }
    } catch (error) {
      console.warn('[Subscriptions] Failed to create subscription', { kind, nodeId, error });
      throw error;
    }

    this.registry.set(key, {
      subId,
      createdAt: Date.now(),
      callback,
      kind,
      nodeId,
    });
    return { subId, created: true };
  }

  static async release(kind: SubscriptionKind, client: Remote<WorkerAPI>, nodeId: NodeId): Promise<void> {
    const key = this.key(kind, nodeId);
    const info = this.registry.get(key);
    this.registry.delete(key);
    if (!info) return;

    try {
      const subscriptionAPI = await client.getSubscriptionAPI();
      await subscriptionAPI.unsubscribe(info.subId);
    } catch (error) {
      console.warn('[Subscriptions] Failed to release subscription', { kind, nodeId, error });
    }
  }

  private static key(kind: SubscriptionKind, nodeId: NodeId): string {
    return `${kind}:${nodeId}`;
  }
}
