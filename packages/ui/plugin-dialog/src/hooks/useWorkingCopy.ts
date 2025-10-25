import { getWorkerClientHook, WorkerClientRef } from '@hierarchidb/runtime-client';
import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';

type WorkingCopyAPI = {
  createDraftWorkingCopy: (nodeType: string, parentId: string, initial?: unknown) => Promise<string>;
  getWorkingCopy: (nodeId: string) => Promise<unknown>;
  commitWorkingCopy: (nodeId: string) => Promise<unknown>;
  discardWorkingCopy: (nodeId: string) => Promise<void>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const extractWorkingCopyId = (value: unknown, fallback?: string | null): string | null => {
  if (isRecord(value) && 'id' in value && typeof (value as Record<string, unknown>).id === 'string') {
    return (value as Record<string, unknown>).id as string;
  }
  return fallback ?? null;
};

export interface UseWorkingCopyOptions<TWorkingCopy> {
  nodeType: string;
  mode: 'create' | 'edit';
  nodeId?: string;
  parentId?: string;
  /** Optional mapper that converts raw worker payloads into desired working copy shape. */
  mapFromWorker?: (raw: unknown) => TWorkingCopy;
}

export interface UseWorkingCopyResult<TWorkingCopy> {
  wcId: string | null;
  workingCopy: TWorkingCopy | null;
  setWorkingCopy: Dispatch<SetStateAction<TWorkingCopy | null>>;
  init: () => Promise<void>;
  commit: () => Promise<void>;
  discard: () => Promise<void>;
  loading: boolean;
  error: unknown;
}

export function useWorkingCopy<TWorkingCopy>(
  options: UseWorkingCopyOptions<TWorkingCopy>,
): UseWorkingCopyResult<TWorkingCopy> {
  const { nodeType, mode, nodeId, parentId, mapFromWorker } = options;

  const [wcId, setWcId] = useState<string | null>(null);
  const [workingCopy, setWorkingCopy] = useState<TWorkingCopy | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const committedRef = useRef(false);

  const mapWorkingCopy = useCallback(
    (raw: unknown): TWorkingCopy | null => {
      if (raw == null) return null;
      if (mapFromWorker) return mapFromWorker(raw);
      return raw as TWorkingCopy;
    },
    [mapFromWorker],
  );

  const getWorkingCopyAPI = useCallback(async (): Promise<WorkingCopyAPI> => {
    const workerHook = getWorkerClientHook<() => WorkerClientRef | null>();
    if (!workerHook) {
      throw new Error('Worker client hook is not registered.');
    }

    const ref = workerHook();
    if (!ref) {
      throw new Error('Worker client is not initialized.');
    }

    const api = ref.getAPI();
    const wc = await api.getWorkingCopyAPI();
    return wc as unknown as WorkingCopyAPI;
  }, []);

  const init = useCallback(async () => {
    setLoading(true);
    setError(null);
    committedRef.current = false;

    try {
      const wc = await getWorkingCopyAPI();

      if (mode === 'edit') {
        if (!nodeId) {
          throw new Error('Edit mode requires nodeId.');
        }
        const raw = await wc.getWorkingCopy(nodeId);
        setWorkingCopy(mapWorkingCopy(raw));
        setWcId(extractWorkingCopyId(raw, nodeId));
        return;
      }

      if (mode === 'create') {
        if (!parentId) {
          throw new Error('Create mode requires parentId.');
        }
        const createdId = await wc.createDraftWorkingCopy(nodeType, parentId, {});
        const raw = await wc.getWorkingCopy(createdId);
        setWorkingCopy(mapWorkingCopy(raw));
        setWcId(extractWorkingCopyId(raw, createdId) ?? createdId);
        return;
      }

      throw new Error(`Unsupported working copy mode: ${mode}`);
    } catch (err) {
      setError(err);
      setWorkingCopy(null);
      setWcId(null);
    } finally {
      setLoading(false);
    }
  }, [getWorkingCopyAPI, mapWorkingCopy, mode, nodeId, nodeType, parentId]);

  const commit = useCallback(async () => {
    const targetId = wcId ?? nodeId ?? null;
    if (!targetId) {
      throw new Error('No working copy id available to commit.');
    }

    setLoading(true);
    setError(null);

    try {
      const wc = await getWorkingCopyAPI();
      await wc.commitWorkingCopy(targetId);
      committedRef.current = true;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getWorkingCopyAPI, nodeId, wcId]);

  const discard = useCallback(async () => {
    if (!wcId || committedRef.current) return;

    const wc = await getWorkingCopyAPI();
    await wc.discardWorkingCopy(wcId);
    setWcId(null);
  }, [getWorkingCopyAPI, wcId]);

  return {
    wcId,
    workingCopy,
    setWorkingCopy,
    init,
    commit,
    discard,
    loading,
    error,
  };
}
