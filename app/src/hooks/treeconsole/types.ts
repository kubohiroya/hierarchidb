/**
 * TreeConsole hook shared types.
 *
 * Exposes shared interfaces used to coordinate the decomposed
 * useTreeConsoleIntegration hook modules.
 */

import type { Dispatch, SetStateAction } from 'react';
import type { NodeId, TreeId, TreeNode } from '@hierarchidb/feature-core/common-types';
import type { Remote } from 'comlink';
import type { WorkerAPI } from '@hierarchidb/feature-core/common-api';
import type { TreeNodeData } from '@hierarchidb/ui-shell/ui-treeconsole-base';
import type { BreadcrumbNode } from '@hierarchidb/ui-shell/ui-treeconsole-breadcrumb';
import type { TreeConsoleSSOTEntry } from '~/state/treeconsole.atoms.js';

export type ViewMode = 'list' | 'grid';

export type ContextAction =
  | 'open'
  | 'openFolder'
  | 'preview'
  | 'edit'
  | 'rename-dialog'
  | 'rename-inline'
  | 'update-desc-inline'
  | 'duplicate'
  | 'remove'
  | 'checkReference'
  | `create:${string}`;

export interface UseTreeConsoleIntegrationParams {
  client: Remote<WorkerAPI>;
  treeId?: string;
  pageNodeId?: NodeId;
  pageTreeNode?: TreeNode;
  pushPath?: (to: string | number) => void;
  locationSearch?: string;
}

export interface TreeConsoleState {
  loading: boolean;
  error: string | null;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  filterBy?: string;
  availableFilters: string[];
  canGoBack: boolean;
  canGoForward: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canPaste: boolean;
}

export interface TreeConsoleActions {
  handleNodeClick: (node: TreeNodeData) => void;
  handleNodeSelect: (nodeIds: string[], selected: boolean) => void;
  handleNodeExpand: (nodeId: string, expanded: boolean) => void;
  handleSearchChange: (term: string) => void;
  handleSearchClear: () => void;
  handleSearchCommit: () => void;
  handleCreate: () => void;
  handleEdit: () => void;
  handleDelete: () => void;
  handleRefresh: () => void;
  handleExpandAll: () => void;
  handleCollapseAll: () => void;
  handleSort: (columnId: string) => void;
  handleFilterChange: (filter: string) => void;
  handleViewModeChange: (mode: ViewMode) => void;
  handleBreadcrumbNavigate: (nodeId: string, node?: BreadcrumbNode) => void;
  handleNavigateBack: () => void;
  handleNavigateForward: () => void;
  handleContextMenuAction: (
    action: string,
    node: TreeNodeData,
    options?: { navigateToParent?: boolean; expandTarget?: boolean; source?: 'breadcrumb' | 'treetable' | 'speedDial' },
  ) => void;
  handleUndo: () => void;
  handleRedo: () => void;
  handleCopy: () => void;
  handleCut: () => void;
  handlePaste: () => void;
  handleDuplicate: () => void;
  handleImport: () => void;
  handleExport: () => void;
  handleMoveNodes: (nodeIds: string[], targetParentId: string) => Promise<void>;
}

export type MaybeCP = {
  getCommandProcessor?: () => Promise<{
    canUndo?: () => boolean;
    canRedo?: () => boolean;
    undo?: () => Promise<void>;
    redo?: () => Promise<void>;
  }>;
};

export interface TreeConsoleActionDeps {
  client: Remote<WorkerAPI>;
  treeId?: TreeId;
  pageNodeId?: NodeId;
  pageTreeNode?: TreeNode;
  pushPath?: (to: string | number) => void;
  searchTerm: string;
  selectedIds: NodeId[];
  expandedIds: NodeId[];
  treeData: TreeNodeData[];
  setState: Dispatch<SetStateAction<TreeConsoleState>>;
  setSSOT: (patch: Partial<TreeConsoleSSOTEntry>) => void;
  ssot: TreeConsoleSSOTEntry;
  applySortFilterSearch: (nodes: TreeNodeData[], overrideTerm?: string) => TreeNodeData[];
  loadChildrenOf: (parentId: NodeId, optTerm?: string) => Promise<void>;
  refreshUndoRedo: () => Promise<void> | void;
  importExport: ImportExportAdapter;
  teardownSubscription: (rootId?: NodeId) => Promise<void>;
  setupSubscription: (rootId: NodeId) => Promise<void>;
}

export interface ImportExportAdapter {
  detectFileFormat: (file: File) => string | null | undefined;
  importFile: (input: {
    file: File;
    targetNodeId: NodeId;
    format: 'json' | 'csv';
    onProgress?: (progress: unknown) => void;
  }) => Promise<unknown>;
  exportNodes: (input: {
    nodeIds: NodeId[];
    format: 'json' | 'csv';
    includeChildren?: boolean;
    onProgress?: (progress: unknown) => void;
  }) => Promise<Blob>;
}
