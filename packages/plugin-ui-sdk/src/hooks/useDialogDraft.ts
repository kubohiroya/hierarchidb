import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NodeId, TreeId, TreeNode, NodeType, TreeNodeMetadata } from '@hierarchidb/common-types';
import type { DraftAPI, TreeQueryAPI } from '@hierarchidb/common-api';
import type { WorkerClientRef } from '@hierarchidb/runtime-client';
import type { WorkerAPI } from '@hierarchidb/common-api';
import { Remote } from 'comlink';

// Minimal debounce to avoid pulling additional deps in the SDK hook.
const debounce = <T extends (...args: any[]) => void>(fn: T, wait: number) => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, wait);
  };
};

export interface DraftData<TPayload = Record<string, unknown>> {
  treeNodeId: NodeId;
  metadata: TreeNodeMetadata;
  draftData: TPayload;
}

export interface UseDialogDraftOptions {
  mode: 'create' | 'edit';
  nodeType: string;
  nodeId?: NodeId;
  parentId?: NodeId;
  treeId: TreeId;
  /** Optional Worker client holder provided by host component */
  workerClient?: WorkerClientRef | null;
}

export interface UseDialogDraftResult {
  draft: DraftData | null;
  hasUnsavedChanges: boolean;
  updateDraft: (data: Partial<DraftData>) => void;
  saveDraft: (data?: Partial<DraftData>) => Promise<NodeId>;
  discardDraft: () => Promise<void>;
  loading: boolean;
  error: Error | null;
}

