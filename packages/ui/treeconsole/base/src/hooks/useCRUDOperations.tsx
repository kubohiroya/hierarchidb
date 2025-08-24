/**
 * useCRUDOperations
 *
 * CRUD操作を専門に扱う分離されたhook。
 * useTreeViewControllerから抽出してモジュラー化。
 *
 * 【リファクタリング目的】:
 * - ファイルサイズ最適化（917行 → 800行以下）
 * - 関心の分離によるメンテナンス性向上
 * - CRUD操作の独立性確保
 */

import { useCallback } from 'react';
import type { NodeId, TreeNode } from '@hierarchidb/common-core';
import type { WorkerAPIAdapter } from '~/adapters';

export interface UseCRUDOperationsOptions {
  /** State manager (テスト用) */
  stateManager?: unknown;
  /** Worker API adapter */
  workerAdapter?: WorkerAPIAdapter;
  /** Loading state setter */
  setIsLoading?: (loading: boolean) => void;
  /** Callback to update selected nodes */
  onSelectedNodesChange?: (updater: (prev: NodeId[]) => NodeId[]) => void;
  /** Callback to update expanded nodes */
  onExpandedNodesChange?: (updater: (prev: NodeId[]) => NodeId[]) => void;
  /** Callback to update current node */
  onCurrentNodeChange?: (updater: (prev: TreeNode | null) => TreeNode | null) => void;
}

export interface UseCRUDOperationsReturn {
  // CRUD操作
  moveNode: (nodeId: NodeId, targetParentId: NodeId, index?: number) => Promise<void>;
  moveNodes: (nodeIds: NodeId[], targetParentId: NodeId) => Promise<void>;
  deleteNode: (nodeId: NodeId) => Promise<void>;
  deleteNodes: (nodeIds: NodeId[]) => Promise<void>;
  duplicateNode: (nodeId: NodeId) => Promise<void>;
  duplicateNodes: (nodeIds: NodeId[], targetParentId: NodeId) => Promise<void>;
  
  // Working Copy操作
  startEdit: (nodeId: NodeId) => Promise<void>;
  startCreate: (parentNodeId: NodeId, name: string) => Promise<void>;
}

/**
 * CRUD操作を管理するカスタムhook
 */
