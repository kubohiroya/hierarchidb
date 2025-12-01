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

export interface TreeNodeUpdaterState<TPayload extends object = Record<string, unknown>>
  extends TreeNodeUpdaterPayload<TPayload> {
  id: NodeId;
  treeNodeId: NodeId;
  metadata?: TreeNodeMetadata;
  data?: Record<string, unknown>;
  draftMetadata: TreeNodeMetadata;
  draftData: TPayload;
}

export interface UseTreeNodeUpdaterOptions<TPayload extends object = Record<string, unknown>> {
  mode: 'create' | 'edit';
  nodeType: string;
  nodeId?: NodeId;
  parentId?: NodeId;
  treeId?: TreeId;
  workerClient?: WorkerClientRef | null;
  initialDraftData?: TPayload;
  initialDraftMetadata?: TreeNodeMetadata;
}

export interface UseTreeNodeUpdaterResult<TPayload extends object = Record<string, unknown>> {
  treeNodeUpdater: TreeNodeUpdaterState<TPayload> | null;
  hasUnsavedChanges: boolean;
  updateTreeNodeUpdater: (data: Partial<TreeNodeUpdaterState<TPayload>>) => void;
  commitTreeNodeUpdater: (data?: Partial<TreeNodeUpdaterState<TPayload>>) => Promise<NodeId>;
  discardDraft: (options?: DiscardDraftOptions) => Promise<void>;
  loading: boolean;
  error: Error | null;
  /** Deprecated aliases (for compatibility while migrating naming) */
  draft: TreeNodeUpdaterState<TPayload> | null;
  updateDraft: (data: Partial<TreeNodeUpdaterState<TPayload>>) => void;
  saveDraft: (data?: Partial<TreeNodeUpdaterState<TPayload>>) => Promise<NodeId>;
}

export type DraftData<TPayload extends object = Record<string, unknown>> = TreeNodeUpdaterState<TPayload>;

