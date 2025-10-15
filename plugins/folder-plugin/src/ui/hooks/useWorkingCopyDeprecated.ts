import { useMemo } from 'react';
import { getWorkerClientHook, type WorkerClientRef } from '../../../../../runtime/client';

type WorkingCopyAPI = {
  createDraftWorkingCopy: (nodeType: string, parentId: string, initial?: any) => Promise<string>;
  getWorkingCopy: (nodeId: string) => Promise<any>;
  commitWorkingCopy: (nodeId: string) => Promise<string>;
  discardWorkingCopy: (nodeId: string) => Promise<void>;
};

export function useWorkingCopyApiGetter(): () => Promise<WorkingCopyAPI> {
  return useMemo(() => {
    const useWorkerAPIClientHook = getWorkerClientHook<WorkerClientRef>();
    return async (): Promise<WorkingCopyAPI> => {
      if (!useWorkerAPIClientHook) {
        throw new Error('useWorkingCopyApiGetter requires Worker client context');
      }
      const client = useWorkerAPIClientHook();
      if (!client) {
        throw new Error('Worker client not initialized');
      }
      const api = client.getAPI();
      const wc = await api.getWorkingCopyAPI();
      return wc as unknown as WorkingCopyAPI;
    };
  }, []);
}

