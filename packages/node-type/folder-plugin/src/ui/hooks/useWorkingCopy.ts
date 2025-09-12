import { useMemo } from 'react';
import { getWorkerClientHook } from '@hierarchidb/runtime-worker-bootstrap';

type WorkingCopyAPI = {
  createDraftWorkingCopy: (nodeType: string, parentId: string, initial?: any) => Promise<string>;
  getWorkingCopy: (nodeId: string) => Promise<any>;
  commitWorkingCopy: (nodeId: string) => Promise<string>;
  discardWorkingCopy: (nodeId: string) => Promise<void>;
};

export function useWorkingCopyApiGetter(): () => Promise<WorkingCopyAPI> {
  return useMemo(() => {
    const useWorkerAPIClientHook = getWorkerClientHook();
    return async (): Promise<WorkingCopyAPI> => {
      if (!useWorkerAPIClientHook) {
        throw new Error('useWorkingCopyApiGetter requires Worker client context');
      }
      const client = useWorkerAPIClientHook();
      const api = client.getAPI();
      const wc = await api.getWorkingCopyAPI();
      return wc as unknown as WorkingCopyAPI;
    };
  }, []);
}

