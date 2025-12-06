/**
 * TreeConsole hook shared types.
 *
 * Exposes shared interfaces used to coordinate the decomposed
 * useTreeConsoleIntegration hook modules.
 */

import type { WorkerAPI } from '@hierarchidb/common-api';
import type { TreeConsoleSearchMode } from '@hierarchidb/ui-treeconsole-toolbar';
import type {
  CommandResult,
  NodeId,
  TreeId,
  TreeNode,
} from '@hierarchidb/common-types';
import type { TreeNodeData } from '@hierarchidb/ui-treeconsole-base';
import type { BreadcrumbNode } from '@hierarchidb/ui-plugin-shell/ui-treeconsole-breadcrumb';
import type { Remote } from 'comlink';
import type { Dispatch, SetStateAction } from 'react';
import type { TreeConsoleSSOTEntry } from '~/state/treeconsole.atoms.js';

export type ViewMode = 'list' | 'grid';

export type ContextAction =
  | 'open'
  | 'openFolder'
  | 'preview'
  | 'edit'
  | 'rename-inline'
  | 'update-desc-inline'
  | 'duplicate'
  | 'copy'
  | 'cut'
  | 'remove'
  | 'navigate'
  | 'import'
  | 'export'
  | 'trash'
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
  handleSearchModeChange: (mode: TreeConsoleSearchMode) => void;
  handleCreate: () => void;
  handleEdit: () => void;
  handleTrash: () => void;
  /** @deprecated Use handleTrash */
  handleRemove?: () => void;
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
    options?: {
      navigateToParent?: boolean;
      expandTarget?: boolean;
      source?: 'breadcrumb' | 'treetable' | 'speedDial';
    }
  ) => void;
  handleUndo: () => Promise<void>;
  handleRedo: () => Promise<void>;
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
    undo?: () => Promise<CommandResult | undefined>;
    redo?: () => Promise<CommandResult | undefined>;
  }>;
};

export interface TreeConsoleActionDeps {
  client: Remote<WorkerAPI>;
  treeId?: TreeId;
  pageNodeId?: NodeId;
  pageTreeNode?: TreeNode;
  pushPath?: (to: string | number) => void;
  searchTerm: string;
  searchMode: TreeConsoleSearchMode;
  selectedIds: NodeId[];
  expandedIds: NodeId[];
  locale?: string;
  setState: Dispatch<SetStateAction<TreeConsoleState>>;
  setSSOT: (patch: Partial<TreeConsoleSSOTEntry>) => void;
  ssot: TreeConsoleSSOTEntry;
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

export type { TreeConsoleSearchMode };
