/**
 * useTreeTableEditing
 * Centralises inline editing atoms and helpers for TreeTable rows.
 */

import { useCallback, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { getTreeNodeDescription, getTreeNodeName } from '@hierarchidb/tree-api';
import type { TreeTableController, TreeNodeInUI } from '~/types';

interface UseTreeTableEditingParams {
  controller: TreeTableController | null;
}

interface UseTreeTableEditingResult {
  editingNodeId: string | null;
  setEditingNodeId: Dispatch<SetStateAction<string | null>>;
  editingField: 'name' | 'description' | null;
  setEditingField: Dispatch<SetStateAction<'name' | 'description' | null>>;
  editingValue: string;
  setEditingValue: Dispatch<SetStateAction<string>>;
  editingError: string | null;
  setEditingError: Dispatch<SetStateAction<string | null>>;
  validateInline: (field: 'name' | 'description', value: string) => { ok: boolean; message?: string };
  handleStartEdit: (node: TreeNodeInUI, field?: 'name' | 'description') => void;
}

export function useTreeTableEditing({ controller }: UseTreeTableEditingParams): UseTreeTableEditingResult {
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'name' | 'description' | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [editingError, setEditingError] = useState<string | null>(null);

  const validateInline = useCallback((field: 'name' | 'description', value: string) => {
    const trimmed = (value ?? '').trim();
    if (field === 'name') {
      if (!trimmed) return { ok: false, message: 'Name is required' };
      if (trimmed.length > 120) return { ok: false, message: 'Name is too long' };
    } else {
      if (trimmed.length > 2000) return { ok: false, message: 'Description is too long' };
    }
    return { ok: true };
  }, []);

  const handleStartEdit = useCallback((node: TreeNodeInUI, field: 'name' | 'description' = 'name') => {
    setEditingNodeId(node.id);
    setEditingField(field);
    const initial = field === 'name' ? getTreeNodeName(node) : getTreeNodeDescription(node);
    setEditingValue(initial);
    controller?.startEdit?.(node.id);
  }, [controller]);

  return {
    editingNodeId,
    setEditingNodeId,
    editingField,
    setEditingField,
    editingValue,
    setEditingValue,
    editingError,
    setEditingError,
    validateInline,
    handleStartEdit,
  };
}
