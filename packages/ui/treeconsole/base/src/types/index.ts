/**
  * TreeConsole
  * API
  */

// Observable/Subscription types
import type { NodeId, NodeType, TreeChangeEvent, TreeNode } from '@hierarchidb/common-type';
import type { WorkerAPI } from '@hierarchidb/common-api';
import type { ReactNode } from 'react';
import type { RowSelectionState } from '@tanstack/react-table';

/**
    */
export type SelectionMode = 'none' | 'checkbox' | 'radio' | 'row-click';

/**
  * TreeTableConsolePanel Props
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
  * TreeConsole Props
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
  * TreeConsoleBreadcrumbProps -
  */
export interface TreeConsoleBreadcrumbProps {
  /**
   * -
   */
  nodePath: TreeNodeWithChildren[];

  /**
   * ID -
   */
  currentNodeId?: NodeId;

  /**
      */
  depthOffset?: number;

  /**
   * -
   */
  context?: {
    isTrashPage?: boolean;
    isProjectsPage?: boolean;
    isResourcesPage?: boolean;
    mode?: 'restore' | 'dispose' | 'normal';
  };

  /**
      */
  onNodeClick?: (nodeId: NodeId, node: TreeNodeWithChildren) => void;

  /**
      */
  onNodeAction?: {
    onEdit?: (nodeId: NodeId) => void;
    onDelete?: (nodeId: NodeId) => void;
    onCreate?: (parentId: NodeId) => void;
  };

  /**
      */
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
    descendantIdSet: Set<NodeId> | undefined,
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
  onClose: () => void;
  closeLink?: string;
  backLink: string;
  rootNodeId: NodeId;
  backActionButton?: ReactNode;
  controller?: TreeViewController | null;
}

/**
    */
export interface NodeInfo {
  id: string;
  name: string;
  type: NodeType;
  hasChildren?: boolean;
}

/**
  * TreeNodeWithChildren - UI
 * NOTE: core TreeNodeWithChildren children
  */
export interface TreeNodeWithChildren extends TreeNode {
  children?: TreeNodeWithChildren[];
}

/**
  * SpeedDial
  */
// Deprecated: SpeedDialActionType removed.

/**
  * Undo/Redo
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
  * TreeViewController useTreeViewController
  */
export interface TreeViewController {
  currentNode: TreeNode | null;
  selectedNodes: NodeId[];
  expandedNodes: NodeId[];
  isLoading: boolean;

  searchText?: string;
  handleSearchTextChange?: (searchText: string) => void;
  filteredItemCount?: number;
  totalItemCount?: number;

  selectionMode: SelectionMode;
  rowSelection?: RowSelectionState;
  setSelectionMode?: (mode: SelectionMode) => void;

  //  TanStack Table
  data?: TreeNode[];
  expandedRowIds?: Set<NodeId>;
  selectNode: (nodeId: NodeId) => void;
  selectMultipleNodes: (nodeIds: NodeId[]) => void;
  expandNode: (nodeId: NodeId) => void;
  collapseNode: (nodeId: NodeId) => void;

  //  CRUD - WorkerAPI
  moveNodes: (nodeIds: NodeId[], targetParentId: NodeId) => Promise<void>;
  deleteNodes: (nodeIds: NodeId[]) => Promise<void>;
  duplicateNodes: (nodeIds: NodeId[], targetParentId: NodeId) => Promise<void>;

  //  Working Copy
  startEdit: (nodeId: NodeId) => Promise<void>;
  startCreate: (parentId: NodeId, name: string) => Promise<void>;

  // TreeTableCore specific methods
  onNodeExpand?: (nodeId: NodeId, expanded: boolean) => void;
  onNodeClick?: (nodeId: NodeId, node: TreeNode) => void;
  onNodeSelect?: (nodeIds: NodeId[], append: boolean) => void;
  finishEdit?: (nodeId: NodeId, newValue: string, field?: 'name' | 'description') => void;
  cancelEdit?: () => void;
  onCreate?: (parentId: NodeId, nodeType: string) => void;
  onDuplicate?: (nodeId: NodeId) => void;
  onRemove?: (nodeIds: NodeId[]) => void;
  createNode?: (nodeType: string) => void;

  rootNodeId?: NodeId;

  //  Undo/Redo - TDD Red Phase
  undo: () => Promise<UndoRedoResult>;
  redo: () => Promise<UndoRedoResult>;
  canUndo: boolean;
  canRedo: boolean;
  undoHistory: UndoRedoCommand[];
  redoHistory: UndoRedoCommand[];
  clearHistory: () => Promise<{ success: boolean; error?: string }>;
}

// Deprecated: SpeedDialAction removed from base types.

//  TreeNodeData - UI
//  TreeNodeInUI
export interface TreeNodeData extends TreeNode {
  // TreeNode already has these properties:
  // id: NodeId;
  // nodeType: NodeType;
  // name: string;
  // depth: number;

  children?: TreeNodeData[];
  // UI specific properties  
  hasChildren?: boolean;
  deletedAt?: string | number;
  type?: string; // backward compatibility - UI uses string
}

//  UI
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

//  Adapter
export interface CommandAdapterOptions {
  timeout?: number;
  retries?: number;
  context?: AdapterContext;
}

export class TreeConsoleAdapterError extends Error {
  constructor(
    message: string,
    public code?: string,
    public context?: unknown,
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

export type { TreeChangeEvent };
export type TreeChangeCallback = (event: TreeChangeEvent) => void;
export type UnsubscribeFunction = () => void;
export type ExpandedStateChange = unknown; // TODO: Define proper type
export type SubTreeChange = unknown; // TODO: Define proper type

//  Props
export interface TreeConsolePanelProps extends TreeTableConsolePanelProps {
  /** Move nodes under a new parent (DnD) */
  onMoveNodes?: (nodeIds: NodeId[], targetParentId: NodeId) => void;
}
