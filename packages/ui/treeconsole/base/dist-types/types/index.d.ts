/**
  * TreeConsole
  * API
  */
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
    trashAction?: 'restore' | 'empty';
    containerWidth?: number;
    containerHeight?: number;
    handleStartTour?: () => void;
    footerHeight?: number;
    mode?: 'restore' | 'dispose';
    workerClient?: WorkerAPI;
    hideDragHandler?: boolean;
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
    iconInteractive?: boolean;
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
    onDragStateChange?: (draggingNodeId: NodeId | undefined, descendantIdSet: Set<NodeId> | undefined) => void;
    canPreviewNode?: boolean;
    mode?: 'restore' | 'dispose';
    disableDragAndDrop?: boolean;
    hideDragHandler?: boolean;
    rowClickAction?: 'Select/Navigate' | 'Edit';
    selectionMode?: 'none' | 'single' | 'multiple';
    NodeTypeIcon?: React.ComponentType<{
        nodeType: string;
        size?: string;
    }>;
    NodeContextMenu?: React.ComponentType<any>;
    onRowClick?: (node: TreeNode, event: React.MouseEvent) => void;
    onRowDoubleClick?: (node: TreeNode, event: React.MouseEvent) => void;
    onRowContextMenu?: (node: TreeNode, event: React.MouseEvent) => void;
}
export interface TreeConsoleFooterProps {
    controller: TreeViewController | null;
    height?: number;
    onStartTour?: () => void;
    /** Optional: when controller is null, override the default 'Loading...' text */
    loadingText?: string;
    /** Optional: tooltip content for the loadingText (e.g., explain counters) */
    loadingTooltip?: React.ReactNode;
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
    data?: TreeNode[];
    expandedRowIds?: Set<NodeId>;
    selectNode: (nodeId: NodeId) => void;
    selectMultipleNodes: (nodeIds: NodeId[]) => void;
    expandNode: (nodeId: NodeId) => void;
    collapseNode: (nodeId: NodeId) => void;
    moveNodes: (nodeIds: NodeId[], targetParentId: NodeId) => Promise<void>;
    deleteNodes: (nodeIds: NodeId[]) => Promise<void>;
    duplicateNodes: (nodeIds: NodeId[], targetParentId: NodeId) => Promise<void>;
    startEdit: (nodeId: NodeId) => Promise<void>;
    startCreate: (parentId: NodeId, name: string) => Promise<void>;
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
    undo: () => Promise<UndoRedoResult>;
    redo: () => Promise<UndoRedoResult>;
    canUndo: boolean;
    canRedo: boolean;
    undoHistory: UndoRedoCommand[];
    redoHistory: UndoRedoCommand[];
    clearHistory: () => Promise<{
        success: boolean;
        error?: string;
    }>;
}
export interface TreeNodeData extends TreeNode {
    children?: TreeNodeData[];
    hasChildren?: boolean;
    deletedAt?: string | number;
    type?: string;
}
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
export interface CommandAdapterOptions {
    timeout?: number;
    retries?: number;
    context?: AdapterContext;
}
export declare class TreeConsoleAdapterError extends Error {
    code?: string | undefined;
    context?: unknown;
    constructor(message: string, code?: string | undefined, context?: unknown);
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
export type ExpandedStateChange = unknown;
export type SubTreeChange = unknown;
export interface TreeConsolePanelProps extends TreeTableConsolePanelProps {
    /** Move nodes under a new parent (DnD) */
    onMoveNodes?: (nodeIds: NodeId[], targetParentId: NodeId) => void;
}
//# sourceMappingURL=index.d.ts.map