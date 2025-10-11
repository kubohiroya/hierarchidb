/**
 * Working Copy Hook
 * Manages working copy lifecycle for dialog editing with Worker communication
 */

import { useCallback, useEffect, useState } from 'react';
import { NodeId, TreeId, TreeNode, NodeType } from '@hierarchidb/common-types';
import type { WorkerAPI, WorkingCopyAPI, TreeQueryAPI } from '@hierarchidb/common-api';
import type { WorkerClientRef } from '@hierarchidb/runtime-worker-bootstrap';
import { Remote } from 'comlink';

export interface WorkingCopyData {
  treeNodeId: NodeId;
  name: string;
  description?: string;
  data?: Record<string, unknown>;
  isDraft?: boolean;
}

export interface UseWorkingCopyOptions {
  mode: 'create' | 'edit';
  nodeType: string;
  nodeId?: NodeId;
  parentId?: NodeId;
  treeId: TreeId;
  /** Optional Worker client holder provided by host component */
  workerClient?: WorkerClientRef | null;
}

export interface UseWorkingCopyResult {
  workingCopy: WorkingCopyData | null;
  hasUnsavedChanges: boolean;
  updateWorkingCopy: (data: Partial<WorkingCopyData>) => void;
  saveWorkingCopy: (data?: Partial<WorkingCopyData>) => Promise<NodeId>;
  saveDraft: (data?: Partial<WorkingCopyData>) => Promise<NodeId>;
  discardWorkingCopy: () => Promise<void>;
  loading: boolean;
  error: Error | null;
}

/**
 * Working Copy Hook
 */
export function useWorkingCopy({
                                 mode,
                                 nodeType,
                                 nodeId,
                                 parentId,
                                 treeId,
                                 workerClient,
                               }: UseWorkingCopyOptions): UseWorkingCopyResult {
  const [workingCopy, setWorkingCopy] = useState<WorkingCopyData | null>(null);
  const [originalCopy, setOriginalCopy] = useState<WorkingCopyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null
  );

  const toWorkingCopyData = useCallback((node: Partial<TreeNode> & { data?: unknown }): WorkingCopyData => {
    const treeNodeId = (typeof node?.id === 'string' ? node.id : nodeId) as NodeId;
    const description = typeof node?.description === 'string' ? node.description : undefined;
    const data = isRecord(node.data) ? node.data : undefined;
    return {
      treeNodeId,
      name: typeof node?.name === 'string' ? node.name : '',
      description,
      data,
    };
  }, [nodeId]);

  // Resolve WorkerAPI client provided by host-supplied Worker client holder
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

  // Initialize working copy (wait until client is available)
  useEffect(() => {
    async function initializeWorkingCopy() {
      // Defer until host provided Worker client is ready
      if (!workerClient) return;
      setLoading(true);
      setError(null);

      try {
      const { wc: wcAPI } = await getClient();

      if (mode === 'edit' && nodeId) {
        // Create WC from existing node and load it
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
            // Create a draft WC under the parent when one does not exist yet
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

  // Check for unsaved changes
  const hasUnsavedChanges = useCallback(() => {
    if (!workingCopy || !originalCopy) return false;
    return JSON.stringify(workingCopy) !== JSON.stringify(originalCopy);
  }, [workingCopy, originalCopy]);

  // Update working copy
  const updateWorkingCopy = useCallback((data: Partial<WorkingCopyData>) => {
    setWorkingCopy(prev => {
      if (!prev) return null;
      return { ...prev, ...data };
    });
  }, []);

  // Save working copy
  const saveWorkingCopy = useCallback(async (data?: Partial<WorkingCopyData>): Promise<NodeId> => {
    console.debug("[Folder-create]");
    if (!workingCopy) throw new Error('No working copy to save');
    const finalData = data ? { ...workingCopy, ...data } : workingCopy;

    try {
      setLoading(true);
      const { wc: wcAPI, query } = await getClient();

      // Normalize data (convert Set to Array where necessary)
      const normalizedData: Record<string, unknown> = { ...(finalData.data ?? {}) };
      const likedSet = normalizedData['likedNodeIdSet'];
      if (likedSet instanceof Set) {
        normalizedData['likedNodeIdSet'] = Array.from(likedSet);
      }

      // Update WC (name/description/data)
      const updatePayload: Partial<TreeNode> & { data?: Record<string, unknown> } = {
        name: finalData.name,
        description: finalData.description,
        data: normalizedData,
      };
      await wcAPI.updateWorkingCopy(finalData.treeNodeId, updatePayload as Partial<TreeNode>);

      // Determine target node id before commit (read holder metadata)
      const wcNode = await query.getNode(finalData.treeNodeId);
      if (!wcNode) throw new Error('Working copy not found');
      const holder = await query.getNode(wcNode.parentId);
      const targetNodeId: NodeId | undefined = holder?.holderTargetId;

      // Commit
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

        setOriginalCopy(refreshedCopy);
        setWorkingCopy(refreshedCopy);

        return committedNodeId;
      }

      if (res.status === 'NAME_CONFLICT') {
        throw new Error(`NAME_CONFLICT:${res.suggestedName}`);
      }

      if (res.status === 'COMMIT_CONFLICT') {
        throw new Error('COMMIT_CONFLICT');
      }

      throw new Error('Commit failed with unknown status');
    } catch (err) {
      console.error('Failed to save working copy:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [workingCopy]);

  // Save as draft
  const saveDraft = useCallback(async (data?: Partial<WorkingCopyData>): Promise<NodeId> => {
    const draftData = {
      ...data,
      isDraft: true,
    };
    return saveWorkingCopy(draftData);
  }, [saveWorkingCopy]);

  // Discard working copy
  const discardWorkingCopy = useCallback(async () => {
    if (!workingCopy) return;
    try {
      setLoading(true);
      const { wc: wcAPI } = await getClient();
      await wcAPI.discardWorkingCopy(workingCopy.treeNodeId);
      setWorkingCopy(null);
      setOriginalCopy(null);
    } catch (err) {
      console.error('Failed to discard working copy:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [workingCopy]);

  return {
    workingCopy,
    hasUnsavedChanges: hasUnsavedChanges(),
    updateWorkingCopy,
    saveWorkingCopy,
    saveDraft,
    discardWorkingCopy,
    loading,
    error,
  };
}

// Removed placeholders: this hook now uses WorkerAPI via getWorkerClientHook