export function useTreeNodeUpdater<TPayload extends object = Record<string, unknown>>({
  mode,
  nodeType,
  nodeId,
  parentId,
  treeId,
  workerClient,
  initialDraftData,
  initialDraftMetadata,
}: UseTreeNodeUpdaterOptions<TPayload>): UseTreeNodeUpdaterResult<TPayload> {
  const [draft, setDraft] = useState<TreeNodeUpdaterState<TPayload> | null>(null);
  const [originalCopy, setOriginalCopy] = useState<TreeNodeUpdaterState<TPayload> | null>(null);
  const [workingNodeId, setWorkingNodeId] = useState<NodeId | null>(nodeId ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const draftIdRef = useRef<NodeId | null>(nodeId ?? null);
  const [hasUnsaved, setHasUnsaved] = useState(false);

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

  const toUpdater = useCallback((node: TreeNode): TreeNodeUpdaterState<TPayload> => {
    const draftMetadata: TreeNodeMetadata =
      (node as { draftMetadata?: TreeNodeMetadata | null }).draftMetadata ??
      ({ name: '' } as TreeNodeMetadata);
    const draftData: TPayload =
      node.draftData && isRecord(node.draftData) ? (node.draftData as TPayload) : ({} as TPayload);
    return {
      id: node.id as NodeId,
      treeNodeId: node.id as NodeId,
      draftMetadata,
      metadata: node.metadata,
      data: node.data as Record<string, unknown> | undefined,
      draftData,
    };
  }, []);

  const getClient = useCallback(async (): Promise<{ wc: DraftAPI; query: TreeQueryAPI; remote: Remote<WorkerAPI> }> => {
    if (!workerClient) throw new Error('Worker client not initialized');
    const api = workerClient.getAPI();
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
          const copy = toUpdater(existing);
          setDraft(copy);
          setOriginalCopy(copy);
          setWorkingNodeId(copy.treeNodeId);
          draftIdRef.current = copy.treeNodeId;
          return;
        }

        if (mode === 'create') {
          if (!parentId) {
            console.warn('[useDialogDraft] Missing parentId for create mode; working copy not initialized');
            return;
          }
          const initialPayload: Partial<TreeNode> = {
            ...(nodeId ? { id: nodeId } : {}),
            ...(initialDraftMetadata ? { draftMetadata: initialDraftMetadata } : {}),
            ...(initialDraftData
              ? { draftData: initialDraftData as unknown as Record<string, unknown> }
              : {}),
          };
          const wcNode = await wcAPI.initTreeNode(
            nodeType as NodeType,
            parentId,
            initialPayload
          );
          const copy = toUpdater(wcNode);
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
  }, [workerClient, mode, nodeId, parentId, nodeType, treeId, toUpdater, getClient]);

  const computeUnsaved = useCallback(() => {
    if (!draft || !originalCopy) return false;
    return JSON.stringify(draft) !== JSON.stringify(originalCopy);
  }, [draft, originalCopy]);

  useEffect(() => {
    setHasUnsaved(computeUnsaved());
  }, [computeUnsaved, draft, originalCopy]);

  const persistTreeNodeUpdater = useMemo(
    () =>
      debounce(async (next: TreeNodeUpdaterState<TPayload>) => {
        const targetId = next.treeNodeId ?? workingNodeId;
        if (!targetId) return;
        try {
          const { wc: wcAPI } = await getClient();
          await wcAPI.updateTreeNodeDraftMetadata(targetId, next.draftMetadata ?? {});
          await wcAPI.updateTreeNodeDraftData(
            targetId,
            (next.draftData ?? {}) as Record<string, unknown>
          );
        } catch (err) {
          console.warn('[useDialogDraft] persist update failed', err);
        }
      }, 150),
    [getClient, workingNodeId]
  );

  const updateTreeNodeUpdater = useCallback(
    (data: Partial<TreeNodeUpdaterState<TPayload>>) => {
      setDraft((prev) => {
        if (!prev) return null;
        const nextDraftMetadata: TreeNodeMetadata = {
          ...(prev.draftMetadata ?? {}),
          ...(data.metadata ?? {}),
          ...(data.draftMetadata ?? {}),
        };
        const nextDraftData: TPayload =
          (data.draftData
            ? ({ ...(prev.draftData ?? ({} as TPayload)), ...data.draftData } as TPayload)
            : prev.draftData) ?? ({} as TPayload);
        const merged: TreeNodeUpdaterState<TPayload> = {
          id: prev.id,
          treeNodeId: prev.treeNodeId,
          draftMetadata: nextDraftMetadata,
          draftData: nextDraftData,
          metadata: data.metadata ?? prev.metadata,
          data: prev.data,
        };
        persistTreeNodeUpdater(merged);
        return merged;
      });
    },
    [persistTreeNodeUpdater]
  );

  const commitTreeNodeUpdater = useCallback(async (data?: Partial<TreeNodeUpdaterState<TPayload>>): Promise<NodeId> => {
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
      await wcAPI.updateTreeNodeDraftData(
        targetId,
        (finalData.draftData ?? {}) as Record<string, unknown>
      );

      const res = await wcAPI.commitDraft(targetId, {
        onNameConflict: 'auto-rename',
      });

      if (res.status === 'ok') {
        const committedNodeId = (res.node?.id as NodeId | undefined) ?? res.nodeId ?? targetId;

        let refreshedCopy: TreeNodeUpdaterState<TPayload> = {
          ...finalData,
          id: committedNodeId,
          treeNodeId: committedNodeId,
        };
        if (res.node) {
          refreshedCopy = { ...toUpdater(res.node), id: committedNodeId, treeNodeId: committedNodeId };
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
  }, [draft, getClient, toUpdater, workingNodeId]);

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
    treeNodeUpdater: draft,
    hasUnsavedChanges: hasUnsaved,
    updateTreeNodeUpdater,
    commitTreeNodeUpdater,
    discardDraft,
    loading,
    error,
    draft,
    updateDraft: updateTreeNodeUpdater,
    saveDraft: commitTreeNodeUpdater,
  };
}
