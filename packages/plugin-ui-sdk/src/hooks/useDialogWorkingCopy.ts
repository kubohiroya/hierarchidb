import { useCallback, useEffect, useRef, useState } from 'react';
import { NodeId, TreeId, TreeNode, NodeType } from '@hierarchidb/common-types';
import type { WorkingCopyAPI, TreeQueryAPI } from '@hierarchidb/common-api';
import type { WorkerClientRef } from '@hierarchidb/runtime-client';
import type { WorkerAPI } from '@hierarchidb/common-api';
import { Remote } from 'comlink';

export interface WorkingCopyData {
  treeNodeId: NodeId;
  name: string;
  description?: string;
  data?: Record<string, unknown>;
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

  const toWorkingCopyData = useCallback((node: Partial<TreeNode> & { data?: unknown }): WorkingCopyData => {
    const treeNodeId = (typeof node?.id === 'string' ? node.id : nodeId) as NodeId;
    const description = typeof node?.description === 'string' ? node.description : undefined;
    const data = isRecord(node.data) ? node.data : undefined;
    return {
      treeNodeId,
      name: typeof node?.name === 'string' ? node.name : '',
      description,
      data,
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
          await wcAPI.createWorkingCopyFromNode(nodeId);
          const wc = await wcAPI.getWorkingCopy(nodeId);
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
          }

          if (parentId) {
            const wcNode = await wcAPI.createDraftWorkingCopy(nodeType as NodeType, parentId, { name: '' });
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

  const updateWorkingCopy = useCallback((data: Partial<WorkingCopyData>) => {
    setWorkingCopy(prev => {
      if (!prev) return null;
      return { ...prev, ...data } satisfies WorkingCopyData;
    });
  }, []);

  const saveWorkingCopy = useCallback(async (data?: Partial<WorkingCopyData>): Promise<NodeId> => {
    if (!workingCopy) throw new Error('No working copy to save');
    const finalData = data ? { ...workingCopy, ...data } : workingCopy;

    try {
      setLoading(true);
      const { wc: wcAPI, query } = await getClient();

      const normalizedData: Record<string, unknown> = { ...(finalData.data ?? {}) };
      const likedSet = normalizedData['likedNodeIdSet'];
      if (likedSet instanceof Set) {
        normalizedData['likedNodeIdSet'] = Array.from(likedSet);
      }

      const updatePayload: Partial<TreeNode> & { data?: Record<string, unknown> } = {
        name: finalData.name,
        description: finalData.description,
        data: normalizedData,
      };
      await wcAPI.updateWorkingCopy(finalData.treeNodeId, updatePayload as Partial<TreeNode>);

      const wcNode = await query.getNode(finalData.treeNodeId);
      if (!wcNode) throw new Error('Working copy not found');
      const holder = await query.getNode(wcNode.parentId);
      const targetNodeId: NodeId | undefined = holder?.holderTargetId;

      const res = await wcAPI.commitWorkingCopy(finalData.treeNodeId);

      if (res.status === 'ok') {
        const committedNodeId = (res.node?.id as NodeId | undefined)
          ?? res.nodeId
          ?? targetNodeId
          ?? finalData.treeNodeId;

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
    if (!workingCopy) return;
    const { wc: wcAPI } = await getClient();
    await wcAPI.discardWorkingCopy(workingCopy.treeNodeId);
    setWorkingCopy(null);
    setOriginalCopy(null);
  }, [workingCopy, getClient]);

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
