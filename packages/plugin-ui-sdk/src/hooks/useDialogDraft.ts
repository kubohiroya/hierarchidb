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
  draftMetadata: TreeNodeMetadata;
  draftData: TPayload;
  metadata?: TreeNodeMetadata; // persisted/mainline metadata
  data?: Record<string, unknown>; // persisted/mainline data
}

export interface UseDialogDraftOptions {
  mode: 'create' | 'edit';
  nodeType: string;
  nodeId?: NodeId;
  parentId?: NodeId;
  treeId?: TreeId;
  /** Optional Worker client holder provided by host component */
  workerClient?: WorkerClientRef | null;
}

export interface UseDialogDraftResult<TPayload = Record<string, unknown>> {
  draft: DraftData<TPayload> | null;
  hasUnsavedChanges: boolean;
  updateDraft: (data: Partial<DraftData<TPayload>>) => void;
  saveDraft: (data?: Partial<DraftData<TPayload>>) => Promise<NodeId>;
  discardDraft: () => Promise<void>;
  loading: boolean;
  error: Error | null;
}

export function useDialogDraft<TPayload = Record<string, unknown>>({
  mode,
  nodeType,
  nodeId,
  parentId,
  treeId,
  workerClient,
}: UseDialogDraftOptions): UseDialogDraftResult<TPayload> {
  const [draft, setDraft] = useState<DraftData<TPayload> | null>(null);
  const [originalCopy, setOriginalCopy] = useState<DraftData<TPayload> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const draftIdRef = useRef<NodeId | null>(null);

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

  const toDraftData = useCallback((node: TreeNode): DraftData<TPayload> => {
    const metaSource = (node as { draftMetadata?: TreeNodeMetadata | null }).draftMetadata ?? node.metadata;
    const draft: TPayload =
      node.draftData && isRecord(node.draftData) ? (node.draftData as TPayload) : ({} as TPayload);
    return {
      treeNodeId: node.id as NodeId,
      draftMetadata: metaSource,
      metadata: node.metadata,
      data: node.data as Record<string, unknown> | undefined,
      draftData: draft,
    };
  }, []);

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
          const existing = await wcAPI.getTreeNode(nodeId);
          if (!existing) throw new Error('Working copy not found for edit');
          const copy = toDraftData(existing);
          setDraft(copy);
          setOriginalCopy(copy);
          return;
        }

        if (mode === 'create') {
          if (!parentId) {
            console.warn('[useDraft] Missing parentId for create mode; working copy not initialized');
            return;
          }
          const wcNode = await wcAPI.initTreeNode(nodeType as NodeType, parentId, nodeId ? { id: nodeId } : {});
          const copy = toDraftData(wcNode);
          setDraft(copy);
          setOriginalCopy(copy);
          return;
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
      debounce(async (next: DraftData<TPayload>) => {
        try {
          const { wc: wcAPI } = await getClient();
          await wcAPI.updateTreeNodeDraftMetadata(next.treeNodeId, next.draftMetadata);
          if (next.draftData) {
            await wcAPI.updateTreeNodeDraftData(
              next.treeNodeId,
              next.draftData as Record<string, unknown>
            );
          }
        } catch (err) {
          console.warn('[useDraft] persist update failed', err);
        }
      }, 150),
    [getClient]
  );

  const updateDraft = useCallback(
    (data: Partial<DraftData<TPayload>>) => {
      setDraft((prev) => {
        if (!prev) return null;
        const nextDraftMetadata =
          data.draftMetadata ??
          // compatibility: allow callers to pass metadata and map it to draftMetadata
          data.metadata ??
          prev.draftMetadata;
        const merged: DraftData<TPayload> = {
          treeNodeId: prev.treeNodeId,
          draftMetadata: nextDraftMetadata,
          draftData: data.draftData ?? prev.draftData,
          metadata: data.metadata ?? prev.metadata,
          data: prev.data,
        };
        persistDraft(merged);
        return merged;
      });
    },
    [persistDraft]
  );

  const saveDraft = useCallback(async (data?: Partial<DraftData<TPayload>>): Promise<NodeId> => {
    if (!draft) throw new Error('No working copy to save');
    const finalData = data ? { ...draft, ...data } : draft;

    try {
      setLoading(true);
      const { wc: wcAPI } = await getClient();

      await wcAPI.updateTreeNodeDraftMetadata(finalData.treeNodeId, finalData.draftMetadata);
      if (finalData.draftData) {
        await wcAPI.updateTreeNodeDraftData(
          finalData.treeNodeId,
          finalData.draftData as Record<string, unknown>
        );
      }

      const res = await wcAPI.commitDraft(finalData.treeNodeId, {
        onNameConflict: 'auto-rename',
      });

      if (res.status === 'ok') {
        const committedNodeId = (res.node?.id as NodeId | undefined) ?? res.nodeId ?? finalData.treeNodeId;

        let refreshedCopy: DraftData<TPayload> = { ...finalData, treeNodeId: committedNodeId };
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
  } satisfies UseDialogDraftResult<TPayload>;
}
