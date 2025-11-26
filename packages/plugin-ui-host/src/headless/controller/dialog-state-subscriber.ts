import { proxy, releaseProxy } from 'comlink';
import type { DialogStateAPI, DialogStateSubscriptionId } from '@hierarchidb/common-api';
import type { MultiStepDialogState } from './types.js';
import type { DialogStateSubscriptionDeps } from './types.js';
import { DialogStateSubscribeInput } from '@hierarchidb/common-types';

const defaultWarn = (...args: Array<string | number | boolean | object | null | undefined>) => {
  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn(...args);
  }
};

export const subscribeDialogState = async ({
  api,
  params,
  onSnapshot,
  logger,
  deps,
}: {
  api: DialogStateAPI | null;
  params: DialogStateSubscribeInput;
  onSnapshot: (state: MultiStepDialogState | null) => void;
  logger?: Pick<Console, 'warn' | 'error'>;
  deps?: DialogStateSubscriptionDeps;
}): Promise<() => void> => {
  const warn = logger?.warn?.bind(logger) ?? defaultWarn;

  if (!api) {
    const error = new Error('[PluginDialogShell] DialogStateAPI unavailable; cannot subscribe');
    warn(error.message);
    throw error;
  }

  const subscribeFn =
    typeof api.subscribeState === 'function' ? api.subscribeState.bind(api) : null;
  const unsubscribeFn =
    typeof api.unsubscribeState === 'function' ? api.unsubscribeState.bind(api) : null;
  const getStateFn = typeof api.getState === 'function' ? api.getState.bind(api) : null;

  if (!subscribeFn || !unsubscribeFn) {
    logger?.error?.('[PluginDialogShell] subscribeState/unsubscribeState missing', {
      typeofSubscribe: typeof api.subscribeState,
      typeofUnsubscribe: typeof api.unsubscribeState,
    });
    const error = new Error(
      '[PluginDialogShell] DialogStateAPI must implement subscribeState/unsubscribeState'
    );
    warn(error.message, params);
    throw error;
  }

  const createCallback: (handler: (state: MultiStepDialogState | null) => void) => (
    state: MultiStepDialogState | null
  ) => void =
    deps?.createCallback ??
    ((handler: (state: MultiStepDialogState | null) => void) =>
      proxy(handler) as (state: MultiStepDialogState | null) => void);
  const releaseCallback =
    deps?.releaseCallback ??
    ((callback: (state: MultiStepDialogState | null) => void) => {
      if (!callback) return;
      try {
        const releaser = (callback as { [key in typeof releaseProxy]?: () => void })[releaseProxy];
        if (typeof releaser === 'function') {
          releaser.call(callback);
        }
      } catch {
        // ignore
      }
    });

  const initialState = getStateFn ? await Promise.resolve(getStateFn(params)) : null;
  onSnapshot(initialState);

  const callback = createCallback(onSnapshot);
  let subscriptionId: DialogStateSubscriptionId | null = null;

  try {
    subscriptionId = await subscribeFn(params, callback);
  } catch (error) {
    const normalized = error instanceof Error ? error : new Error(String(error));
    warn(normalized);
    releaseCallback?.(callback);
    throw normalized;
  }

  const release = () => {
    try {
      releaseCallback?.(callback);
    } catch {
      // ignore release errors
    }
    try {
      if (subscriptionId) {
        unsubscribeFn(subscriptionId);
      }
    } catch {
      // ignore
    }
  };

  return release;
};
