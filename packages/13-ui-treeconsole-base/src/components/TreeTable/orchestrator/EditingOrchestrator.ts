/**
 * EditingOrchestrator
 *
 * インライン編集に関するユーザーストーリーの管理
 * - 編集開始/終了
 * - 値の検証
 * - 保存/キャンセル
 */

import { useAtom } from 'jotai';
import { useCallback, useRef } from 'react';
import type { NodeId } from '@hierarchidb/00-core';
import type { TreeViewController } from '../../../types/index';
import { editingNodeIdAtom, editingValueAtom } from '../state';

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
 * 編集操作のオーケストレーター
 */
export function useEditingOrchestrator(
  controller: TreeViewController | null
): EditingOrchestratorResult {
  // State atoms
  const [editingNodeId, setEditingNodeId] = useAtom(editingNodeIdAtom);
  const [editingValue, setEditingValue] = useAtom(editingValueAtom);

  // Refs for validation
  const originalValueRef = useRef<string>('');

  // 編集開始
  const startEdit = useCallback(
    (nodeId: string, initialValue: string) => {
      setEditingNodeId(nodeId);
      setEditingValue(initialValue);
      originalValueRef.current = initialValue;

      // Controllerに通知
      controller?.startEdit?.(nodeId as NodeId);
    },
    [setEditingNodeId, setEditingValue, controller]
  );

  // 値の更新
  const updateValue = useCallback(
    (value: string) => {
      setEditingValue(value);
    },
    [setEditingValue]
  );

  // 編集確定
  const confirmEdit = useCallback(async () => {
    if (!editingNodeId) return;

    const newValue = editingValue.trim();

    // 検証: 空文字チェック
    if (!newValue) {
      console.warn('Node name cannot be empty');
      setEditingValue(originalValueRef.current);
      return;
    }

    // 検証: 変更チェック
    if (newValue === originalValueRef.current) {
      setEditingNodeId(null);
      setEditingValue('');
      return;
    }

    try {
      // Controllerを通じて更新を実行
      // Use finishEdit method which should handle the update
      controller?.finishEdit?.(editingNodeId as NodeId, newValue);

      // 成功したらクリア
      setEditingNodeId(null);
      setEditingValue('');
      originalValueRef.current = '';
    } catch (error) {
      console.error('Failed to update node name:', error);
      // エラー時は元の値に戻す
      setEditingValue(originalValueRef.current);
    }
  }, [editingNodeId, editingValue, setEditingNodeId, setEditingValue, controller]);

  // 編集キャンセル
  const cancelEdit = useCallback(() => {
    setEditingNodeId(null);
    setEditingValue('');
    originalValueRef.current = '';

    // Controllerに通知
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
