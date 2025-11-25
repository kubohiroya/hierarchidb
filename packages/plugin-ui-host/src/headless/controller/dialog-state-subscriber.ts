import type { DialogStateAPI, DialogStateSubscriptionId, MultiStepDialogState } from './types.js';
import type { SubscribeDialogStateOptions, SubscribeDialogStateResult } from './types.js';

export const subscribeDialogState = (options: SubscribeDialogStateOptions): SubscribeDialogStateResult => {
  const { dialogStateApi, onStateChange, logger, deps } = options;

  const callback = deps?.createCallback
    ? deps.createCallback(onStateChange)
    : ((value: MultiStepDialogState | null) => onStateChange(value));

  let subscriptionId: DialogStateSubscriptionId | null = null;

  try {
    subscriptionId = dialogStateApi.subscribeState(callback);
  } catch (err) {
    logger?.warn?.('[usePluginDialogController] subscribeState failed', err);
  }

  const release = () => {
    if (subscriptionId !== null) {
      try {
        // @ts-expect-error partial api typing
        (dialogStateApi as DialogStateAPI).unsubscribeState?.(subscriptionId);
      } catch (err) {
        logger?.warn?.('[usePluginDialogController] unsubscribeState failed', err);
      }
    }
    if (deps?.releaseCallback) {
      deps.releaseCallback(callback);
    }
  };

  return { id: subscriptionId, release };
};
