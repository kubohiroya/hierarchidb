/**
 * useTreeViewController
 *
 * TreeConsoleの状態・操作を一括管理する中核となるhook。
 * 既存の巨大な実装を段階的に移植し、WorkerAPIAdapter経由で新APIに対応。
 *
 * 移植戦略：
 * 1. 基本構造と型定義から開始
 * 2. WorkerAPIAdapterの統合
 * 3. 既存ロジックを段階的に移植
 * 4. 各機能の動作確認
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { WorkerAPIAdapter } from '~/adapters';
import type { TreeViewController, SelectionMode, UndoRedoResult, UndoRedoCommand } from '../types/index';
import type { NodeId, TreeNode } from '@hierarchidb/00-core';
import type { RowSelectionState } from '@tanstack/react-table';
import { useCopyPasteOperations, type CopyResult, type CutResult, type PasteResult, type ClipboardData } from './useCopyPasteOperations';
import { useUndoRedoOperations } from './useUndoRedoOperations';
import { useCRUDOperations } from './useCRUDOperations';

export interface TreeViewControllerProps {
  /** Tree ID */
  treeId: string;
  /** State manager */
  stateManager?: unknown;
  /** State change callback */
  onStateChange?: (state: unknown) => void;
}

export interface UseTreeViewControllerOptions {
  /** ルートノードID */
  rootNodeId?: NodeId;
  /** 初期展開ノードIDリスト */
  initialExpandedNodeIds?: NodeId[];
  /** WorkerAPIアダプター（テスト用） */
  workerService?: WorkerAPIAdapter | null;
  /** WorkerAPIClient（直接提供する場合） */
  workerClient?: unknown;
}



export interface UseTreeViewControllerReturn extends TreeViewController {
  // TODO: 実装時に既存コードから完全なインターフェースを抽出

  // 基本状態
  currentNode: TreeNode | null;
  selectedNodes: NodeId[];
  selectedNodeIds: NodeId[]; // Alias for compatibility
  expandedNodes: NodeId[];
  expandedNodeIds: NodeId[]; // Alias for compatibility
  isLoading: boolean;

  // 検索関連
  searchText?: string;
  handleSearchTextChange?: (searchText: string) => void;
  filteredItemCount?: number;
  totalItemCount?: number;

  // 選択関連
  selectionMode: SelectionMode;
  rowSelection?: RowSelectionState;
  setSelectionMode?: (mode: SelectionMode) => void;

  // テーブル状態
  data?: TreeNode[];
  expandedRowIds?: Set<NodeId>; // 展開状態

  // 基本操作
  selectNode: (nodeId: NodeId) => void;
  selectMultipleNodes: (nodeIds: NodeId[]) => void;
  expandNode: (nodeId: NodeId) => void;
  collapseNode: (nodeId: NodeId) => void;

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

  // Copy/Paste操作 🟢
  copyNodes: (nodeIds: NodeId[]) => Promise<CopyResult>;
  cutNodes: (nodeIds: NodeId[]) => Promise<CutResult>;
  pasteNodes: (targetParentId: NodeId) => Promise<PasteResult>;
  
  // Copy/Paste状態 🟢
  clipboardData: ClipboardData | null;
  cutNodeIds: NodeId[];
  canPaste: boolean;
  canPasteToTarget: (targetId: NodeId) => boolean;

  // Undo/Redo操作 - TDD Red Phase用の追加インターフェース
  undo: () => Promise<UndoRedoResult>;
  redo: () => Promise<UndoRedoResult>;
  canUndo: boolean;
  canRedo: boolean;
  undoHistory: UndoRedoCommand[];
  redoHistory: UndoRedoCommand[];
  clearHistory: () => Promise<{ success: boolean; error?: string }>;

  // TODO: 検索、Import/Export、ショートカット等を段階的に追加
}

/**
 * TreeViewController hook
 *
 * 現在は最小限の実装。実際の移植時に既存コードから段階的に機能を追加。
 */
