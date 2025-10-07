import type {
  NodeId,
  SubscriptionFilter,
  SubscriptionId,
  SubscriptionOptions,
  TreeChangeEvent,
  TreeId,
} from '@hierarchidb/common-types';
import type { Subject } from 'rxjs';

export type SubscriptionKind =
  | 'node'
  | 'subtree'
  | 'tree'
  | 'childNodes'
  | 'working-copies'
  | 'undo-state';

export interface SubscriptionInfo {
  id: SubscriptionId;
  type: SubscriptionKind;
  nodeId?: NodeId;
  treeId?: TreeId;
  callback?: (event: unknown) => void;
  options?: SubscriptionOptions;
  isActive: boolean;
  lastActivity: number;
  createdAt: number;
  subscription?: { unsubscribe(): void } | null;
  filter?: SubscriptionFilter;
  subject?: Subject<TreeChangeEvent>;
}

/**
 * Central store for subscription metadata. TreeSubscriptionService previously
 * handled bookkeeping directly; extracting the registry simplifies the
 * service and makes the rules for creation and cleanup explicit.
 */
export class SubscriptionRegistry {
  private readonly subscriptions = new Map<SubscriptionId, SubscriptionInfo>();
  private counter = 0;

  generateId(): SubscriptionId {
    return `sub_${++this.counter}_${Date.now()}` as SubscriptionId;
  }

  register(info: SubscriptionInfo): void {
    this.subscriptions.set(info.id, info);
  }

  get(id: SubscriptionId): SubscriptionInfo | undefined {
    return this.subscriptions.get(id);
  }

  updateActivity(id: SubscriptionId): void {
    const existing = this.subscriptions.get(id);
    if (existing) {
      existing.lastActivity = Date.now();
    }
  }

  markInactive(id: SubscriptionId): void {
    const existing = this.subscriptions.get(id);
    if (existing) {
      existing.isActive = false;
    }
  }

  delete(id: SubscriptionId): SubscriptionInfo | undefined {
    const existing = this.subscriptions.get(id);
    if (existing) {
      this.subscriptions.delete(id);
    }
    return existing;
  }

  clear(): SubscriptionInfo[] {
    const all = Array.from(this.subscriptions.values());
    this.subscriptions.clear();
    return all;
  }

  entries(): IterableIterator<[SubscriptionId, SubscriptionInfo]> {
    return this.subscriptions.entries();
  }

  active(): SubscriptionInfo[] {
    return Array.from(this.subscriptions.values()).filter((s) => s.isActive);
  }

  deleteWhere(predicate: (info: SubscriptionInfo) => boolean): SubscriptionInfo[] {
    const removed: SubscriptionInfo[] = [];
    for (const [id, info] of Array.from(this.subscriptions.entries())) {
      if (predicate(info)) {
        this.subscriptions.delete(id);
        removed.push(info);
      }
    }
    return removed;
  }

  cleanupInactive(maxInactiveMs: number, now: number = Date.now()): SubscriptionInfo[] {
    const removed: SubscriptionInfo[] = [];
    for (const [id, info] of Array.from(this.subscriptions.entries())) {
      if (!info.isActive || now - info.lastActivity > maxInactiveMs) {
        this.subscriptions.delete(id);
        removed.push(info);
      }
    }
    return removed;
  }

  size(): number {
    return this.subscriptions.size;
  }

  listActiveIds(): SubscriptionId[] {
    return Array.from(this.subscriptions.entries())
      .filter(([, info]) => info.isActive)
      .map(([id]) => id);
  }
}
