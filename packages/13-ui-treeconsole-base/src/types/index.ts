/**
 * TreeConsole 型定義
 *
 * 既存コードから抽出した型定義を新しいAPIに適応させたもの。
 */

import type { NodeId, TreeNode, TreeNodeType } from '@hierarchidb/00-core';
import type { WorkerAPI } from '@hierarchidb/01-api';
import type { ReactNode } from 'react';
import type { RowSelectionState } from '@tanstack/react-table';

// Re-export core types for convenience
export type { NodeId, TreeNode, TreeNodeType } from '@hierarchidb/00-core';

/**
 * 選択モード定義（既存コードから移植）
 */
export type SelectionMode = 'none' | 'checkbox' | 'radio' | 'row-click';

/**
 * TreeTableConsolePanel のメインProps
 */
export interface TreeTableConsolePanelProps {
  rootNodeId: NodeId;
  nodeId: NodeId;
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
  mode?: 'restore' | 'dispose';
  workerClient?: WorkerAPI; // Optional WorkerAPIClient for standalone usage
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
  currentNodeId?: NodeId;

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
  onNodeClick?: (nodeId: NodeId, node: TreeNodeWithChildren) => void;

  /** ノードアクション（右クリックメニュー等） */
  onNodeAction?: {
    onEdit?: (nodeId: NodeId) => void;
    onDelete?: (nodeId: NodeId) => void;
    onCreate?: (parentNodeId: NodeId) => void;
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
  rootNodeId: NodeId;
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
  rootNodeId: NodeId;
  currentNodeInfo?: NodeInfo | null;
  onDragStateChange?: (
    draggingNodeId: NodeId | undefined,
    descendantIdSet: Set<NodeId> | undefined
  ) => void;
  canPreviewNode?: boolean;
  mode?: 'restore' | 'dispose';
  
  // TreeTableCore specific props
  disableDragAndDrop?: boolean;
  hideDragHandler?: boolean;
  rowClickAction?: 'Select' | 'Edit' | 'Navigate';
  selectionMode?: 'none' | 'single' | 'multiple';
  NodeTypeIcon?: React.ComponentType<{ nodeType: string; size?: string }>;
  NodeContextMenu?: React.ComponentType<any>;
  onRowClick?: (node: TreeNode, event: React.MouseEvent) => void;
  onRowDoubleClick?: (node: TreeNode, event: React.MouseEvent) => void;
  onRowContextMenu?: (node: TreeNode, event: React.MouseEvent) => void;
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
  rootNodeId: NodeId;
  backActionButton?: ReactNode;
  controller?: TreeViewController | null;
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
 * Undo/Redo関連の型定義
 */
export interface UndoRedoCommand {
  id: string;
  type: string;
  timestamp: number;
  nodeId?: NodeId;
  parentId?: NodeId;
  data?: unknown;
}

export interface UndoRedoResult {
  success: boolean;
  error?: string;
  undoneCommand?: UndoRedoCommand;
  redoneCommand?: UndoRedoCommand;
  restoredNode?: TreeNode;
  restoredNodes?: TreeNode[];
}

/**
 * TreeViewController インターフェース（useTreeViewController の戻り値型）
 */
export interface TreeViewController {
  // 基本状態
  currentNode: TreeNode | null;
  selectedNodes: NodeId[];
  expandedNodes: NodeId[];
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
  data?: TreeNode[]; // テーブルデータ
  expandedRowIds?: Set<NodeId>; // 展開状態

  // 基本操作
  selectNode: (nodeId: NodeId) => void;
  selectMultipleNodes: (nodeIds: NodeId[]) => void;
  expandNode: (nodeId: NodeId) => void;
  collapseNode: (nodeId: NodeId) => void;

  // CRUD操作 - 新しいWorkerAPI経由で実装
  moveNodes: (nodeIds: NodeId[], targetParentId: NodeId) => Promise<void>;
  deleteNodes: (nodeIds: NodeId[]) => Promise<void>;
  duplicateNodes: (nodeIds: NodeId[], targetParentId: NodeId) => Promise<void>;

  // Working Copy操作
  startEdit: (nodeId: NodeId) => Promise<void>;
  startCreate: (parentNodeId: NodeId, name: string) => Promise<void>;

  // TreeTableCore specific methods
  onNodeExpand?: (nodeId: NodeId, expanded: boolean) => void;
  onNodeClick?: (nodeId: NodeId, node: TreeNode) => void;
  onNodeSelect?: (nodeIds: NodeId[], append: boolean) => void;
  finishEdit?: (nodeId: NodeId, newValue: string) => void;
  cancelEdit?: () => void;
  onCreate?: (parentNodeId: NodeId, nodeType: string) => void;
  onDuplicate?: (nodeId: NodeId) => void;
  onRemove?: (nodeIds: NodeId[]) => void;
  createNode?: (nodeType: string) => void;
  
  // 状態プロパティ
  rootNodeId?: NodeId;

  // Undo/Redo操作 - TDD Red Phase用の追加インターフェース
  undo: () => Promise<UndoRedoResult>;
  redo: () => Promise<UndoRedoResult>;
  canUndo: boolean;
  canRedo: boolean;
  undoHistory: UndoRedoCommand[];
  redoHistory: UndoRedoCommand[];
  clearHistory: () => Promise<{ success: boolean; error?: string }>;
}

// 後方互換性のための再エクスポート
export type { SpeedDialActionType as SpeedDialAction };

// TreeNodeData - UI用のノードデータ型
export interface TreeNodeData extends TreeNode {
  id: NodeId;
  nodeType: TreeNodeType;
  children?: TreeNodeData[];
  // UI specific properties
  depth?: number;
  hasChildren?: boolean;
  deletedAt?: string | number;
  type?: TreeNodeType; // backward compatibility
}

// 追加のUI状態型
export interface SelectionState {
  selectedIds: NodeId[];
  mode: SelectionMode;
}

export interface ExpansionState {
  expandedIds: NodeId[];
}

export interface SortState {
  field: string;
  direction: 'asc' | 'desc';
}

export interface FilterState {
  activeFilters: Record<string, unknown>;
}

export interface ViewState {
  viewMode: 'table' | 'grid' | 'list';
}

export interface TreeTableState {
  selection: SelectionState;
  expansion: ExpansionState;
  sort: SortState;
  filter: FilterState;
  view: ViewState;
}

export interface NavigationState {
  currentPath: NodeId[];
  history: NodeId[][];
}

export interface LoadingState {
  isLoading: boolean;
  loadingMessage?: string;
}

export interface ErrorState {
  hasError: boolean;
  errorMessage?: string;
}

// Adapter関連の型（一時的な定義）
export interface CommandAdapterOptions {
  timeout?: number;
  retries?: number;
  context?: AdapterContext;
}

export class TreeConsoleAdapterError extends Error {
  constructor(
    message: string,
    public code?: string,
    public context?: unknown
  ) {
    super(message);
    this.name = 'TreeConsoleAdapterError';
  }
}

export interface AdapterContext {
  userId?: string;
  sessionId?: string;
  groupId?: string;
  viewId?: string;
  onNameConflict?: (name: string) => string;
}

export type LegacyCallback<T = unknown> = (data: T) => void;
export type LegacyUnsubscribe = () => void;
export type LegacyExpandedStateChanges = unknown;
export type LegacySubTreeChanges = unknown;

// Observable/Subscription types
import type { TreeChangeEvent } from '@hierarchidb/00-core';
export type { TreeChangeEvent };
export type TreeChangeCallback = (event: TreeChangeEvent) => void;
export type UnsubscribeFunction = () => void;
export type ExpandedStateChange = unknown; // TODO: Define proper type
export type SubTreeChange = unknown; // TODO: Define proper type

// 基本Props型（後方互換性）
export interface TreeConsolePanelProps extends TreeTableConsolePanelProps {}
