import { useEffect, useState } from 'react';
import type { DialogStateAPI, WorkerAPI } from '@hierarchidb/common-api';
import type { DialogStateSubscribeInput, NodeId } from '@hierarchidb/common-types';
import type { Remote } from 'comlink';
import { subscribeDialogState } from '../controller/dialog-state-subscriber.js';
import type { MultiStepDialogState } from '../controller/types.js';

interface Params {
  client: Remote<WorkerAPI> | null;
  nodeType: string;
  nodeId: NodeId;
}

export function useDialogStateBridge({
  client,
  nodeType,
  nodeId,
}: Params): {
  dialogStateApi: DialogStateAPI | null;
  workerDialogState: MultiStepDialogState | null;
  dialogStateError: Error | null;
  setDialogStateError: (value: Error | null) => void;
} {
  const [dialogStateApi, setDialogStateApi] = useState<DialogStateAPI | null>(null);
  const [workerDialogState, setWorkerDialogState] = useState<MultiStepDialogState | null>(null);
  const [dialogStateError, setDialogStateError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!client) {
      setDialogStateApi(null);
      setWorkerDialogState(null);
      setDialogStateError(null);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const api = await client.getDialogStateAPI();
        /*
        if (typeof console !== 'undefined' && typeof console.debug === 'function') {
          console.debug('[PluginDialogShell] dialogStateAPI snapshot', {
            apiType: typeof api,
            publishType: typeof api?.publishState,
            subscribeType: typeof api?.subscribeState,
            unsubscribeType: typeof api?.unsubscribeState,
            keys: Object.keys(api ?? {}),
          });
        }
         */
        if (cancelled) {
          return;
        }

        const hasMethod = (method: keyof DialogStateAPI) => typeof api?.[method] === 'function';
        const missingRequiredMethod =
          !hasMethod('publishState') ||
          !hasMethod('getState') ||
          !hasMethod('subscribeState') ||
          !hasMethod('unsubscribeState');

        if (missingRequiredMethod) {
          const details = {
            publishStateType: typeof api?.publishState,
            getStateType: typeof api?.getState,
            subscribeStateType: typeof api?.subscribeState,
            unsubscribeStateType: typeof api?.unsubscribeState,
            keys: Object.keys(api ?? {}),
          };
          const error = new Error('[PluginDialogShell] DialogStateAPI is missing required methods');
          if (typeof console !== 'undefined' && typeof console.error === 'function') {
            console.error(error.message, details);
          }
          setDialogStateApi(null);
          setDialogStateError(error);
          return;
        }

        const wrappedApi: DialogStateAPI = {
          publishState: async (input) => api.publishState(input),
          getState: async (input) => api.getState(input),
          subscribeState: async (input, callback) => api.subscribeState(input, callback),
          unsubscribeState: async (subscriptionId) => api.unsubscribeState(subscriptionId),
        };

        setDialogStateError(null);
        setDialogStateApi(wrappedApi);
      } catch (error) {
        if (typeof console !== 'undefined' && typeof console.error === 'function') {
          console.error('[PluginDialogShell] failed to acquire DialogStateAPI', error);
        }
        if (!cancelled) {
          setDialogStateApi(null);
          const normalized =
            error instanceof Error ? error : new Error(String(error ?? 'Failed to get DialogStateAPI'));
          setDialogStateError(normalized);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client]);

  useEffect(() => {
    if (!nodeType || !nodeId) {
      setWorkerDialogState(null);
      return;
    }

    if (!dialogStateApi) {
      setWorkerDialogState(null);
      return;
    }

    let disposed = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      try {
        const release = await subscribeDialogState({
          api: dialogStateApi,
          params: { nodeType, nodeId } as DialogStateSubscribeInput,
          onSnapshot: (snapshot) => {
            if (!disposed) {
              setWorkerDialogState(snapshot ?? null);
            }
          },
          logger: typeof console !== 'undefined' ? console : undefined,
        });

        if (!disposed) {
          setDialogStateError(null);
        }

        if (disposed) {
          release();
        } else {
          cleanup = release;
        }
      } catch (error) {
        if (typeof console !== 'undefined' && typeof console.error === 'function') {
          console.error(
            '[PluginDialogShell] failed to establish dialog state subscription bridge',
            error
          );
        }
        if (!disposed) {
          setWorkerDialogState(null);
          const normalized =
            error instanceof Error ? error : new Error(String(error ?? 'Dialog state bridge failed'));
          setDialogStateError(normalized);
        }
      }
    })();

    return () => {
      disposed = true;
      setWorkerDialogState(null);
      if (cleanup) {
        cleanup();
        cleanup = null;
      }
    };
  }, [dialogStateApi, nodeType, nodeId]);

  return {
    dialogStateApi,
    workerDialogState,
    dialogStateError,
    setDialogStateError,
  };
}
