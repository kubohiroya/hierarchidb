import { getWorkerClientHook, WorkerClientRef } from '@hierarchidb/runtime-client';
import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';

type DraftRecord = Record<string, unknown> & { id?: string };

type DraftAPI = {
  initTreeNode: (nodeType: string, parentId: string, initial?: unknown) => Promise<DraftRecord>;
  getTreeNode: (nodeId: string) => Promise<DraftRecord | undefined>;
  updateTreeNodeDraftMetadata: (nodeId: string, updater: Record<string, unknown>) => Promise<void>;
  updateTreeNodeDraftData: (nodeId: string, updater: Record<string, unknown>) => Promise<void>;
  commitDraft: (nodeId: string) => Promise<unknown>;
  discardDraft: (nodeId: string) => Promise<void>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const extractDraftId = (value: unknown, fallback?: string | null): string | null => {
  if (isRecord(value) && 'id' in value && typeof (value as Record<string, unknown>).id === 'string') {
    return (value as Record<string, unknown>).id as string;
  }
  return fallback ?? null;
};

export interface UseDraftOptions<TDraft> {
  nodeType: string;
  mode: 'create' | 'edit';
  nodeId?: string;
  parentId?: string;
  /** Optional mapper that converts raw worker payloads into desired working copy shape. */
  mapFromWorker?: (raw: unknown) => TDraft;
}

export interface UseDraftResult<TDraft> {
  wcId: string | null;
  draft: TDraft | null;
  setDraft: Dispatch<SetStateAction<TDraft | null>>;
  init: () => Promise<void>;
  commit: () => Promise<void>;
  discard: () => Promise<void>;
  loading: boolean;
  error: unknown;
}

export function useDraft<TDraft>(
  options: UseDraftOptions<TDraft>,
): UseDraftResult<TDraft> {
  const { nodeType, mode, nodeId, parentId, mapFromWorker } = options;

  const [wcId, setWcId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const committedRef = useRef(false);

  const mapDraft = useCallback(
    (raw: unknown): TDraft | null => {
      if (raw == null) return null;
      if (mapFromWorker) return mapFromWorker(raw);
      return raw as TDraft;
    },
    [mapFromWorker],
  );

  const getDraftAPI = useCallback(async (): Promise<DraftAPI> => {
    const workerHook = getWorkerClientHook<WorkerClientRef | null>();
    if (!workerHook) {
      throw new Error('Worker client hook is not registered.');
    }

    const ref = workerHook();
    if (!ref) {
      throw new Error('Worker client is not initialized.');
    }

    const api = ref.getAPI();
    const wc = await api.getDraftAPI();
    return wc as unknown as DraftAPI;
  }, []);

  const init = useCallback(async () => {
    setLoading(true);
    setError(null);
    committedRef.current = false;

    try {
      const wc = await getDraftAPI();

      if (mode === 'edit') {
        if (!nodeId) {
          throw new Error('Edit mode requires nodeId.');
        }
        const raw = await wc.getTreeNode(nodeId);
        setDraft(mapDraft(raw));
        setWcId(extractDraftId(raw, nodeId));
        return;
      }

      if (mode === 'create') {
        if (!parentId) {
          throw new Error('Create mode requires parentId.');
        }

        const draft = await wc.initTreeNode(nodeType, parentId, {});
        const draftId = extractDraftId(draft, draft.id as string | undefined);
        const resolvedId = draftId ?? (draft.id as string | null);
        const raw = resolvedId ? await wc.getTreeNode(resolvedId) : draft;
        setDraft(mapDraft(raw));
        setWcId(extractDraftId(raw, resolvedId) ?? resolvedId);
        return;
      }

      throw new Error(`Unsupported working copy mode: ${mode}`);
    } catch (err) {
      setError(err);
      setDraft(null);
      setWcId(null);
    } finally {
      setLoading(false);
    }
  }, [getDraftAPI, mapDraft, mode, nodeId, nodeType, parentId]);

  const commit = useCallback(async () => {
    const targetId = wcId ?? nodeId ?? null;
    if (!targetId) {
      throw new Error('No working copy id available to commit.');
    }

    setLoading(true);
    setError(null);

    try {
      const wc = await getDraftAPI();
      await wc.commitDraft(targetId);
      committedRef.current = true;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getDraftAPI, nodeId, wcId]);

  const discard = useCallback(async () => {
    if (!wcId || committedRef.current) return;

    const wc = await getDraftAPI();
    await wc.discardDraft(wcId);
    setWcId(null);
  }, [getDraftAPI, wcId]);

  return {
    wcId,
    draft,
    setDraft,
    init,
    commit,
    discard,
    loading,
    error,
  } satisfies UseDraftResult<TDraft>;
}
