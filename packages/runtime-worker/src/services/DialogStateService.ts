import type { DialogStateAPI, DialogStateSubscriptionId } from '@hierarchidb/common-api';
import type {
  DialogStateRequestInput,
  DialogStateSubscribeInput,
  DialogStateUpdateInput,
  MultiStepDialogState,
} from '@hierarchidb/common-types';

interface SubscriptionEntry {
  key: string;
  callback: (state: MultiStepDialogState | null) => void;
  throttleMs?: number;
  lastEmit?: number;
}

const buildKey = (nodeType: string, nodeId: string) => `${nodeType}::${nodeId}`;

export class DialogStateService implements DialogStateAPI {
  private subscribers = new Map<DialogStateSubscriptionId, SubscriptionEntry>();
  private snapshotCache = new Map<string, MultiStepDialogState | null>();

  async publishState({ nodeId, nodeType, state }: DialogStateUpdateInput): Promise<void> {
    const cacheKey = buildKey(nodeType, nodeId);
    if (state) {
      this.snapshotCache.set(cacheKey, state);
    } else {
      this.snapshotCache.delete(cacheKey);
    }
    this.emit(cacheKey, state ?? null);
  }

  async getState({
    nodeId,
    nodeType,
  }: DialogStateRequestInput): Promise<MultiStepDialogState | null> {
    const cacheKey = buildKey(nodeType, nodeId);
    if (this.snapshotCache.has(cacheKey)) {
      return this.snapshotCache.get(cacheKey) ?? null;
    }
    return null;
  }

  async subscribeState(
    input: DialogStateSubscribeInput,
    callback: (state: MultiStepDialogState | null) => void
  ): Promise<DialogStateSubscriptionId> {
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `dlg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const entry: SubscriptionEntry = {
      key: buildKey(input.nodeType, input.nodeId),
      callback,
      throttleMs: input.throttleMs,
    };
    this.subscribers.set(id, entry);

    try {
      const current = await this.getState(input);
      if (typeof callback === 'function') {
        callback(current);
      }
    } catch (error) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[DialogStateService] initial emit failed', error);
      }
    }

    return id;
  }

  async unsubscribeState(subscriptionId: DialogStateSubscriptionId): Promise<void> {
    this.subscribers.delete(subscriptionId);
  }

  private emit(key: string, state: MultiStepDialogState | null): void {
    const now = Date.now();
    for (const [id, entry] of this.subscribers) {
      if (entry.key !== key) continue;
      if (entry.throttleMs && entry.throttleMs > 0 && entry.lastEmit) {
        if (now - entry.lastEmit < entry.throttleMs) {
          continue;
        }
      }
      entry.lastEmit = now;
      try {
        entry.callback(state);
      } catch (error) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[DialogStateService] subscriber callback failed', { id, error });
        }
      }
    }
  }
}