export function useCRUDOperations(
  options: UseCRUDOperationsOptions = {}
): UseCRUDOperationsReturn {
  const { 
    stateManager, 
    workerAdapter, 
    setIsLoading,
    onSelectedNodesChange,
    onExpandedNodesChange,
    onCurrentNodeChange
  } = options;

  // CRUD操作（WorkerAPIAdapter経由）
  const moveNode = useCallback(
    async (nodeId: NodeId, targetParentId: NodeId, _index?: number) => {
      if (workerAdapter) {
        setIsLoading?.(true);
        try {
          await workerAdapter.moveNodes([nodeId], targetParentId);
          // Ensure parent is expanded to show moved node
          onExpandedNodesChange?.((prev) => {
            if (!prev.includes(targetParentId)) {
              return [...prev, targetParentId];
            }
            return prev;
          });
        } finally {
          setIsLoading?.(false);
        }
      } else {
        throw new Error('No adapter available for move operation');
      }
    },
    [workerAdapter, stateManager, setIsLoading, onExpandedNodesChange]
  );

  const moveNodes = useCallback(
    async (nodeIds: NodeId[], targetParentId: NodeId) => {
      if (!workerAdapter) {
        throw new Error('WorkerAPIAdapter not available');
      }

      setIsLoading?.(true);
      try {
        await workerAdapter.moveNodes(nodeIds, targetParentId);
        // Ensure parent is expanded to show moved nodes
        onExpandedNodesChange?.((prev) => {
          if (!prev.includes(targetParentId)) {
            return [...prev, targetParentId];
          }
          return prev;
        });
      } finally {
        setIsLoading?.(false);
      }
    },
    [workerAdapter, setIsLoading, onExpandedNodesChange]
  );

  const deleteNode = useCallback(
    async (nodeId: NodeId) => {
      if (workerAdapter) {
        setIsLoading?.(true);
        try {
          await workerAdapter.deleteNodes([nodeId]);
          // Remove from selection
          onSelectedNodesChange?.((prev) => prev.filter((id) => id !== nodeId));
          // Remove from expanded nodes
          onExpandedNodesChange?.((prev) => prev.filter((id) => id !== nodeId));
          // Clear current node if it was deleted
          onCurrentNodeChange?.((prev) => prev?.id === nodeId ? null : prev);
        } finally {
          setIsLoading?.(false);
        }
      } else {
        throw new Error('No adapter available for delete operation');
      }
    },
    [workerAdapter, setIsLoading, onSelectedNodesChange, onExpandedNodesChange, onCurrentNodeChange]
  );

  const deleteNodes = useCallback(
    async (nodeIds: NodeId[]) => {
      if (!workerAdapter) {
        throw new Error('WorkerAPIAdapter not available');
      }

      setIsLoading?.(true);
      try {
        await workerAdapter.deleteNodes(nodeIds);
        // Remove from selection
        onSelectedNodesChange?.((prev) => prev.filter((id) => !nodeIds.includes(id)));
        // Remove from expanded nodes
        onExpandedNodesChange?.((prev) => prev.filter((id) => !nodeIds.includes(id)));
        // Clear current node if it was deleted
        onCurrentNodeChange?.((prev) => prev && nodeIds.includes(prev.id) ? null : prev);
      } finally {
        setIsLoading?.(false);
      }
    },
    [workerAdapter, setIsLoading, onSelectedNodesChange, onExpandedNodesChange, onCurrentNodeChange]
  );

  const duplicateNode = useCallback(
    async (nodeId: NodeId) => {
      if (!workerAdapter) {
        throw new Error('WorkerAPIAdapter not available');
      }

      setIsLoading?.(true);
      try {
        const result = await workerAdapter.duplicateNodes([nodeId], nodeId);
        // Note: Simplified logic since we don't have exact duplicated node info
        console.log('Node duplicated:', result);
      } finally {
        setIsLoading?.(false);
      }
    },
    [workerAdapter, setIsLoading]
  );

  const duplicateNodes = useCallback(
    async (nodeIds: NodeId[], targetParentId: NodeId) => {
      if (!workerAdapter) {
        throw new Error('WorkerAPIAdapter not available');
      }

      setIsLoading?.(true);
      try {
        await workerAdapter.duplicateNodes(nodeIds, targetParentId);
        // Expand parent to show duplicated nodes
        onExpandedNodesChange?.((prev) => {
          if (!prev.includes(targetParentId)) {
            return [...prev, targetParentId];
          }
          return prev;
        });
      } finally {
        setIsLoading?.(false);
      }
    },
    [workerAdapter, setIsLoading, onExpandedNodesChange]
  );

  // Working Copy操作
  const startEdit = useCallback(
    async (nodeId: NodeId) => {
      if (!workerAdapter) {
        throw new Error('WorkerAPIAdapter not available');
      }

      // TODO: 実装時に編集セッション管理ロジックを追加
      const editSession = await workerAdapter.startNodeEdit(nodeId);
      console.log('Edit session started:', editSession);
    },
    [workerAdapter]
  );

  const startCreate = useCallback(
    async (parentNodeId: NodeId, name: string) => {
      if (!workerAdapter) {
        throw new Error('WorkerAPIAdapter not available');
      }

      // TODO: 実装時に作成セッション管理ロジックを追加
      const createSession = await workerAdapter.startNodeCreate(parentNodeId, name, undefined);
      console.log('Create session started:', createSession);
    },
    [workerAdapter]
  );

  return {
    // CRUD操作
    moveNode,
    moveNodes,
    deleteNode,
    deleteNodes,
    duplicateNode,
    duplicateNodes,
    
    // Working Copy操作
    startEdit,
    startCreate,
  };
}