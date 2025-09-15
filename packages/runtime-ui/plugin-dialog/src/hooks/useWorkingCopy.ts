/**
 * Working Copy Hook
 * Manages working copy lifecycle for dialog editing with Worker communication
 */

import { useCallback, useEffect, useState } from 'react';
import { NodeId, TreeId, TreeNode, NodeType } from '@hierarchidb/common-type';
import { getWorkerClientHook } from '@hierarchidb/runtime-worker-bootstrap';
import type { WorkerAPI, WorkingCopyAPI, TreeQueryAPI } from '@hierarchidb/common-api';

export interface WorkingCopyData {
  treeNodeId: NodeId;
  name: string;
  description?: string;
  data?: any;
  isDraft?: boolean;
}

export interface UseWorkingCopyOptions {
  mode: 'create' | 'edit';
  nodeType: string;
  nodeId?: NodeId;
  parentId?: NodeId;
  treeId: TreeId;
  /** Optional WorkerAPI provided by host component; if omitted, falls back to app hook. */
  client?: WorkerAPI | null;
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
                                 client,
                               }: UseWorkingCopyOptions): UseWorkingCopyResult {
  const [workingCopy, setWorkingCopy] = useState<WorkingCopyData | null>(null);
  const [originalCopy, setOriginalCopy] = useState<WorkingCopyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Resolve WorkerAPI client from app-registered hook (supports {client} or direct WorkerAPI)
  type WorkerRef = WorkerAPI | { client?: WorkerAPI } | null;
  const getClient = async (): Promise<{ wc: WorkingCopyAPI; query: TreeQueryAPI; raw: WorkerAPI }> => {
    // Prefer explicitly provided client from host (valid React hook context)
    let api: WorkerAPI | null = client ?? null;
    // No fallback to calling hooks here: hooks must be invoked only by the host component.
    if (!api) throw new Error('Worker client not initialized');
    const wc = await api.getWorkingCopyAPI();
    const query = await api.getQueryAPI();
    return { wc, query, raw: api };
  };

  // Initialize working copy (wait until client is available)
  useEffect(() => {
    async function initializeWorkingCopy() {
      // Defer until host provided Worker client is ready
      if (!client) return;
      setLoading(true);
      setError(null);

      try {
        const { wc: wcAPI } = await getClient();

        if (mode === 'edit' && nodeId) {
          // Create WC from existing node and load it
          await wcAPI.createWorkingCopyFromNode(nodeId);
          const wc = await wcAPI.getWorkingCopy(nodeId);
          if (!wc) throw new Error('Failed to create working copy');
          const copy: WorkingCopyData = {
            treeNodeId: wc.id as NodeId,
            name: wc.name || '',
            description: (wc as any).description || '',
            data: (wc as any).data || {},
          };
          setWorkingCopy(copy);
          setOriginalCopy(copy);
        } else if (mode === 'create' && parentId) {
          // Create a draft WC under the parent
          const wcNode = await wcAPI.createDraftWorkingCopy(nodeType as unknown as NodeType, parentId, { name: '' } as Partial<TreeNode>);
          const copy: WorkingCopyData = {
            treeNodeId: wcNode.id as NodeId,
            name: wcNode.name || '',
            description: (wcNode as any).description || '',
            data: (wcNode as any).data || {},
          };
          setWorkingCopy(copy);
          setOriginalCopy(copy);
        }
      } catch (err) {
        console.error('Failed to initialize working copy:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    initializeWorkingCopy();
  }, [client, mode, nodeId, parentId, nodeType, treeId]);

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
    if (!workingCopy) throw new Error('No working copy to save');
    const finalData = data ? { ...workingCopy, ...data } : workingCopy;

    try {
      setLoading(true);
      const { wc: wcAPI, query } = await getClient();

      // Normalize data (convert Set to Array where necessary)
      const normalizedData = (() => {
        const d: any = finalData.data ?? {};
        const out: any = { ...d };
        if (d && d.likedNodeIdSet instanceof Set) {
          out.likedNodeIdSet = Array.from(d.likedNodeIdSet as Set<string>);
        }
        return out;
      })();

      // Update WC (name/description/data)
      await wcAPI.updateWorkingCopy(finalData.treeNodeId, {
        name: finalData.name,
        description: finalData.description,
        data: normalizedData,
      } as Partial<TreeNode>);

      // Determine target node id before commit (read holder metadata)
      const wcNode = await query.getNode(finalData.treeNodeId);
      if (!wcNode) throw new Error('Working copy not found');
      const holder = await query.getNode(wcNode.parentId);
      const targetNodeId: NodeId | undefined = (holder as any)?.holderTargetId as NodeId | undefined;

      // Commit
      const res = await wcAPI.commitWorkingCopy(finalData.treeNodeId);
      if (!res?.success) throw new Error(res?.error || 'Commit failed');

      // Update original copy snapshot
      setOriginalCopy(finalData);

      return (targetNodeId || finalData.treeNodeId) as NodeId;
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
