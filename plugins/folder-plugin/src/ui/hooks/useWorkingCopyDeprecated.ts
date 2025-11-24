import { useMemo } from 'react';
import { getWorkerClientHook, type WorkerClientRef } from '@hierarchidb/runtime-client';

type DraftAPI = {
  createDraftBase: (nodeType: string, parentId: string, initial?: any) => Promise<string>;
  getDraft: (nodeId: string) => Promise<any>;
  commitDraft: (nodeId: string) => Promise<string>;
  discardDraft: (nodeId: string) => Promise<void>;
};

export function useDraftApiGetter(): () => Promise<DraftAPI> {
  return useMemo(() => {
    const useWorkerAPIClientHook = getWorkerClientHook<WorkerClientRef>();
    return async (): Promise<DraftAPI> => {
      if (!useWorkerAPIClientHook) {
        throw new Error('useDraftApiGetter requires Worker client context');
      }
      const client = useWorkerAPIClientHook();
      if (!client) {
        throw new Error('Worker client not initialized');
      }
      const api = client.getAPI();
      const wc = await api.getDraftAPI();
      return wc as unknown as DraftAPI;
    };
  }, []);
}

