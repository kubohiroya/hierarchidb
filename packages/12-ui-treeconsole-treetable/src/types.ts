/**
 * Types for TreeTable package
 */

import type { ReactNode, MouseEvent } from 'react';
import type { RowSelectionState } from '@tanstack/react-table';
import type { TreeTablePlugin } from './plugin/types';

// Base TreeNode interface (simplified from core)
export interface TreeNode {
  id: string;
  parentNodeId?: string | null;
  parentId?: string | null;
  nodeType: string;
  type?: string;
  name: string;
  hasChildren?: boolean;
  depth?: number;
  isExpanded?: boolean;
  [key: string]: any;
}

// TreeTable controller interface
export interface TreeTableController {
  // Data
  data?: TreeNode[];
  searchText?: string;
  filteredItemCount?: number;
  totalItemCount?: number;

  // State
  rowSelection?: RowSelectionState;
  expandedRowIds?: Set<string>;

  // Actions
  handleSearchTextChange?: (value: string) => void;
  onNodeClick?: (nodeId: string, node?: TreeNode) => void;
  onNodeExpand?: (nodeId: string, expanded: boolean) => void;
  onNodeSelect?: (nodeIds: string[], selected: boolean) => void;

  // Editing
  startEdit?: (nodeId: string) => void;
  finishEdit?: (nodeId: string, newName: string) => void;
  cancelEdit?: () => void;

  // Context menu actions
  onCreate?: (parentId: string, type: string) => void;
  onDuplicate?: (nodeId: string) => void;
  onRemove?: (nodeIds: string[]) => void;
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
   * Table configuration
   */
  useTrashColumns?: boolean;
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
    draggingNodeId: string | undefined,
    descendantIdSet: Set<string> | undefined,
    dragPreviewElement: HTMLElement | null
  ) => void;

  /**
   * Selection
   */
  selectionMode?: 'single' | 'multiple' | 'none';

  /**
   * Custom containers
   */
  NodeTypeIcon?: React.ComponentType<{ nodeType: string; size?: string }>;
  NodeContextMenu?: React.ComponentType<any>;

  /**
   * Row click behavior
   */
  rowClickAction?: 'Select' | 'Edit' | 'Navigate';

  /**
   * Plugin System (Extension Points)
   */
  plugins?: TreeTablePlugin[];
  enableInlineEditing?: boolean;
  enableAdvancedKeyboardNav?: boolean;
  enableDragDropEnhancements?: boolean;
  enableSearchHighlight?: boolean;
  enableWorkingCopyIntegration?: boolean;

  /**
   * Callbacks
   */
  onRowClick?: (node: TreeNode, event: MouseEvent) => void;
  onRowDoubleClick?: (node: TreeNode, event: MouseEvent) => void;
  onRowContextMenu?: (node: TreeNode, event: MouseEvent) => void;
}

// Column configuration
export interface TreeTableColumn {
  id: string;
  header: string;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  accessor?: string;
  cell?: (node: TreeNode) => ReactNode;
  sortable?: boolean;
  resizable?: boolean;
}

// Orchestrator state interfaces
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
