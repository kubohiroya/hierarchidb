import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NodeId, TreeId, TreeNode, NodeType } from '@hierarchidb/common-types';
import type { WorkingCopyAPI, TreeQueryAPI } from '@hierarchidb/common-api';
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

export interface WorkingCopyData {
  treeNodeId: NodeId;
  name: string;
  description?: string;
  data?: Record<string, unknown>;
  draftData?: Record<string, unknown>;
  isDraft?: boolean;
}

export interface UseDialogWorkingCopyOptions {
  mode: 'create' | 'edit';
  nodeType: string;
  nodeId?: NodeId;
  parentId?: NodeId;
  treeId: TreeId;
  /** Optional Worker client holder provided by host component */
  workerClient?: WorkerClientRef | null;
}

export interface UseDialogWorkingCopyResult {
  workingCopy: WorkingCopyData | null;
  hasUnsavedChanges: boolean;
  updateWorkingCopy: (data: Partial<WorkingCopyData>) => void;
  saveWorkingCopy: (data?: Partial<WorkingCopyData>) => Promise<NodeId>;
  saveDraft: (data?: Partial<WorkingCopyData>) => Promise<NodeId>;
  discardWorkingCopy: () => Promise<void>;
  loading: boolean;
  error: Error | null;
}

export function useDialogWorkingCopy({
  mode,
  nodeType,
  nodeId,
  parentId,
  treeId,
  workerClient,
}: UseDialogWorkingCopyOptions): UseDialogWorkingCopyResult {
  const [workingCopy, setWorkingCopy] = useState<WorkingCopyData | null>(null);
  const [originalCopy, setOriginalCopy] = useState<WorkingCopyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const workingCopyIdRef = useRef<NodeId | null>(null);

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

  const toWorkingCopyData = useCallback((node: Partial<TreeNode> & { data?: unknown; draftData?: unknown }): WorkingCopyData => {
    const treeNodeId = (typeof node?.id === 'string' ? node.id : nodeId) as NodeId;
    const description: string = String(
      (node as { metadata?: { description?: string } }).metadata?.description ?? ''
    );
    const draft = isRecord((node as { draftData?: unknown }).draftData)
      ? ((node as { draftData?: Record<string, unknown> }).draftData as Record<string, unknown>)
      : undefined;
    const data = draft ?? (isRecord(node.data) ? node.data : undefined);
    const name: string = String(
      (node as { metadata?: { name?: string } }).metadata?.name ?? ''
    );
    return {
      treeNodeId,
      name,
      description,
      data,
      draftData: data,
    } satisfies WorkingCopyData;
  }, [nodeId]);

  const getClient = useCallback(async (): Promise<{ wc: WorkingCopyAPI; query: TreeQueryAPI; remote: Remote<WorkerAPI> }> => {
    if (!workerClient) throw new Error('Worker client not initialized');
    let api: Remote<WorkerAPI>;
    try {
      api = workerClient.getAPI();
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      throw normalized;
    }
    const wc = await api.getWorkingCopyAPI();
    const query = await api.getQueryAPI();
    return { wc, query, remote: api };
  }, [workerClient]);

  useEffect(() => {
    async function initializeWorkingCopy() {
      if (!workerClient) return;
      setLoading(true);
      setError(null);

      try {
        const { wc: wcAPI } = await getClient();

        if (mode === 'edit' && nodeId) {
          let wc = await wcAPI.getWorkingCopy(nodeId);
          if (!wc) {
            await wcAPI.createWorkingCopyFromNode(nodeId);
            wc = await wcAPI.getWorkingCopy(nodeId);
          }
          if (!wc) throw new Error('Failed to create working copy');
          const copy = toWorkingCopyData(wc);
          setWorkingCopy(copy);
          setOriginalCopy(copy);
          return;
        }

        if (mode === 'create') {
          if (nodeId) {
            const existing = await wcAPI.getWorkingCopy(nodeId);
            if (existing) {
              const copy = toWorkingCopyData(existing);
              setWorkingCopy(copy);
              setOriginalCopy(copy);
              return;
            }
            if (!parentId) {
              throw new Error('Working copy for create target not found');
            }
            // Recreate draft using the expected nodeId to keep routing consistent
            const wcNode = await wcAPI.createDraftWorkingCopy(nodeType as NodeType, parentId, {
              id: nodeId,
              metadata: { name: '', description: '' },
            } as Partial<TreeNode>);
            const copy = toWorkingCopyData(wcNode);
            setWorkingCopy(copy);
            setOriginalCopy(copy);
            return;
          }

          if (parentId) {
            const wcNode = await wcAPI.createDraftWorkingCopy(nodeType as NodeType, parentId, {
              metadata: { name: '', description: '' },
            });
            const copy = toWorkingCopyData(wcNode);
            setWorkingCopy(copy);
            setOriginalCopy(copy);
            return;
          }

          console.warn('[useWorkingCopy] Missing parentId for create mode; working copy not initialized');
        }
      } catch (err) {
        console.error('Failed to initialize working copy:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    initializeWorkingCopy();
  }, [workerClient, mode, nodeId, parentId, nodeType, treeId, toWorkingCopyData, getClient]);

  const hasUnsavedChanges = useCallback(() => {
    if (!workingCopy || !originalCopy) return false;
    return JSON.stringify(workingCopy) !== JSON.stringify(originalCopy);
  }, [workingCopy, originalCopy]);

  const persistWorkingCopy = useMemo(
    () =>
      debounce(async (next: WorkingCopyData) => {
        try {
          const { wc: wcAPI } = await getClient();
          const payload = (next.draftData ?? next.data) as Record<string, unknown> | undefined;
          await wcAPI.updateWorkingCopy(next.treeNodeId, {
            metadata: { name: next.name, description: next.description },
            draftData: payload,
          } as Partial<TreeNode>);
        } catch (err) {
          console.warn('[useWorkingCopy] persist update failed', err);
        }
      }, 150),
    [getClient]
  );

  const updateWorkingCopy = useCallback(
    (data: Partial<WorkingCopyData>) => {
      setWorkingCopy((prev) => {
        if (!prev) return null;
        const merged = { ...prev, ...data } satisfies WorkingCopyData;
        if (data.draftData && !data.data) {
          merged.data = data.draftData;
        }
        persistWorkingCopy(merged);
        return merged;
      });
    },
    [persistWorkingCopy]
  );

  const saveWorkingCopy = useCallback(async (data?: Partial<WorkingCopyData>): Promise<NodeId> => {
    if (!workingCopy) throw new Error('No working copy to save');
    const finalData = data ? { ...workingCopy, ...data } : workingCopy;

    try {
      setLoading(true);
      const { wc: wcAPI, query } = await getClient();

      const payloadSource = finalData.draftData ?? finalData.data ?? {};
      const normalizedDraft: Record<string, unknown> = {
        ...payloadSource,
      };
      const likedSet = normalizedDraft['likedNodeIdSet'];
      if (likedSet instanceof Set) {
        normalizedDraft['likedNodeIdSet'] = Array.from(likedSet);
      }

      const updatePayload: Partial<TreeNode> & {
        draftData?: Record<string, unknown>;
      } = {
        metadata: { name: finalData.name, description: finalData.description },
        draftData: normalizedDraft,
      };
      await wcAPI.updateWorkingCopy(finalData.treeNodeId, updatePayload as Partial<TreeNode>);

      const res = await wcAPI.commitWorkingCopy(finalData.treeNodeId, {
        onNameConflict: 'auto-rename',
      });

      if (res.status === 'ok') {
        const committedNodeId = (res.node?.id as NodeId | undefined) ?? res.nodeId ?? finalData.treeNodeId;

        let refreshedCopy: WorkingCopyData = { ...finalData, treeNodeId: committedNodeId };
        if (res.node) {
          refreshedCopy = { ...toWorkingCopyData(res.node), treeNodeId: committedNodeId };
        }

        setWorkingCopy(refreshedCopy);
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
  }, [workingCopy, getClient, toWorkingCopyData]);

  const saveDraft = useCallback(async (data?: Partial<WorkingCopyData>): Promise<NodeId> => {
    const nodeIdForCommit = await saveWorkingCopy(data);
    return nodeIdForCommit;
  }, [saveWorkingCopy]);

  const discardWorkingCopy = useCallback(async () => {
    const targetId = workingCopy?.treeNodeId ?? nodeId;
    if (!targetId) return;
    const { wc: wcAPI } = await getClient();
    await wcAPI.discardWorkingCopy(targetId);
    setWorkingCopy(null);
    setOriginalCopy(null);
  }, [workingCopy, nodeId, getClient]);

  useEffect(() => {
    workingCopyIdRef.current = workingCopy?.treeNodeId ?? null;
  }, [workingCopy?.treeNodeId]);

  useEffect(() => {
    // Skip if worker client is unavailable or no working copy has been established yet
    if (!workerClient || !workingCopy?.treeNodeId) {
      return undefined;
    }

    let hasRequestedAutoDiscard = false;

    const requestAutoDiscard = () => {
      if (hasRequestedAutoDiscard) return;
      const currentId = workingCopyIdRef.current;
      if (!currentId) return;
      hasRequestedAutoDiscard = true;
      queueMicrotask(() => {
        getClient()
          .then(({ wc: wcAPI }) => wcAPI.discardWorkingCopy(currentId));
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
  }, [getClient, workerClient, workingCopy?.treeNodeId]);

  return {
    workingCopy,
    hasUnsavedChanges: hasUnsavedChanges(),
    updateWorkingCopy,
    saveWorkingCopy,
    saveDraft,
    discardWorkingCopy,
    loading,
    error,
  } satisfies UseDialogWorkingCopyResult;
}
