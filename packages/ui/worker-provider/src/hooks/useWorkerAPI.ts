import { useMemo } from 'react';
import type { Remote } from 'comlink';
import type { WorkerAPI } from '@hierarchidb/common-api';
import { getWorkerClientHook, type WorkerClientRef } from '../ui/workerClientHook.js';

export interface UseWorkerAPIResult {
  api: Remote<WorkerAPI> | null;
  loading: boolean;
  error: Error | null;
  initialize: () => Promise<void>;
}

/**
 * Convenience hook to access the shared Worker API from components that rely on
 * WorkerProvider/WorkerClientProvider. Lives in ui-worker-provider so it stays
 * co-located with the registration mechanism.
 */
export function useWorkerAPI(): UseWorkerAPIResult {
  const client = useMemo(() => {
    try {
      const hook = getWorkerClientHook<WorkerClientRef>();
      return hook();
    } catch (error) {
      console.warn('[useWorkerAPI] worker client hook is not registered', error);
      return null;
    }
  }, []);

  if (!client) {
    return {
      api: null,
      loading: true,
      error: new Error('Worker client is unavailable. Ensure WorkerProvider is mounted.'),
      initialize: async () => {
        throw new Error('Worker client is unavailable.');
      },
    } satisfies UseWorkerAPIResult;
  }

  let api: Remote<WorkerAPI> | null = null;
  try {
    api = client.client ?? client.getAPI();
  } catch (error) {
    console.warn('[useWorkerAPI] failed to obtain Worker API', error);
  }

  return {
    api,
    loading: !client.isInitialized,
    error: client.error,
    initialize: client.initialize,
  } satisfies UseWorkerAPIResult;
}
