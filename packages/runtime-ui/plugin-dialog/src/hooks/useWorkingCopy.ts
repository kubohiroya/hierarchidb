/**
 * Working Copy Hook
 * Manages working copy lifecycle for dialog editing with Worker communication
 */

import { useCallback, useEffect, useState } from 'react';
import type { NodeId, TreeId, TreeNode, NodeType } from '@hierarchidb/common-type';
import type { WorkerAPI } from '@hierarchidb/common-api';

export type WorkingCopyData = Partial<{
  treeNodeId: NodeId;
  name: string;
  description?: string;
  data?: Record<string, unknown>;
  isDraft?: boolean;
}>;

export interface UseWorkingCopyOptions {
  mode: 'create' | 'edit';
  nodeType: string;
  nodeId?: NodeId;
  parentId?: NodeId;
  treeId: TreeId;
  workerAPI: WorkerAPI|null;
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
                                 workerAPI,
                               }: UseWorkingCopyOptions): UseWorkingCopyResult {
  const [workingCopy, setWorkingCopy] = useState<WorkingCopyData>({});
  const [originalCopy, setOriginalCopy] = useState<WorkingCopyData>({});
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

  // Initialize working copy (wait until client is available)
  useEffect(() => {
    async function initializeWorkingCopy() {
      // Defer until host provided Worker client is ready

      setLoading(true);
      setError(null);

      try {
        console.log("[initialize-working-copy] 0");
        const workingCopyAPI = workerAPI?.getWorkingCopyAPI();
        if (!workingCopyAPI) {
          throw new Error('WorkingCopyAPI not available from WorkerAPI');
        }
        if (mode === 'edit' && nodeId) {
          // Create WC from existing node and load it
          console.log("[initialize-working-copy] edit");

          await workingCopyAPI.createWorkingCopyFromNode(nodeId);
          const wc = await workingCopyAPI.getWorkingCopy(nodeId);
          if (!wc) throw new Error('Failed to create working copy');
          const copy = toWorkingCopyData(wc);
          setWorkingCopy(copy);
          setOriginalCopy(copy);
          return;
        }

        if (mode === 'create') {
          if (nodeId) {
            console.log("[initialize-working-copy] create");
            const existing = await workingCopyAPI.getWorkingCopy(nodeId);
            if (existing) {
              const copy = toWorkingCopyData(existing);
              setWorkingCopy(copy);
              setOriginalCopy(copy);
              return;
            }
          }

          if (parentId) {
            // Create a draft WC under the parent when one does not exist yet
            const wcNode = await workingCopyAPI.createDraftWorkingCopy(nodeType as NodeType, parentId, { name: '' });
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
  }, [workerAPI, mode, nodeId, parentId, nodeType, treeId, toWorkingCopyData]);

  // Check for unsaved changes
  const hasUnsavedChanges = useCallback(() => {
    if (!workingCopy || !originalCopy) return false;
    return JSON.stringify(workingCopy) !== JSON.stringify(originalCopy);
  }, [workingCopy, originalCopy]);

  // Update working copy
  const updateWorkingCopy = useCallback((data: Partial<WorkingCopyData>) => {
    setWorkingCopy(prev => {
      if (!prev) return {};
      return { ...prev, ...data };
    });
  }, []);

  // Save working copy
  const saveWorkingCopy = useCallback(async (data?: WorkingCopyData): Promise<NodeId> => {
    if (!workingCopy) throw new Error('No working copy to save');
    const finalData = { ...workingCopy, ...data };
    try {
      setLoading(true);
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

      if(!workerAPI) throw new Error('WorkerAPI not available');
      if(!finalData.treeNodeId)throw new Error('finalData.treeNodeId is undefined');
      await workerAPI.getWorkingCopyAPI().updateWorkingCopy(finalData.treeNodeId, updatePayload as Partial<TreeNode>);

      // Determine target node id before commit (read holder metadata)
      const wcNode = await workerAPI.getQueryAPI().getNode(finalData.treeNodeId);
      if (!wcNode) throw new Error('Working copy not found');
      const holder = await workerAPI.getQueryAPI().getNode(wcNode.parentId);
      const targetNodeId: NodeId | undefined = holder?.holderTargetId;

      // Commit
      const res = await workerAPI.getWorkingCopyAPI().commitWorkingCopy(finalData.treeNodeId);
      if (!res?.success) throw new Error(res?.error || 'Commit failed');

      const committedNodeId = (res.node?.id as NodeId | undefined)
        ?? targetNodeId
        ?? finalData.treeNodeId;

      // Update original copy snapshot with latest data
      setOriginalCopy({ ...finalData, treeNodeId: committedNodeId });

      return committedNodeId;
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
    if (! workingCopy || ! workingCopy.treeNodeId) return;
    //if(!workingCopy.treeNodeId)throw new Error('workingCopy.treeNodeId is undefined');
    try {
      setLoading(true);
      await workerAPI?.getWorkingCopyAPI().discardWorkingCopy(workingCopy.treeNodeId);
      setWorkingCopy({});
      setOriginalCopy({});
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
