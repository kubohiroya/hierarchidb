/**
  * EditingOrchestrator
   * - /
 * -
 * - /
  */

import { useAtom } from 'jotai';
import { useCallback, useRef } from 'react';
import type { NodeId } from '@hierarchidb/common-types';
import type { TreeViewController } from '../../../types/index.js';
import { editingNodeIdAtom, editingValueAtom } from '../state/index.js';

export interface EditingOrchestratorResult {
  // State
  editingNodeId: string | null;
  editingValue: string;
  isEditing: boolean;

  // Actions
  startEdit: (nodeId: string, initialValue: string) => void;
  updateValue: (value: string) => void;
  confirmEdit: () => Promise<void>;
  cancelEdit: () => void;
}

/**
    */
export function useEditingOrchestrator(
  controller: TreeViewController | null,
): EditingOrchestratorResult {
  // State atoms
  const [editingNodeId, setEditingNodeId] = useAtom(editingNodeIdAtom);
  const [editingValue, setEditingValue] = useAtom(editingValueAtom);

  // Refs for validation
  const originalValueRef = useRef<string>('');

  const startEdit = useCallback(
    (nodeId: string, initialValue: string) => {
      setEditingNodeId(nodeId);
      setEditingValue(initialValue);
      originalValueRef.current = initialValue;

      //  Controller
      controller?.startEdit?.(nodeId as NodeId);
    },
    [setEditingNodeId, setEditingValue, controller],
  );

  const updateValue = useCallback(
    (value: string) => {
      setEditingValue(value);
    },
    [setEditingValue],
  );

  const confirmEdit = useCallback(async () => {
    if (!editingNodeId) return;

    const newValue = editingValue.trim();

    //  :
    if (!newValue) {
      console.warn('Node name cannot be empty');
      setEditingValue(originalValueRef.current);
      return;
    }

    //  :
    if (newValue === originalValueRef.current) {
      setEditingNodeId(null);
      setEditingValue('');
      return;
    }

    try {
      //  Controller
      // Use finishEdit method which should handle the update
      controller?.finishEdit?.(editingNodeId as NodeId, newValue);

      setEditingNodeId(null);
      setEditingValue('');
      originalValueRef.current = '';
    } catch (error) {
      console.error('Failed to update node name:', error);
      setEditingValue(originalValueRef.current);
    }
  }, [editingNodeId, editingValue, setEditingNodeId, setEditingValue, controller]);

  const cancelEdit = useCallback(() => {
    setEditingNodeId(null);
    setEditingValue('');
    originalValueRef.current = '';

    //  Controller
    controller?.cancelEdit?.();
  }, [setEditingNodeId, setEditingValue, controller]);

  return {
    // State
    editingNodeId,
    editingValue,
    isEditing: editingNodeId !== null,

    // Actions
    startEdit,
    updateValue,
    confirmEdit,
    cancelEdit,
  };
}
