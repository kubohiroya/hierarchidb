import type { NodeId } from '@hierarchidb/common-type';
import type { Remote } from 'comlink';
import type { WorkerAPI } from '@hierarchidb/common-api';

type SubscriptionKind = 'trash' | 'page';
export type SubscriptionCallback = (event: unknown) => void;

interface SubscriptionInfo {
  subId: string;
  createdAt: number;
  callback: SubscriptionCallback;
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
    _client: Remote<WorkerAPI>,
    nodeId: NodeId,
    callback: SubscriptionCallback,
  ): Promise<{ subId: string; created: boolean }> {
    const key = this.key(kind, nodeId);
    const existing = this.registry.get(key);
    if (existing) {
      return { subId: existing.subId, created: false };
    }
    const subId = `${kind}-${nodeId}-${Date.now().toString(36)}`;
    this.registry.set(key, { subId, createdAt: Date.now(), callback });
    return { subId, created: true };
  }

  static async release(kind: SubscriptionKind, _client: Remote<WorkerAPI>, nodeId: NodeId): Promise<void> {
    const key = this.key(kind, nodeId);
    this.registry.delete(key);
  }

  private static key(kind: SubscriptionKind, nodeId: NodeId): string {
    return `${kind}:${nodeId}`;
  }
}
