import type { TreeQueryAPI } from '@hierarchidb/tree-api';
import type { WorkerAPI } from '@hierarchidb/worker-api';
import { useWorkerAPI } from '@hierarchidb/ui-worker-provider';
import type { Remote } from 'comlink';
import { useCallback, useEffect, useRef } from 'react';

const queryApiPromiseByWorkerApi = new WeakMap<object, Promise<TreeQueryAPI>>();

type WorkerPayload = Record<string, unknown>;
type WorkerApi = WorkerAPI<WorkerPayload>;
type WorkerApiRemote = Remote<WorkerApi>;

type UseWorkerQueryApiResult = {
  api: WorkerApiRemote | null;
  apiAvailable: boolean;
  getQueryAPIOrNull: () => Promise<TreeQueryAPI | null>;
};

export function useWorkerQueryAPI(): UseWorkerQueryApiResult {
  const { api, initialize, loading } = useWorkerAPI();
  const initializeRequestedRef = useRef(false);

  useEffect(() => {
    if (api || loading || initializeRequestedRef.current) {
      return;
    }
    initializeRequestedRef.current = true;
    void initialize()
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.warn('[useWorkerQueryAPI] worker initialize failed', message);
      });
  }, [api, initialize, loading]);

  const getQueryAPIOrNull = useCallback(async (): Promise<TreeQueryAPI | null> => {
    if (!api) {
      return null;
    }
    const apiKey = api as unknown as object;
    const cachedPromise = queryApiPromiseByWorkerApi.get(apiKey);
    if (cachedPromise) {
      try {
        return await cachedPromise;
      } catch {
        queryApiPromiseByWorkerApi.delete(apiKey);
      }
    }
    const nextPromise = api.getQueryAPI();
    queryApiPromiseByWorkerApi.set(apiKey, nextPromise);
    try {
      return await nextPromise;
    } catch (error) {
      queryApiPromiseByWorkerApi.delete(apiKey);
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[useWorkerQueryAPI] getQueryAPI failed', message);
      return null;
    }
  }, [api]);

  return {
    api,
    apiAvailable: Boolean(api),
    getQueryAPIOrNull,
  };
}
