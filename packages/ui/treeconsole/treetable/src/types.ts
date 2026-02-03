/**
 * Types for TreeTable package
 */

import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import type { NodeContextMenuProps, OpenStepOption } from '@hierarchidb/ui-treeconsole-breadcrumb';
import type { DualKeyMap } from '@hierarchidb/util';
import type { RowSelectionState } from '@tanstack/react-table';
import type { MouseEvent, ReactNode } from 'react';
import type { TreeTablePlugin } from './plugin/types.js';

// Base TreeNode interface (extracted from core)
export interface TreeNodeInUI extends TreeNode {
  hasChildren?: boolean;
  children?: NodeId[];
  isExpanded?: boolean;
  depth: number;
  absoluteDepth?: number;
}

// TreeTable controller interface
export interface TreeTableController {
  // Data
  data?: TreeNodeInUI[];
  nodeIndex: DualKeyMap<NodeId, NodeId, TreeNode>;
  searchText?: string;
  filteredItemCount?: number;
  totalItemCount?: number;

  // State
  rowSelection?: RowSelectionState;
  expandedRowIds?: Set<string>;
  rootNodeId?: NodeId;
  depthOffset?: number;

  // Actions
  handleSearchTextChange?: (value: string) => void;
  onNodeClick?: (nodeId: string, node?: TreeNodeInUI) => void;
  /**
   * Navigate to Edit dialog/page for the node.
   * If omitted, callers should fallback to onNodeClick.
   */
  onEdit?: (nodeId: string, node?: TreeNodeInUI) => void;
  onNodeExpand?: (nodeId: string, expanded: boolean) => void;
  onNodeSelect?: (nodeIds: string[], selected: boolean) => void;

  // Editing
  startEdit?: (nodeId: string) => void;
  finishEdit?: (nodeId: string, newValue: string, field?: 'name' | 'description') => void;
  cancelEdit?: () => void;

  // Context menu actions
  onCreate?: (parentId: string, type: string) => void;
  onDuplicate?: (nodeId: string) => void;
  onTrash?: (nodeIds: string[]) => void;
  /** @deprecated Use onTrash */
  onRemove?: (nodeIds: string[]) => void;
  // Move nodes to a new parent
  onMoveNodes?: (nodeIds: string[], targetParentId: string) => void;
  onContextAction?: (
    action: string,
    node: TreeNodeInUI,
    options?: { navigateToParent?: boolean; nextVisible?: boolean }
  ) => void;
  resolvePreviewGuardState?: (
    node: TreeNodeInUI
  ) => Promise<{ canOpen: boolean; finalStepIndex?: number }>;
  resolveOpenSteps?: (node: TreeNodeInUI) => Promise<OpenStepOption[]>;
}

// TreeTable core props
export interface TreeTableCoreProps {
  /**
   * Controller providing data and actions
   */
  controller: TreeTableController | null;

  /**
   * View dimensions
   */
  viewHeight: number;
  viewWidth: number;
  /**
   * Page context: unique identifier for the current view root.
   * Used as primary key when persisting UI atoms in Dexie.
   */
  pageNodeId?: string;

  /**
   * Current console context (used for path building and context menus)
   */
  treeId?: string;

  /**
   * Table configuration
   */
  useTrashColumns?: boolean;
  trashAction?: 'restore' | 'empty';
  depthOffset?: number;

  /**
   * Feature toggles
   */
  disableDragAndDrop?: boolean;
  hideDragHandler?: boolean;
  enableVirtualization?: boolean;

  /**
   * Drag and drop
   */
  onDragStateChange?: (
    draggingNodeId: NodeId | undefined,
    descendantIdSet: Set<NodeId> | undefined,
    dragPreviewElement: HTMLElement | null
  ) => void;

  /**
   * Selection
   */
  selectionMode?: 'single' | 'multiple' | 'none';
  /**
   * select-all atoms persistence strategy. Defaults to 'page'.
   */
  selectAllPersistence?: 'page' | 'session';
  /**
   * Optional prefix for selection checkbox ids (header/rows) to avoid DOM id collisions.
   */
  selectionIdPrefix?: string;

  /**
   * Custom containers
   */
  NodeTypeIcon?: React.ComponentType<{ nodeType: string; size?: string }>;
  NodeContextMenu?: React.ComponentType<NodeContextMenuProps>;

  /**
   * Row click behavior
   */
  rowClickAction?: 'Select/Navigate' | 'Edit';

  /**
   * Plugin System (Extension Points)
   */
  plugins?: TreeTablePlugin[];
  enableInlineEditing?: boolean;
  enableAdvancedKeyboardNav?: boolean;
  enableDragDropEnhancements?: boolean;
  enableSearchHighlight?: boolean;
  enableDraftIntegration?: boolean;

  // No persistenceKey string: Dexie uses pageNodeId as the primary key.

  /**
   * Callbacks
   */
  onRowClick?: (node: TreeNodeInUI, event: MouseEvent) => void;
  onRowDoubleClick?: (node: TreeNodeInUI, event: MouseEvent) => void;
  onRowContextMenu?: (node: TreeNodeInUI, event: MouseEvent) => void;
}

// Column configuration
export interface TreeTableColumn {
  id: string;
  header: string;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  accessor?: string;
  cell?: (node: TreeNodeInUI) => ReactNode;
  sortable?: boolean;
  resizable?: boolean;
}

// Orchestrator atoms interfaces
export interface SelectionState {
  selectedRowIds: Set<string>;
  lastSelectedId: string | null;
  selectMode: 'single' | 'multiple';
}

export interface ExpansionState {
  expandedRowIds: Set<string>;
  autoExpandDepth: number;
}

export interface EditingState {
  editingNodeId: string | null;
  editingValue: string;
}

export interface DragDropState {
  draggingNodeId: string | null;
  dropTargetId: string | null;
  dropPosition: 'before' | 'after' | 'into' | null;
  isDragOver: boolean;
}

export interface SearchState {
  searchText: string;
  searchResults: Set<string>;
  highlightedIndex: number;
}

// Orchestrator result interfaces
export interface TreeTableOrchestratorResult {
  // Selection
  selection: {
    selectedRowIds: Set<string>;
    isSelected: (id: string) => boolean;
    toggleSelection: (id: string, isMulti?: boolean) => void;
    clearSelection: () => void;
  };

  // Expansion
  expansion: {
    expandedRowIds: Set<string>;
    isExpanded: (id: string) => boolean;
    toggleExpansion: (id: string) => void;
    expandAll: () => void;
    collapseAll: () => void;
  };

  // Editing
  editing: {
    editingNodeId: string | null;
    startEdit: (id: string) => void;
    finishEdit: (newValue: string) => void;
    cancelEdit: () => void;
  };

  // Search
  search: {
    searchText: string;
    setSearchText: (text: string) => void;
    searchResults: Set<string>;
    clearSearch: () => void;
  };

  // Drag & Drop
  dragDrop: {
    draggingNodeId: string | null;
    dropTargetId: string | null;
    dropPosition: 'before' | 'after' | 'into' | null;
    handleDragStart: (id: string) => void;
    handleDragEnd: () => void;
    handleDrop: (targetId: string, position: 'before' | 'after' | 'into') => void;
  };
}
