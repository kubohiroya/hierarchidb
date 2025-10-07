import type {
  DialogStateAPI,
  DialogStateSubscriptionId,
} from '@hierarchidb/common-api';
import type {
  DialogStateRequestInput,
  DialogStateSubscribeInput,
  DialogStateUpdateInput,
  MultiStepDialogState,
} from '@hierarchidb/common-types';
import { storeRegistry } from '../entity/store-registry.js';
import type { PeerEntity } from '../entity/store.js';

interface SubscriptionEntry {
  key: string;
  callback: (state: MultiStepDialogState | null) => void;
  throttleMs?: number;
  lastEmit?: number;
}

const buildKey = (nodeType: string, nodeId: string) => `${nodeType}::${nodeId}`;

export class DialogStateService implements DialogStateAPI {
  private subscribers = new Map<DialogStateSubscriptionId, SubscriptionEntry>();

  async publishState({ nodeId, nodeType, state }: DialogStateUpdateInput): Promise<void> {
    const store = storeRegistry.getPeer(nodeType);
    if (!store) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[DialogStateService] no peer store registered for nodeType', nodeType);
      }
      return;
    }

    const existing = await store.get(nodeId);
    const next: PeerEntity<any> = {
      nodeId,
      ...(existing ?? {}),
      updatedAt: Date.now(),
    };
    if (state) {
      next.dialogState = state;
    } else if ('dialogState' in next) {
      next.dialogState = null;
    }

    try {
      await store.put(next);
    } catch (error) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[DialogStateService] failed to persist dialog state', error);
      }
    }

    this.emit(buildKey(nodeType, nodeId), state ?? null);
  }

  async getState({ nodeId, nodeType }: DialogStateRequestInput): Promise<MultiStepDialogState | null> {
    const store = storeRegistry.getPeer(nodeType);
    if (!store) {
      return null;
    }
    const entity = await store.get(nodeId);
    const state = entity?.dialogState ?? null;
    return state ?? null;
  }

  async subscribeState(
    input: DialogStateSubscribeInput,
    callback: (state: MultiStepDialogState | null) => void,
  ): Promise<DialogStateSubscriptionId> {
    const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
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
