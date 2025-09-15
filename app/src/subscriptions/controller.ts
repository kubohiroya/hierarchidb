import type { Remote } from 'comlink';
import type { WorkerAPI } from '@hierarchidb/common-api';
import type { NodeId, SubscriptionId } from '@hierarchidb/common-type';

type Key = string;

function keyOf(kind: 'page' | 'trash', rootId: NodeId): Key {
  return `${kind}:${rootId}`;
}

class SubscriptionController {
  private active = new Map<Key, { subId: SubscriptionId; rootId: NodeId }>();
  private busy = new Set<Key>();

  async subscribe(
    kind: 'page' | 'trash',
    client: Remote<WorkerAPI>,
    rootId: NodeId,
    cb: (ev: unknown) => void,
  ): Promise<{ subId: SubscriptionId | null; created: boolean }> {
    const k = keyOf(kind, rootId);
    if (this.active.has(k)) return { subId: this.active.get(k)!.subId, created: false };
    if (this.busy.has(k)) return { subId: null, created: false };
    this.busy.add(k);
    try {
      const api = await client.getSubscriptionAPI();
      const subId = await api.subscribeSubtree(rootId, cb as any);
      this.active.set(k, { subId, rootId });
      return { subId, created: true };
    } finally {
      this.busy.delete(k);
    }
  }

  async release(kind: 'page' | 'trash', client: Remote<WorkerAPI>, rootId: NodeId): Promise<void> {
    const k = keyOf(kind, rootId);
    const cur = this.active.get(k);
    if (!cur) return;
    try {
      const api = await client.getSubscriptionAPI();
      await api.unsubscribe(cur.subId);
    } finally {
      this.active.delete(k);
    }
  }

  getActive(kind: 'page' | 'trash', rootId: NodeId): SubscriptionId | null {
    const v = this.active.get(keyOf(kind, rootId));
    return v ? v.subId : null;
  }
}

export const Subscriptions = new SubscriptionController();