export function useDialogDraft({
  mode,
  nodeType,
  nodeId,
  parentId,
  treeId,
  workerClient,
}: UseDialogDraftOptions): UseDialogDraftResult {
  const [draft, setDraft] = useState<DraftData | null>(null);
  const [originalCopy, setOriginalCopy] = useState<DraftData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const draftIdRef = useRef<NodeId | null>(null);

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

  const toDraftData = useCallback((node: Partial<TreeNode> & { data?: unknown; draftData?: unknown }): DraftData => {
    const treeNodeId = (typeof node?.id === 'string' ? node.id : nodeId) as NodeId;
    const meta: TreeNodeMetadata = {
      name: String((node as { metadata?: { name?: string } }).metadata?.name ?? ''),
      description: (node as { metadata?: { description?: string } }).metadata?.description ?? undefined,
      tags: (() => {
        const fromMeta = (node as { metadata?: { tags?: unknown } }).metadata?.tags;
        if (Array.isArray(fromMeta)) {
          return fromMeta.filter((v): v is string => typeof v === 'string');
        }
        const fromDraft = (node as { draftMetadata?: { tags?: unknown } }).draftMetadata?.tags;
        if (Array.isArray(fromDraft)) {
          return fromDraft.filter((v): v is string => typeof v === 'string');
        }
        return undefined;
      })(),
    };
    const draft = isRecord((node as { draftData?: unknown }).draftData)
      ? ((node as { draftData?: Record<string, unknown> }).draftData as Record<string, unknown>)
      : {};
    return {
      treeNodeId,
      metadata: meta,
      draftData: draft,
    };
  }, [nodeId]);

  const getClient = useCallback(async (): Promise<{ wc: DraftAPI; query: TreeQueryAPI; remote: Remote<WorkerAPI> }> => {
    if (!workerClient) throw new Error('Worker client not initialized');
    let api: Remote<WorkerAPI>;
    try {
      api = workerClient.getAPI();
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      throw normalized;
    }
    const wc = await api.getDraftAPI();
    const query = await api.getQueryAPI();
    return { wc, query, remote: api };
  }, [workerClient]);

  useEffect(() => {
    async function initializeDraft() {
      if (!workerClient) return;
      setLoading(true);
      setError(null);

      try {
        const { wc: wcAPI } = await getClient();

        if (mode === 'edit' && nodeId) {
          let wc = await wcAPI.getDraft(nodeId);
          if (!wc) {
            await wcAPI.createDraftFromNode(nodeId);
            wc = await wcAPI.getDraft(nodeId);
          }
          if (!wc) throw new Error('Failed to create working copy');
          const copy = toDraftData(wc);
          setDraft(copy);
          setOriginalCopy(copy);
          return;
        }

        if (mode === 'create') {
          if (nodeId) {
            const existing = await wcAPI.getDraft(nodeId);
            if (existing) {
              const copy = toDraftData(existing);
              setDraft(copy);
              setOriginalCopy(copy);
              return;
            }
            if (!parentId) {
              throw new Error('Working copy for create target not found');
            }
            // Recreate draft using the expected nodeId to keep routing consistent
            const wcNode = await wcAPI.createDraftBase(nodeType as NodeType, parentId, {
              id: nodeId,
              metadata: { name: '', description: '' },
            } as Partial<TreeNode>);
            const copy = toDraftData(wcNode);
            setDraft(copy);
            setOriginalCopy(copy);
            return;
          }

          if (parentId) {
            const wcNode = await wcAPI.createDraftBase(nodeType as NodeType, parentId, {
              metadata: { name: '', description: '' },
            });
            const copy = toDraftData(wcNode);
            setDraft(copy);
            setOriginalCopy(copy);
            return;
          }

          console.warn('[useDraft] Missing parentId for create mode; working copy not initialized');
        }
      } catch (err) {
        console.error('Failed to initialize working copy:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    initializeDraft();
  }, [workerClient, mode, nodeId, parentId, nodeType, treeId, toDraftData, getClient]);

  const hasUnsavedChanges = useCallback(() => {
    if (!draft || !originalCopy) return false;
    return JSON.stringify(draft) !== JSON.stringify(originalCopy);
  }, [draft, originalCopy]);

  const persistDraft = useMemo(
    () =>
      debounce(async (next: DraftData) => {
        try {
          const { wc: wcAPI } = await getClient();
          await wcAPI.updateDraft(next.treeNodeId, {
            metadata: next.metadata,
            draftData: next.draftData,
          } as Partial<TreeNode>);
        } catch (err) {
          console.warn('[useDraft] persist update failed', err);
        }
      }, 150),
    [getClient]
  );

  const updateDraft = useCallback(
    (data: Partial<DraftData>) => {
      setDraft((prev) => {
        if (!prev) return null;
        const merged: DraftData = {
          treeNodeId: prev.treeNodeId,
          metadata: data.metadata ?? prev.metadata,
          draftData: data.draftData ?? prev.draftData,
        };
        persistDraft(merged);
        return merged;
      });
    },
    [persistDraft]
  );

  const saveDraft = useCallback(async (data?: Partial<DraftData>): Promise<NodeId> => {
    if (!draft) throw new Error('No working copy to save');
    const finalData = data ? { ...draft, ...data } : draft;

    try {
      setLoading(true);
      const { wc: wcAPI } = await getClient();

      await wcAPI.updateDraft(finalData.treeNodeId, {
        metadata: finalData.metadata,
        draftData: finalData.draftData,
      } as Partial<TreeNode>);

      const res = await wcAPI.commitDraft(finalData.treeNodeId, {
        onNameConflict: 'auto-rename',
      });

      if (res.status === 'ok') {
        const committedNodeId = (res.node?.id as NodeId | undefined) ?? res.nodeId ?? finalData.treeNodeId;

        let refreshedCopy: DraftData = { ...finalData, treeNodeId: committedNodeId };
        if (res.node) {
          refreshedCopy = { ...toDraftData(res.node), treeNodeId: committedNodeId };
        }

        setDraft(refreshedCopy);
        setOriginalCopy(refreshedCopy);
        return committedNodeId;
      }

      throw new Error(`Working copy commit failed: ${res.status}`);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [draft, getClient, toDraftData]);

  const discardDraft = useCallback(async () => {
    const targetId = draft?.treeNodeId ?? nodeId;
    if (!targetId) return;
    const { wc: wcAPI } = await getClient();
    await wcAPI.discardDraft(targetId);
    setDraft(null);
    setOriginalCopy(null);
  }, [draft, nodeId, getClient]);

  useEffect(() => {
    draftIdRef.current = draft?.treeNodeId ?? null;
  }, [draft?.treeNodeId]);

  useEffect(() => {
    // Skip if worker client is unavailable or no working copy has been established yet
    if (!workerClient || !draft?.treeNodeId) {
      return undefined;
    }

    let hasRequestedAutoDiscard = false;

    const requestAutoDiscard = () => {
      if (hasRequestedAutoDiscard) return;
      const currentId = draftIdRef.current;
      if (!currentId) return;
      hasRequestedAutoDiscard = true;
      queueMicrotask(() => {
        getClient()
          .then(({ wc: wcAPI }) => wcAPI.discardDraft(currentId));
      });
    };

    const handlePageHide = (event: Event) => {
      const maybePageTransition = event as PageTransitionEvent | undefined;
      if (maybePageTransition?.persisted) return;
      requestAutoDiscard();
    };

    const handleBeforeUnload = () => {
      requestAutoDiscard();
    };

    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [getClient, workerClient, draft?.treeNodeId]);

  return {
    draft,
    hasUnsavedChanges: hasUnsavedChanges(),
    updateDraft,
    saveDraft,
    discardDraft,
    loading,
    error,
  } satisfies UseDialogDraftResult;
}
