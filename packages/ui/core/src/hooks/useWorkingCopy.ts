import { useCallback, useMemo, useRef, useState } from 'react';
import { getWorkerClientHook, type WorkerClientRef } from '@hierarchidb/runtime-worker-bootstrap';

type WorkingCopyAPI = {
  createDraftWorkingCopy: (nodeType: string, parentId: string, initial?: any) => Promise<string>;
  getWorkingCopy: (nodeId: string) => Promise<any>;
  commitWorkingCopy: (nodeId: string) => Promise<string>;
  discardWorkingCopy: (nodeId: string) => Promise<void>;
};

export interface UseWorkingCopyOptions {
  nodeType: string;
  mode: 'create' | 'edit';
  nodeId?: string;     // when edit
  parentId?: string;   // when create
}

export interface UseWorkingCopyResult<T = any> {
  wcId: string | null;
  workingCopy: T | null;
  setWorkingCopy: (updater: (prev: T) => T) => void;
  init: () => Promise<void>;
  commit: () => Promise<void>;
  discard: () => Promise<void>;
  loading: boolean;
  error: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const extractWorkingCopyId = (value: unknown, fallback: string): string => {
  if (isRecord(value) && 'id' in value && typeof value.id === 'string') {
    return value.id;
  }
  return fallback;
};

export function useWorkingCopy<T = any>(opts: UseWorkingCopyOptions): UseWorkingCopyResult<T> {
  const { nodeType, mode, nodeId, parentId } = opts;
  const useWorker = getWorkerClientHook<WorkerClientRef>();
  const [wcId, setWcId] = useState<string | null>(null);
  const [workingCopy, _setWorkingCopy] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const committedRef = useRef(false);

  const getAPI = useMemo(() => async (): Promise<WorkingCopyAPI> => {
    if (!useWorker) throw new Error('Worker client not available');
    const ref = useWorker();
    if (!ref) throw new Error('Worker client not initialized');
    const api = ref.getAPI();
    const wc = await api.getWorkingCopyAPI();
    return wc as unknown as WorkingCopyAPI;
  }, [useWorker]);

  const setWorkingCopy = useCallback((updater: (prev: T) => T) => {
    _setWorkingCopy((prev) => (prev ? updater(prev) : prev));
  }, []);

  const init = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const wc = await getAPI();
      if (mode === 'edit' && nodeId) {
        const data = await wc.getWorkingCopy(nodeId);
        _setWorkingCopy((data ?? null) as T | null);
        setWcId(extractWorkingCopyId(data, nodeId));
      } else if (mode === 'create' && parentId) {
        const id = await wc.createDraftWorkingCopy(nodeType, parentId, {});
        const data = await wc.getWorkingCopy(id);
        _setWorkingCopy((data ?? null) as T | null);
        setWcId(id);
      }
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [getAPI, mode, nodeId, parentId, nodeType]);

  const commit = useCallback(async () => {
    if (!wcId && !nodeId) return;
    try {
      const wc = await getAPI();
      await wc.commitWorkingCopy((wcId ?? nodeId) as string);
      committedRef.current = true;
    } catch (e) {
      setError(e);
      throw e;
    }
  }, [getAPI, wcId, nodeId]);

  const discard = useCallback(async () => {
    if (!wcId || committedRef.current) return;
    try {
      const wc = await getAPI();
      await wc.discardWorkingCopy(wcId);
    } catch (e) {
      // best-effort discard; do not rethrow
    }
  }, [getAPI, wcId]);

  return { wcId, workingCopy, setWorkingCopy, init, commit, discard, loading, error };
}
