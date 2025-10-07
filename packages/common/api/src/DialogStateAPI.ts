import type {
  DialogStateRequestInput,
  DialogStateSubscribeInput,
  DialogStateUpdateInput,
  MultiStepDialogState,
} from '@hierarchidb/common-types';

/**
 * Subscription identifier used to manage dialog state listeners.
 */
export type DialogStateSubscriptionId = string;

/**
 * API exposed by the worker for publishing and observing multi-step dialog state.
 */
export interface DialogStateAPI {
  /** Persist (or clear when state is null) the latest snapshot for a dialog */
  publishState(input: DialogStateUpdateInput): Promise<void>;

  /** Retrieve the last known snapshot for a dialog */
  getState(input: DialogStateRequestInput): Promise<MultiStepDialogState | null>;

  /**
   * Subscribe to snapshot changes for a dialog. The callback is invoked immediately
   * with the current value (if any) and subsequently whenever the worker publishes
   * an update. The returned subscriptionId can be used to unsubscribe later.
   */
  subscribeState(
    input: DialogStateSubscribeInput,
    callback: (state: MultiStepDialogState | null) => void,
  ): Promise<DialogStateSubscriptionId>;

  /** Cancel a previously established subscription */
  unsubscribeState(subscriptionId: DialogStateSubscriptionId): Promise<void>;
}
