/**
 * @fileoverview useWorkingCopy - Hook for managing temporary working copy state
 */

import { useState, useCallback, useEffect, useRef } from 'react';
// import { useSnackbar } from 'notistack'; // Temporarily disabled to fix build

// Export aliases for backwards compatibility
export type UseWorkingCopyOptions<T = unknown> = WorkingCopyOptions<T>;
export type UseWorkingCopyReturn<T = unknown> = WorkingCopyState<T>;

export interface WorkingCopyOptions<T = unknown> {
  mode: 'create' | 'edit';
  nodeId?: string;
  parentNodeId?: string;
  initialData: T;
  autoSave?: boolean;
  autoSaveDelay?: number;
  onSave?: (data: T) => Promise<void>;
  onCommit: (data: T) => Promise<void>;
  onDiscard?: () => Promise<void>;
}

export interface WorkingCopyState<T = unknown> {
  workingCopy: T;
  updateWorkingCopy: (updates: Partial<T>) => void;
  commitChanges: () => Promise<void>;
  discardWorkingCopy: () => Promise<void>;
  saveAsDraft?: () => Promise<void>;
  isDirty: boolean;
  isProcessing: boolean;
  error: Error | null;
}

export function useWorkingCopy<T = any>({
  mode,
  nodeId: _nodeId,
  parentNodeId: _parentNodeId,
  initialData,
  autoSave = true,
  autoSaveDelay = 1000,
  onSave,
  onCommit,
  onDiscard,
}: WorkingCopyOptions<T>): WorkingCopyState<T> {
  const [workingCopy, setWorkingCopy] = useState<T>(initialData);
  const [originalData] = useState<T>(initialData);
  const [isDirty, setIsDirty] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // const { enqueueSnackbar } = useSnackbar(); // Temporarily disabled to fix build
  const enqueueSnackbar = (message: string, options?: { variant?: string }) => {
    console.log(`[${options?.variant || 'info'}] ${message}`);
  };
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  
  // Update working copy
  const updateWorkingCopy = useCallback((updates: Partial<T>) => {
    setWorkingCopy(prev => {
      const updated = { ...prev, ...updates };
      
      // Check if data is dirty
      const isDataDirty = JSON.stringify(updated) !== JSON.stringify(originalData);
      setIsDirty(isDataDirty);
      
      // Schedule auto-save if enabled
      if (autoSave && onSave && isDataDirty) {
        if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current);
        }
        
        autoSaveTimeoutRef.current = setTimeout(() => {
          onSave(updated).catch(err => {
            console.warn('Auto-save failed:', err);
            enqueueSnackbar('Auto-save failed', { variant: 'warning' });
            setError(err);
          });
        }, autoSaveDelay);
      }
      
      return updated;
    });
  }, [originalData, autoSave, onSave, autoSaveDelay, enqueueSnackbar]);
  
  // Commit changes to permanent storage
  const commitChanges = useCallback(async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    setError(null);
    
    try {
      await onCommit(workingCopy);
      setIsDirty(false);
      enqueueSnackbar(`${mode === 'create' ? 'Created' : 'Updated'} successfully`, { 
        variant: 'success' 
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Commit failed');
      setError(error);
      enqueueSnackbar(`Failed to ${mode === 'create' ? 'create' : 'update'}: ${error.message}`, { 
        variant: 'error' 
      });
      console.error('Commit error:', error.message);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [workingCopy, isProcessing, onCommit, mode, enqueueSnackbar]);
  
  // Discard changes
  const discardWorkingCopy = useCallback(async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    
    try {
      if (onDiscard) {
        await onDiscard();
      }
      
      // Clear auto-save timeout
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      
      setWorkingCopy(originalData);
      setIsDirty(false);
      setError(null);
      enqueueSnackbar('Changes discarded', { variant: 'info' });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Discard failed');
      setError(error);
      enqueueSnackbar(`Failed to discard changes: ${error.message}`, { 
        variant: 'error' 
      });
      console.error('Discard error:', error.message);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, onDiscard, originalData, enqueueSnackbar]);
  
  // Save as draft (if supported)
  const saveAsDraft = useCallback(async () => {
    if (!onSave || isProcessing) return;
    
    setIsProcessing(true);
    setError(null);
    
    try {
      await onSave(workingCopy);
      setIsDirty(false);
      enqueueSnackbar('Saved as draft', { variant: 'success' });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Save draft failed');
      setError(error);
      enqueueSnackbar(`Failed to save draft: ${error.message}`, { 
        variant: 'error' 
      });
      console.error('Save draft error:', error.message);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [workingCopy, onSave, isProcessing, enqueueSnackbar]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);
  
  return {
    workingCopy,
    updateWorkingCopy,
    commitChanges,
    discardWorkingCopy,
    saveAsDraft: onSave ? saveAsDraft : undefined,
    isDirty,
    isProcessing,
    error,
  };
}