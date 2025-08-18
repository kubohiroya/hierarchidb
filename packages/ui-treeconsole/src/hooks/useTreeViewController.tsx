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

import { useState, useCallback, useMemo, useEffect } from 'react';
import { WorkerAPIAdapter } from '~/adapters';
import type { TreeNodeId, TreeNode } from '@hierarchidb/core';
import type { TreeViewController, SelectionMode } from '~/types';
import type { RowSelectionState } from '@tanstack/react-table';


export interface UseTreeViewControllerOptions {
  /** ルートノードID */
  rootNodeId?: TreeNodeId;
  /** 初期展開ノードIDリスト */
  initialExpandedNodeIds?: TreeNodeId[];
  /** WorkerAPIアダプター（テスト用） */
  workerService?: WorkerAPIAdapter | null;
  /** WorkerAPIClient（直接提供する場合） */
  workerClient?: any;
}

export interface UseTreeViewControllerReturn extends TreeViewController {
  // TODO: 実装時に既存コードから完全なインターフェースを抽出
  
  // 基本状態
  currentNode: TreeNode | null;
  selectedNodes: TreeNodeId[];
  expandedNodes: TreeNodeId[];
  isLoading: boolean;
  
  // 基本操作
  selectNode: (nodeId: TreeNodeId) => void;
  selectMultipleNodes: (nodeIds: TreeNodeId[]) => void;
  expandNode: (nodeId: TreeNodeId) => void;
  collapseNode: (nodeId: TreeNodeId) => void;
  
  // CRUD操作
  moveNodes: (nodeIds: TreeNodeId[], targetParentId: TreeNodeId) => Promise<void>;
  deleteNodes: (nodeIds: TreeNodeId[]) => Promise<void>;
  duplicateNodes: (nodeIds: TreeNodeId[], targetParentId: TreeNodeId) => Promise<void>;
  
  // Working Copy操作
  startEdit: (nodeId: TreeNodeId) => Promise<void>;
  startCreate: (parentNodeId: TreeNodeId, name: string) => Promise<void>;
  
  // TODO: 検索、Import/Export、ショートカット等を段階的に追加
}

/**
 * TreeViewController hook
 * 
 * 現在は最小限の実装。実際の移植時に既存コードから段階的に機能を追加。
 */
export function useTreeViewController(
  options: UseTreeViewControllerOptions = {}
): UseTreeViewControllerReturn {
  const { rootNodeId: _rootNodeId, initialExpandedNodeIds = [] } = options;
  
  // WorkerAPI接続（オプショナル - 直接提供またはコンテキストから取得）
  const workerClient = options.workerClient || null;
  const api = workerClient?.getAPI?.() || null;
  
  // WorkerAPIAdapterのセットアップ
  const workerAdapter = useMemo(() => {
    if (options.workerService) {
      return options.workerService;
    }
    
    if (!api) {
      return null;
    }
    
    return new WorkerAPIAdapter({
      workerAPI: api,
      defaultViewId: 'treeconsole-view',
      defaultOnNameConflict: 'auto-rename'
    });
  }, [api, options.workerService]);

  // 基本状態管理
  const [currentNode, _setCurrentNode] = useState<TreeNode | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<TreeNodeId[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<TreeNodeId[]>(initialExpandedNodeIds);
  const [isLoading, setIsLoading] = useState(false);
  
  // 検索関連の状態
  const [searchText, setSearchText] = useState<string>('');
  const [filteredItemCount, _setFilteredItemCount] = useState<number>(0);
  const [totalItemCount, _setTotalItemCount] = useState<number>(0);
  
  // 選択関連の状態
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('none');
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  
  // テーブルデータ
  const [data, _setData] = useState<any[]>([]);

  // 基本操作の実装（プレースホルダー）
  const selectNode = useCallback((nodeId: TreeNodeId) => {
    setSelectedNodes([nodeId]);
    // TODO: 実装時に currentNode の設定ロジックを追加
  }, []);

  const selectMultipleNodes = useCallback((nodeIds: TreeNodeId[]) => {
    setSelectedNodes(nodeIds);
  }, []);

  const expandNode = useCallback((nodeId: TreeNodeId) => {
    setExpandedNodes(prev => [...prev, nodeId]);
  }, []);

  const collapseNode = useCallback((nodeId: TreeNodeId) => {
    setExpandedNodes(prev => prev.filter(id => id !== nodeId));
  }, []);

  // 検索関連の操作（IndexedDBの制約により未実装）
  const handleSearchTextChange = useCallback((newSearchText: string) => {
    setSearchText(newSearchText);
    // IndexedDBでは部分一致検索が困難（Nグラム化などの工数の多い対応が必要）
    // 現段階では完全一致・前方一致・後方一致のみ対応可能だが、要件に合わない
    throw new Error("Text search not implemented yet - IndexedDB limitations require N-gram indexing");
  }, []);

  // 選択モード変更
  const handleSetSelectionMode = useCallback((mode: SelectionMode) => {
    setSelectionMode(mode);
    // 選択モード変更時にrowSelectionをクリア
    if (mode === 'none') {
      setRowSelection({});
    }
  }, []);

  // CRUD操作（WorkerAPIAdapter経由）
  const moveNodes = useCallback(async (nodeIds: TreeNodeId[], targetParentId: TreeNodeId) => {
    if (!workerAdapter) {
      throw new Error('WorkerAPIAdapter not available');
    }
    
    setIsLoading(true);
    try {
      await workerAdapter.moveNodes(nodeIds, targetParentId);
      // TODO: 実装時に成功後の状態更新ロジックを追加
    } finally {
      setIsLoading(false);
    }
  }, [workerAdapter]);

  const deleteNodes = useCallback(async (nodeIds: TreeNodeId[]) => {
    if (!workerAdapter) {
      throw new Error('WorkerAPIAdapter not available');
    }
    
    setIsLoading(true);
    try {
      await workerAdapter.deleteNodes(nodeIds);
      // TODO: 実装時に成功後の状態更新ロジックを追加
    } finally {
      setIsLoading(false);
    }
  }, [workerAdapter]);

  const duplicateNodes = useCallback(async (nodeIds: TreeNodeId[], targetParentId: TreeNodeId) => {
    if (!workerAdapter) {
      throw new Error('WorkerAPIAdapter not available');
    }
    
    setIsLoading(true);
    try {
      await workerAdapter.duplicateNodes(nodeIds, targetParentId);
      // TODO: 実装時に成功後の状態更新ロジックを追加
    } finally {
      setIsLoading(false);
    }
  }, [workerAdapter]);

  // Working Copy操作
  const startEdit = useCallback(async (nodeId: TreeNodeId) => {
    if (!workerAdapter) {
      throw new Error('WorkerAPIAdapter not available');
    }
    
    // TODO: 実装時に編集セッション管理ロジックを追加
    const editSession = await workerAdapter.startNodeEdit(nodeId);
    console.log('Edit session started:', editSession);
  }, [workerAdapter]);

  const startCreate = useCallback(async (parentNodeId: TreeNodeId, name: string) => {
    if (!workerAdapter) {
      throw new Error('WorkerAPIAdapter not available');
    }
    
    // TODO: 実装時に作成セッション管理ロジックを追加
    const createSession = await workerAdapter.startNodeCreate(parentNodeId, name, undefined);
    console.log('Create session started:', createSession);
  }, [workerAdapter]);

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
    expandedNodes,
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

    // CRUD操作
    moveNodes,
    deleteNodes,
    duplicateNodes,

    // Working Copy操作
    startEdit,
    startCreate,
  };
}