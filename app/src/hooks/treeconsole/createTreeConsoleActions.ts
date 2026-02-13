/**
 * TreeConsole action factory.
 *
 * Produces the event handlers consumed by the TreeConsole UI using the
 * extracted dependencies from the integration hook.
 */

import type { NodeId } from '@hierarchidb/core-types';
import { createClipboardActions } from './actions/clipboard.ts';
import { createContextMenuAction } from './actions/contextMenu.ts';
import { createDialogHelpers } from './actions/dialog.ts';
import { createHistoryActions } from './actions/history.ts';
import { createImportExportActions } from './actions/importExport.ts';
import { createMutationActions } from './actions/mutations.ts';
import { createNavigationActions, createNavigationHelpers } from './actions/navigation.ts';
import { createSearchActions } from './actions/search.ts';
import { createSelectionActions } from './actions/selection.ts';
import type { TreeConsoleActionDeps, TreeConsoleActions } from './types.js';

export function createTreeConsoleActions(deps: TreeConsoleActionDeps): TreeConsoleActions {
  const { client, pageNodeId, selectedIds, setState, setSSOT, loadChildrenOf } = deps;

  if (!client) {
    throw new Error('[TreeConsole] Worker client is required to create actions');
  }

  const navigationHelpers = createNavigationHelpers(deps);
  const navigationActions = createNavigationActions(deps, navigationHelpers);
  const searchActions = createSearchActions(deps);
  const historyActions = createHistoryActions(deps);
  const dialogHelpers = createDialogHelpers(deps);
  const clipboardActions = createClipboardActions(deps);
  const mutationActions = createMutationActions(deps, navigationHelpers);
  const selectionActions = createSelectionActions(deps);
  const importExportActions = createImportExportActions(deps);
  const contextMenuActions = createContextMenuAction(deps, {
    applyClipboard: clipboardActions.applyClipboard,
    openEditDialog: dialogHelpers.openEditDialog,
    resolvePreviewGuardState: dialogHelpers.resolvePreviewGuardState,
    navigation: navigationHelpers,
  });

  return {
    handleNodeClick: navigationActions.handleNodeClick,
    handleNodeSelect: selectionActions.handleNodeSelect,
    handleNodeExpand: selectionActions.handleNodeExpand,
    handleSearchChange: searchActions.handleSearchChange,
    handleSearchClear: searchActions.handleSearchClear,
    handleSearchCommit: searchActions.handleSearchCommit,
    handleSearchModeChange: searchActions.handleSearchModeChange,
    handleCreate: mutationActions.handleCreate,
    handleEdit: async () => {
      if (selectedIds.length !== 1) return;
      await dialogHelpers.openEditDialog(selectedIds[0] as NodeId);
    },
    handleArchive: () => {
      void mutationActions.moveSelectionToArchive();
    },
    handleRemove: () => {
      void mutationActions.moveSelectionToArchive();
    },
    handleRefresh: async () => {
      const root = pageNodeId as NodeId;
      if (!client || !root) return;
      await loadChildrenOf(root);
    },
    handleExpandAll: selectionActions.handleExpandAll,
    handleCollapseAll: selectionActions.handleCollapseAll,
    handleSort: (columnId: string) => {
      setState((prev) => ({
        ...prev,
        sortBy: columnId,
        sortDirection: prev.sortBy === columnId && prev.sortDirection === 'asc' ? 'desc' : 'asc',
      }));
      // Sorting applied on derived view; index remains unchanged.
    },

    handleFilterChange: (filter: string) => {
      setState((prev) => ({ ...prev, filterBy: filter }));
      // Filtering applied on derived view; index remains unchanged.
    },

    handleViewModeChange: (mode) => {
      setSSOT({ viewMode: mode });
    },
    handleBreadcrumbNavigate: navigationActions.handleBreadcrumbNavigate,
    handleNavigateBack: navigationActions.handleNavigateBack,
    handleNavigateForward: navigationActions.handleNavigateForward,
    handleContextMenuAction: contextMenuActions.handleContextMenuAction,
    handleUndo: historyActions.handleUndo,
    handleRedo: historyActions.handleRedo,
    handleCopy: clipboardActions.handleCopy,
    handleCut: clipboardActions.handleCut,
    handlePaste: clipboardActions.handlePaste,
    handleDuplicate: mutationActions.handleDuplicate,
    handleImport: importExportActions.handleImport,
    handleExport: importExportActions.handleExport,
    handleMoveNodes: mutationActions.handleMoveNodes,
  };
}
