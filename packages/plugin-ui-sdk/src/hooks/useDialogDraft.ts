import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NodeId,
  TreeId,
  TreeNode,
  NodeType,
  TreeNodeMetadata,
  TreeNodeUpdaterPayload,
} from '@hierarchidb/common-types';
import type { DiscardDraftOptions, DraftAPI, TreeQueryAPI } from '@hierarchidb/common-api';
import type { WorkerClientRef } from '@hierarchidb/ui-worker-provider';
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

export interface DraftData<TPayload extends object = Record<string, unknown>>
  extends TreeNodeUpdaterPayload<TPayload> {
  id: NodeId;
  treeNodeId: NodeId;
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

export interface UseDialogDraftResult<TPayload extends object = Record<string, unknown>> {
  draft: DraftData<TPayload> | null;
  hasUnsavedChanges: boolean;
  updateDraft: (data: Partial<DraftData<TPayload>>) => void;
  saveDraft: (data?: Partial<DraftData<TPayload>>) => Promise<NodeId>;
  discardDraft: (options?: DiscardDraftOptions) => Promise<void>;
  loading: boolean;
  error: Error | null;
}

export function useDialogDraft<TPayload extends object = Record<string, unknown>>({
  mode,
  nodeType,
  nodeId,
  parentId,
  treeId,
  workerClient,
}: UseDialogDraftOptions): UseDialogDraftResult<TPayload> {
  const [draft, setDraft] = useState<DraftData<TPayload> | null>(null);
  const [originalCopy, setOriginalCopy] = useState<DraftData<TPayload> | null>(null);
  const [workingNodeId, setWorkingNodeId] = useState<NodeId | null>(nodeId ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const draftIdRef = useRef<NodeId | null>(nodeId ?? null);

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

  const toDraftData = useCallback((node: TreeNode): DraftData<TPayload> => {
    const metaSource =
      (node as { draftMetadata?: TreeNodeMetadata | null }).draftMetadata ??
      node.metadata ??
      ({ name: '' } as TreeNodeMetadata);
    const draft: TPayload =
      node.draftData && isRecord(node.draftData) ? (node.draftData as TPayload) : ({} as TPayload);
    return {
      id: node.id as NodeId,
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
        setWorkingNodeId(copy.treeNodeId);
        draftIdRef.current = copy.treeNodeId;
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
          setWorkingNodeId(copy.treeNodeId);
          draftIdRef.current = copy.treeNodeId;
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
        const targetId = next.treeNodeId ?? workingNodeId;
        if (!targetId) return;
        try {
          const { wc: wcAPI } = await getClient();
          await wcAPI.updateTreeNodeDraftMetadata(targetId, next.draftMetadata ?? {});
          if (next.draftData) {
            await wcAPI.updateTreeNodeDraftData(
              targetId,
              next.draftData as Record<string, unknown>
            );
          }
        } catch (err) {
          console.warn('[useDraft] persist update failed', err);
        }
      }, 150),
    [getClient, workingNodeId]
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
          id: prev.id,
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
    const targetId = (data?.treeNodeId ?? draft.treeNodeId ?? workingNodeId) as NodeId | null;
    if (!targetId) throw new Error('nodeId is required to save draft');
    const finalData = data
      ? { ...draft, ...data, id: targetId, treeNodeId: targetId }
      : { ...draft, id: targetId, treeNodeId: targetId };

    try {
      setLoading(true);
      const { wc: wcAPI } = await getClient();

      await wcAPI.updateTreeNodeDraftMetadata(targetId, finalData.draftMetadata ?? {});
      if (finalData.draftData) {
        await wcAPI.updateTreeNodeDraftData(
          targetId,
          finalData.draftData as Record<string, unknown>
        );
      }

      const res = await wcAPI.commitDraft(targetId, {
        onNameConflict: 'auto-rename',
      });

      if (res.status === 'ok') {
        const committedNodeId = (res.node?.id as NodeId | undefined) ?? res.nodeId ?? targetId;

        let refreshedCopy: DraftData<TPayload> = {
          ...finalData,
          id: committedNodeId,
          treeNodeId: committedNodeId,
        };
        if (res.node) {
          refreshedCopy = { ...toDraftData(res.node), id: committedNodeId, treeNodeId: committedNodeId };
        }

        setDraft(refreshedCopy);
        setOriginalCopy(refreshedCopy);
        setWorkingNodeId(committedNodeId);
        draftIdRef.current = committedNodeId;
        return committedNodeId;
      }

      throw new Error(`Working copy commit failed: ${res.status}`);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [draft, getClient, toDraftData, workingNodeId]);

  const discardDraft = useCallback(async (options?: DiscardDraftOptions) => {
    const targetId = draft?.treeNodeId ?? workingNodeId;
    if (!targetId) return;
    const { wc: wcAPI } = await getClient();
    await wcAPI.discardDraft(targetId, options);
    setDraft(null);
    setOriginalCopy(null);
    setWorkingNodeId(null);
    draftIdRef.current = null;
  }, [draft?.treeNodeId, getClient, workingNodeId]);

  useEffect(() => {
    draftIdRef.current = workingNodeId ?? nodeId ?? null;
  }, [nodeId, workingNodeId]);

  useEffect(() => {
    // Skip if worker client is unavailable or no working copy has been established yet
    if (!workerClient || !nodeId) {
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
  }, [getClient, workerClient, nodeId]);

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
