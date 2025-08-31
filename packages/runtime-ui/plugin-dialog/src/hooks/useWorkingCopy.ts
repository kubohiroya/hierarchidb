/**
 * Working Copy Hook
 * Manages working copy lifecycle for dialog editing with Worker communication
 */

import { useState, useEffect, useCallback } from 'react';
import { NodeId, TreeId } from '@hierarchidb/common-type';

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
}: UseWorkingCopyOptions): UseWorkingCopyResult {
  const [workingCopy, setWorkingCopy] = useState<WorkingCopyData | null>(null);
  const [originalCopy, setOriginalCopy] = useState<WorkingCopyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Initialize working copy
  useEffect(() => {
    async function initializeWorkingCopy() {
      setLoading(true);
      setError(null);

      try {
        if (mode === 'edit' && nodeId) {
          // Load existing node data
          // TODO: Call Worker API to get node data
          const nodeData = await loadNodeData(nodeId, treeId);
          
          const copy: WorkingCopyData = {
            treeNodeId: nodeId,
            name: nodeData.name || '',
            description: nodeData.description || '',
            data: nodeData.data || {},
          };
          
          setWorkingCopy(copy);
          setOriginalCopy(copy);
        } else if (mode === 'create') {
          // Create new working copy
          const newNodeId = generateNodeId() as NodeId;
          
          const copy: WorkingCopyData = {
            treeNodeId: newNodeId,
            name: '',
            description: '',
            data: {},
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
  }, [mode, nodeId, treeId]);

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
    if (!workingCopy) {
      throw new Error('No working copy to save');
    }

    const finalData = data ? { ...workingCopy, ...data } : workingCopy;
    
    try {
      setLoading(true);
      
      // TODO: Call Worker API to save
      const savedNodeId = await saveNodeToDatabase({
        mode,
        nodeType,
        parentId,
        treeId,
        data: finalData,
      });
      
      // Update original copy
      setOriginalCopy(finalData);
      
      return savedNodeId;
    } catch (err) {
      console.error('Failed to save working copy:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [workingCopy, mode, nodeType, parentId, treeId]);

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
      
      // TODO: Call Worker API to delete working copy
      await deleteWorkingCopy(workingCopy.treeNodeId);
      
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

// Placeholder functions - these should be replaced with actual Worker API calls

async function loadNodeData(_nodeId: NodeId, _treeId: TreeId): Promise<any> {
  // TODO: Implement Worker API call
  return {
    name: 'Sample Node',
    description: 'Sample description',
    data: {},
  };
}

async function saveNodeToDatabase(options: {
  mode: 'create' | 'edit';
  nodeType: string;
  parentId?: NodeId;
  treeId: TreeId;
  data: WorkingCopyData;
}): Promise<NodeId> {
  // TODO: Implement Worker API call
  return options.data.treeNodeId;
}

async function deleteWorkingCopy(_nodeId: NodeId): Promise<void> {
  // TODO: Implement Worker API call
}

function generateNodeId(): string {
  // Generate UUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}