export function useTreeViewController(
  props: TreeViewControllerProps & UseTreeViewControllerOptions = { treeId: '' }
): UseTreeViewControllerReturn {
  const { 
    rootNodeId: _rootNodeId, 
    initialExpandedNodeIds = [],
    treeId: _treeId = '',
    stateManager,
    onStateChange,
    workerService,
    workerClient: providedWorkerClient
  } = props;

  // WorkerAPI接続（オプショナル - 直接提供またはコンテキストから取得）
  const workerClient = providedWorkerClient || null;
  const api = ((workerClient as any)?.getAPI ? (workerClient as any).getAPI() : null) || stateManager || {};

  // WorkerAPIAdapterのセットアップ
  const workerAdapter = useMemo(() => {
    if (workerService) {
      return workerService;
    }

    if (!api || !api.workerAPI) {
      return null;
    }

    return new WorkerAPIAdapter({
      workerAPI: api,
      defaultViewId: 'treeconsole-view',
      defaultOnNameConflict: (name: string) => `${name}-copy`,
    });
  }, [api, workerService]);

  // 基本状態管理
  const [currentNode, setCurrentNode] = useState<TreeNode | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<NodeId[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<NodeId[]>(initialExpandedNodeIds);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSelectedNode, setLastSelectedNode] = useState<NodeId | null>(null);

  // 検索関連の状態
  const [searchText, setSearchText] = useState<string>('');
  const [filteredItemCount, _setFilteredItemCount] = useState<number>(0);
  const [totalItemCount, _setTotalItemCount] = useState<number>(0);

  // 選択関連の状態
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('none');
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // テーブルデータ
  const [data, _setData] = useState<TreeNode[]>([]);

  // Track if this is the initial render
  const isInitialMount = useRef(true);
  
  // Effect to notify state changes
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    if (onStateChange) {
      onStateChange({
        selectedNodeIds: selectedNodes,
        expandedNodeIds: expandedNodes,
        currentNode,
      });
    }
  }, [selectedNodes, expandedNodes, currentNode, onStateChange]);

  // 【抽出されたhooks使用】: Copy/Paste操作を専用hookで管理 🟢
  const copyPasteOps = useCopyPasteOperations({
    stateManager,
    workerAdapter: workerAdapter || undefined,
    setIsLoading,
  });

  // 【抽出されたhooks使用】: Undo/Redo操作を専用hookで管理 🟢
  const undoRedoOps = useUndoRedoOperations({
    stateManager,
    setIsLoading,
    onStateChange,
    currentState: {
      selectedNodes,
      expandedNodes,
      currentNode,
    },
  });

  // 【抽出されたhooks使用】: CRUD操作を専用hookで管理 🟢
  const crudOps = useCRUDOperations({
    stateManager,
    workerAdapter: workerAdapter || undefined,
    setIsLoading,
    onSelectedNodesChange: setSelectedNodes,
    onExpandedNodesChange: setExpandedNodes,
    onCurrentNodeChange: setCurrentNode,
  });

  // 基本操作の実装
  const selectNode = useCallback(
    async (nodeId: NodeId, options?: { ctrlKey?: boolean; shiftKey?: boolean }) => {
      const { ctrlKey = false, shiftKey = false } = options || {};
      
      if (ctrlKey) {
        // Multi-select with Ctrl key
        setSelectedNodes((prev) => {
          if (prev.includes(nodeId)) {
            // Remove from selection
            return prev.filter((id) => id !== nodeId);
          } else {
            // Add to selection
            return [...prev, nodeId];
          }
        });
      } else if (shiftKey && lastSelectedNode) {
        // Range select with Shift key - simplified implementation for testing
        // Get all children from state manager (mocked in tests) 
        // TODO: Implement getChildren when API is available
        if ((stateManager as any)?.getChildren) {
          const children = await (stateManager as any).getChildren('root');
          if (children && Array.isArray(children)) {
            const nodeIds = children.map((child: unknown) => (child as TreeNode).id);
            const startIdx = nodeIds.indexOf(lastSelectedNode);
            const endIdx = nodeIds.indexOf(nodeId);
            if (startIdx !== -1 && endIdx !== -1) {
              const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
              setSelectedNodes(nodeIds.slice(from, to + 1));
            } else {
              setSelectedNodes([nodeId]);
            }
          } else {
            setSelectedNodes([nodeId]);
          }
        } else {
          setSelectedNodes([nodeId]);
        }
      } else {
        // Single select
        setSelectedNodes([nodeId]);
      }
      
      // Update last selected node for range selection
      setLastSelectedNode(nodeId);
      
      // Fetch and set current node
      // TODO: Implement getNode when API is available
      if ((stateManager as any)?.getNode && !ctrlKey && !shiftKey) {
        try {
          const node = await (stateManager as any).getNode(nodeId);
          if (node) {
            setCurrentNode(node as TreeNode);
          }
        } catch (error) {
          console.error('Failed to fetch node:', error);
        }
      } else if (api && !ctrlKey && !shiftKey) {
        try {
          const node = await (api as any).getNode?.(nodeId);
          if (node) {
            setCurrentNode(node as TreeNode);
          }
        } catch (error) {
          console.error('Failed to fetch node:', error);
        }
      }
    },
    [api, stateManager, lastSelectedNode]
  );

  const selectMultipleNodes = useCallback((nodeIds: NodeId[]) => {
    setSelectedNodes(nodeIds);
  }, []);

  const expandNode = useCallback((nodeId: NodeId) => {
    setExpandedNodes((prev) => {
      if (prev.includes(nodeId)) {
        return prev; // Already expanded
      }
      return [...prev, nodeId];
    });
  }, []);

  const collapseNode = useCallback((nodeId: NodeId) => {
    setExpandedNodes((prev) => prev.filter((id) => id !== nodeId));
  }, []);

  // 検索関連の操作（IndexedDBの制約により未実装）
  const handleSearchTextChange = useCallback((newSearchText: string) => {
    setSearchText(newSearchText);
    // IndexedDBでは部分一致検索が困難（Nグラム化などの工数の多い対応が必要）
    // 現段階では完全一致・前方一致・後方一致のみ対応可能だが、要件に合わない
    throw new Error(
      'Text search not implemented yet - IndexedDB limitations require N-gram indexing'
    );
  }, []);

  // 選択モード変更
  const handleSetSelectionMode = useCallback((mode: SelectionMode) => {
    setSelectionMode(mode);
    // 選択モード変更時にrowSelectionをクリア
    if (mode === 'none') {
      setRowSelection({});
    }
  }, []);

  // クリーンアップ
  useEffect(() => {
    return () => {
      workerAdapter?.cleanup();
    };
  }, [workerAdapter]);

  // TODO: 実装時に以下を段階的に追加
  // - サブスクリプション管理（部分木監視等）
  // - 検索機能
  // - Import/Export
  // - ショートカットキー処理
  // - エラーハンドリング
  // - 状態の永続化

  return {
    // 基本状態
    currentNode,
    selectedNodes,
    selectedNodeIds: selectedNodes, // Alias for compatibility
    expandedNodes,
    expandedNodeIds: expandedNodes, // Alias for compatibility
    isLoading,

    // 検索関連
    searchText,
    handleSearchTextChange,
    filteredItemCount,
    totalItemCount,

    // 選択関連
    selectionMode,
    rowSelection,
    setSelectionMode: handleSetSelectionMode,

    // テーブル状態
    data,

    // 基本操作
    selectNode,
    selectMultipleNodes,
    expandNode,
    collapseNode,

    // 【抽出されたhooks展開】: CRUD操作 🟢
    ...crudOps,

    // 【抽出されたhooks展開】: Copy/Paste操作 🟢
    ...copyPasteOps,

    // 【抽出されたhooks展開】: Undo/Redo操作 🟢
    ...undoRedoOps,
  };
}
