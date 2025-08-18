/**
 * TreeConsole 型定義
 * 
 * 既存コードから抽出した型定義を新しいAPIに適応させたもの。
 */

import type { TreeNodeId, TreeNode, TreeNodeType } from '@hierarchidb/core';
import type { ReactNode } from 'react';
import type { RowSelectionState } from '@tanstack/react-table';

// 移植のため、既存の TreeRootNodeId を TreeNodeId にマッピング
export type TreeRootNodeId = TreeNodeId;

/**
 * 選択モード定義（既存コードから移植）
 */
export type SelectionMode = "none" | "checkbox" | "radio" | "row-click";

/**
 * TreeTableConsolePanel のメインProps
 */
export interface TreeTableConsolePanelProps {
  treeRootNodeId: TreeRootNodeId;
  nodeId: TreeNodeId;
  displayExpandedNode?: boolean;
  close?: () => void;
  initialRowSelection?: RowSelectionState;
  onRowSelectionChange?: (selection: RowSelectionState) => void;
  enableRowSelection?: boolean;
  hideConsole?: boolean;
  showSearchOnly?: boolean;
  useTrashColumns?: boolean;
  containerWidth?: number;
  containerHeight?: number;
  handleStartTour?: () => void;
  footerHeight?: number;
  mode?: "restore" | "dispose";
  workerClient?: any; // Optional WorkerAPIClient for standalone usage
}

/**
 * TreeConsole サブコンポーネントのProps型定義
 */
export interface TreeConsoleHeaderProps {
  title: string;
  baseTitle: string;
  baseTitleSingular: string;
  isShowingBranch: boolean;
  isRootNode: boolean;
  currentNodeInfo: NodeInfo | null;
  controller: TreeViewController | null;
  previousNodePath: TreeNodeWithChildren[];
  isTrashPage: boolean;
  isProjectsPage: boolean;
  isResourcesPage: boolean;
  currentNodeId?: string;
  onClose?: () => void;
  canPreviewNode?: boolean;
  depthOffset?: number;
}

/**
 * 新設計のTreeConsoleBreadcrumbProps - 軽量で依存関係を最小化
 */
export interface TreeConsoleBreadcrumbProps {
  /** ノードパス配列 - 表示するパンくずの階層データ */
  nodePath: TreeNodeWithChildren[];
  
  /** 現在のノードID - ハイライト用 */
  currentNodeId?: TreeNodeId;
  
  /** 階層の深度オフセット（表示調整用） */
  depthOffset?: number;
  
  /** コンテキスト情報 - 表示スタイル調整 */
  context?: {
    isTrashPage?: boolean;
    isProjectsPage?: boolean;
    isResourcesPage?: boolean;
    mode?: 'restore' | 'dispose' | 'normal';
  };
  
  /** ノードクリック時のハンドラー */
  onNodeClick?: (nodeId: TreeNodeId, node: TreeNodeWithChildren) => void;
  
  /** ノードアクション（右クリックメニュー等） */
  onNodeAction?: {
    onEdit?: (nodeId: TreeNodeId) => void;
    onDelete?: (nodeId: TreeNodeId) => void;  
    onCreate?: (parentNodeId: TreeNodeId) => void;
  };
  
  /** 表示設定 */
  variant?: 'default' | 'compact' | 'minimal';
  maxWidth?: number;
  showIcons?: boolean;
}

export interface TreeConsoleToolbarProps {
  hideConsole: boolean;
  showSearchOnly: boolean;
  isProjectsPage: boolean;
  isResourcesPage: boolean;
  treeRootNodeId: TreeRootNodeId;
  controller: TreeViewController | null;
  hasTrashItems?: boolean;
  hasChildren?: boolean;
}

export interface TreeConsoleContentProps {
  controller: TreeViewController | null;
  isProjectsPage: boolean;
  isResourcesPage: boolean;
  viewHeight: number;
  viewWidth: number;
  useTrashColumns: boolean;
  depthOffset: number;
  treeRootNodeId: TreeRootNodeId;
  currentNodeInfo?: NodeInfo | null;
  onDragStateChange?: (
    draggingNodeId: TreeNodeId | undefined,
    descendantIdSet: Set<TreeNodeId> | undefined,
  ) => void;
  canPreviewNode?: boolean;
  mode?: "restore" | "dispose";
}

export interface TreeConsoleFooterProps {
  controller: TreeViewController | null;
  height?: number;
  onStartTour?: () => void;
}

export interface TreeConsoleActionsProps {
  isProjectsPage: boolean;
  isResourcesPage: boolean;
  isTrashPage: boolean;
  speedDialActions: SpeedDialActionType[];
  speedDialIcon?: ReactNode;
  onClose: () => void;
  closeLink?: string;
  backLink: string;
  treeRootNodeId: TreeRootNodeId;
  backActionButton?: ReactNode;
}

/**
 * ノード情報表示用の型
 */
export interface NodeInfo {
  id: string;
  name: string;
  type: TreeNodeType;
  hasChildren?: boolean;
}

/**
 * TreeNodeWithChildren - 既存の TreeNodeEntityWithChildren に相当
 */
export interface TreeNodeWithChildren extends TreeNode {
  children?: TreeNodeWithChildren[];
}

/**
 * SpeedDial アクション型（既存コードから移植）
 */
export interface SpeedDialActionType {
  name: string;
  icon: ReactNode;
  color?: string;
  onClick: () => void;
}

/**
 * TreeViewController インターフェース（useTreeViewController の戻り値型）
 */
export interface TreeViewController {
  // 基本状態
  currentNode: TreeNode | null;
  selectedNodes: TreeNodeId[];
  expandedNodes: TreeNodeId[];
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
  
  // テーブル状態（TanStack Table関連）
  data?: any[]; // テーブルデータ
  
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
}

// 後方互換性のための再エクスポート
export type { SpeedDialActionType as SpeedDialAction };

// 基本Props型（後方互換性）
export interface TreeConsolePanelProps extends TreeTableConsolePanelProps {}