import type {
  BuildContinuationPolicy,
} from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import type { HierarchicalTreeNode } from '@hierarchidb/ui-treeconsole-base';
import type {
  TreeConsoleToolbar,
  TreeConsoleToolbarActionParams,
} from '@hierarchidb/ui-treeconsole-toolbar';
import {
  loadTreeConsoleSettings,
  saveTreeConsoleSettings,
  TREE_CONSOLE_DEFAULT_ZOOM_BAND_BOUNDARIES,
  TREE_CONSOLE_SETTINGS_STORAGE_KEY,
} from '@hierarchidb/util';
import { useCallback, useEffect, useState } from 'react';
import { canImportFromNode, logIntegrationWarning } from '../treeConsoleIntegrationUtils.js';

type IntegrationActions = {
  handleUndo?: () => void;
  handleRedo?: () => void;
  handleCut?: () => void;
  handleCopy?: () => void;
  handlePaste?: () => void;
  handleDuplicate?: () => void;
  handleArchive?: () => void;
  handleImport?: () => void;
  handleExport?: () => void;
  handleRefresh?: () => void;
  handleSearchChange?: (value: string) => void;
  handleSearchCommit?: () => void;
};

type IntegrationState = {
  canUndo: boolean;
  canRedo: boolean;
  canPaste?: boolean;
  canArchive: boolean;
};

const isTreeNodeLike = (value: unknown): value is HierarchicalTreeNode | TreeNode =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  typeof (value as { id?: unknown }).id === 'string' &&
  typeof (value as { nodeType?: unknown }).nodeType === 'string';

const hasNodeIdParam = (value: unknown): value is { nodeId: NodeId } =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  typeof (value as { nodeId?: unknown }).nodeId === 'string';

export type ToolbarControllerResult = {
  toolbarProps: React.ComponentProps<typeof TreeConsoleToolbar>;
  rowClickAction: 'Select/Navigate' | 'Edit';
  setRowClickAction: React.Dispatch<React.SetStateAction<'Select/Navigate' | 'Edit'>>;
  autosaveEnabled: boolean;
  setAutosaveEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  dialogBackdropDismissEnabled: boolean;
  setDialogBackdropDismissEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  zoomBandBoundaries: number[];
  setZoomBandBoundaries: React.Dispatch<React.SetStateAction<number[]>>;
  buildContinuationPolicy: BuildContinuationPolicy;
  setBuildContinuationPolicy: React.Dispatch<React.SetStateAction<BuildContinuationPolicy>>;
};

export function useTreeConsoleToolbarActions({
  treeId,
  pageNodeId,
  pageTreeNode,
  hasArchiveItems,
  archiveRootIdRef,
  navigate,
  actions,
  state,
  developerModeEnabled,
  handleIndexedDbReset,
  requestEdit,
  searchTerm,
  selectedCount,
  viewMode,
  onViewModeChange,
  sortMode,
  onSortModeChange,
}: {
  treeId?: string;
  pageNodeId?: NodeId;
  pageTreeNode?: TreeNode;
  hasArchiveItems: boolean;
  archiveRootIdRef: React.RefObject<NodeId | null>;
  navigate: (args: { to: string; replace?: boolean }) => void;
  actions: IntegrationActions;
  state: IntegrationState;
  developerModeEnabled: boolean;
  handleIndexedDbReset: () => void;
  requestEdit: (targetNodeId?: NodeId, nodeHint?: HierarchicalTreeNode | TreeNode) => Promise<void>;
  searchTerm: string;
  selectedCount: number;
  viewMode?: import('@hierarchidb/ui-treeconsole-base').ViewMode;
  onViewModeChange?: (mode: import('@hierarchidb/ui-treeconsole-base').ViewMode) => void;
  sortMode?: import('@hierarchidb/ui-treeconsole-base').SortMode;
  onSortModeChange?: (mode: import('@hierarchidb/ui-treeconsole-base').SortMode) => void;
}): ToolbarControllerResult {
  const [rowClickAction, setRowClickAction] = useState<'Select/Navigate' | 'Edit'>(() => {
    const stored = loadTreeConsoleSettings().rowClickAction;
    return stored === 'Edit' ? 'Edit' : 'Select/Navigate';
  });
  const [autosaveEnabled, setAutosaveEnabled] = useState<boolean>(() => {
    const stored = loadTreeConsoleSettings().autosaveEnabled;
    return typeof stored === 'boolean' ? stored : false;
  });
  const [dialogBackdropDismissEnabled, setDialogBackdropDismissEnabled] = useState<boolean>(() => {
    const stored = loadTreeConsoleSettings().dialogBackdropDismissEnabled;
    return typeof stored === 'boolean' ? stored : false;
  });
  const [zoomBandBoundaries, setZoomBandBoundaries] = useState<number[]>(() => {
    const stored = loadTreeConsoleSettings().zoomBandBoundaries;
    return Array.isArray(stored) ? stored : TREE_CONSOLE_DEFAULT_ZOOM_BAND_BOUNDARIES;
  });
  const [buildContinuationPolicy, setBuildContinuationPolicy] = useState<BuildContinuationPolicy>(
    () => {
      const stored = loadTreeConsoleSettings().buildContinuationPolicy;
      return stored ?? 'finish_all_stages';
    }
  );
  useEffect(() => {
    const global = typeof window !== 'undefined' ? window : null;
    if (!global) return undefined;
    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== TREE_CONSOLE_SETTINGS_STORAGE_KEY) return;
      const next = loadTreeConsoleSettings();
      setRowClickAction(next.rowClickAction === 'Edit' ? 'Edit' : 'Select/Navigate');
      setAutosaveEnabled(typeof next.autosaveEnabled === 'boolean' ? next.autosaveEnabled : false);
      setDialogBackdropDismissEnabled(
        typeof next.dialogBackdropDismissEnabled === 'boolean'
          ? next.dialogBackdropDismissEnabled
          : false
      );
      setZoomBandBoundaries(
        Array.isArray(next.zoomBandBoundaries)
          ? next.zoomBandBoundaries
          : TREE_CONSOLE_DEFAULT_ZOOM_BAND_BOUNDARIES
      );
      setBuildContinuationPolicy(next.buildContinuationPolicy ?? 'finish_all_stages');
    };
    global.addEventListener('storage', handleStorage);
    return () => {
      global.removeEventListener('storage', handleStorage);
    };
  }, []);

  const persistSettings = useCallback(
    (
      patch: Partial<{
        rowClickAction: 'Select/Navigate' | 'Edit';
        autosaveEnabled: boolean;
        dialogBackdropDismissEnabled: boolean;
        zoomBandBoundaries: number[];
        buildContinuationPolicy: BuildContinuationPolicy;
      }>
    ) => {
      saveTreeConsoleSettings({
        rowClickAction: patch.rowClickAction ?? rowClickAction,
        autosaveEnabled: patch.autosaveEnabled ?? autosaveEnabled,
        dialogBackdropDismissEnabled:
          patch.dialogBackdropDismissEnabled ?? dialogBackdropDismissEnabled,
        zoomBandBoundaries: patch.zoomBandBoundaries ?? zoomBandBoundaries,
        buildContinuationPolicy: patch.buildContinuationPolicy ?? buildContinuationPolicy,
      });
    },
    [
      autosaveEnabled,
      buildContinuationPolicy,
      dialogBackdropDismissEnabled,
      rowClickAction,
      zoomBandBoundaries,
    ]
  );

  const handleToolbarAction = useCallback(
    (action: string, params?: TreeConsoleToolbarActionParams) => {
      const currentPageNodeId = pageNodeId || 'root';

      const normalizedAction = action === 'remove' ? 'archive' : action;

      switch (normalizedAction) {
        case 'setRowClickAction':
          if (typeof params === 'string') {
            setRowClickAction(params === 'Edit' ? 'Edit' : 'Select/Navigate');
            persistSettings({ rowClickAction: params === 'Edit' ? 'Edit' : 'Select/Navigate' });
          }
          break;
        case 'setAutosaveEnabled':
          if (typeof params === 'boolean') {
            setAutosaveEnabled(params);
            persistSettings({ autosaveEnabled: params });
          }
          break;
        case 'setDialogBackdropDismissEnabled':
          if (typeof params === 'boolean') {
            setDialogBackdropDismissEnabled(params);
            persistSettings({ dialogBackdropDismissEnabled: params });
          }
          break;
        case 'setZoomBandBoundaries':
          if (Array.isArray(params)) {
            setZoomBandBoundaries(params);
            persistSettings({ zoomBandBoundaries: params });
          }
          break;
        case 'restore': {
          if (!treeId) break;
          const resolvedArchiveNodeId =
            params && typeof params === 'object' && 'archiveNodeId' in params && params.archiveNodeId
              ? params.archiveNodeId
              : (archiveRootIdRef.current ?? (treeId ? `${treeId}:archive` : 'archive'));
          navigate({
            to: `/t/${treeId}/${currentPageNodeId}/${resolvedArchiveNodeId}/archive/restore`,
          });
          break;
        }
        case 'empty': {
          if (!treeId) break;
          const resolvedArchiveNodeId =
            params && typeof params === 'object' && 'archiveNodeId' in params && params.archiveNodeId
              ? params.archiveNodeId
              : (archiveRootIdRef.current ?? (treeId ? `${treeId}:archive` : 'archive'));
          navigate({
            to: `/t/${treeId}/${currentPageNodeId}/${resolvedArchiveNodeId}/archive/empty`,
          });
          break;
        }
        case 'edit': {
          const targetId = hasNodeIdParam(params) ? params.nodeId : currentPageNodeId;
          const hint = isTreeNodeLike(params) ? params : undefined;
          void requestEdit(targetId as NodeId, hint);
          break;
        }
        case 'undo':
          actions.handleUndo?.();
          break;
        case 'redo':
          actions.handleRedo?.();
          break;
        case 'cut':
          actions.handleCut?.();
          break;
        case 'copy':
          actions.handleCopy?.();
          break;
        case 'paste':
          actions.handlePaste?.();
          break;
        case 'duplicate':
          actions.handleDuplicate?.();
          break;
        case 'archive':
          actions.handleArchive?.();
          break;
        case 'import':
          actions.handleImport?.();
          break;
        case 'export':
          actions.handleExport?.();
          break;
        case 'clear-indexeddb':
          if (developerModeEnabled) {
            void handleIndexedDbReset();
          }
          break;
        default:
          logIntegrationWarning(
            `Unhandled toolbar action: ${normalizedAction} (raw: ${action})`,
            new Error('Unhandled action')
          );
      }
    },
    [
      pageNodeId,
      treeId,
      actions,
      developerModeEnabled,
      navigate,
      requestEdit,
      handleIndexedDbReset,
      archiveRootIdRef,
      persistSettings,
    ]
  );

  const toolbarProps: React.ComponentProps<typeof TreeConsoleToolbar> = {
    isProjectsPage: pageTreeNode?.metadata?.name?.toLowerCase().includes('project'),
    isResourcesPage: pageTreeNode?.metadata?.name?.toLowerCase().includes('resource'),
    controller: {
      searchText: searchTerm,
      handleSearchTextChange: actions.handleSearchChange ?? (() => { }),
      handleSearchCommit: actions.handleSearchCommit ?? (() => { }),
    },
    hasArchiveItems,
    onAction: handleToolbarAction,
    rowClickAction,
    canUndo: state.canUndo,
    canRedo: state.canRedo,
    canCopy: selectedCount > 0,
    canPaste: state.canPaste || false,
    canDuplicate: selectedCount > 0,
    canArchive: state.canArchive,
    canRemove: state.canArchive,
    allowImport: canImportFromNode(pageTreeNode),
    developerModeEnabled,
    autosaveEnabled,
    dialogBackdropDismissEnabled,
    viewMode,
    onViewModeChange,
    sortMode,
    onSortModeChange,
    onAutosaveEnabledChange: (enabled: boolean) => {
      setAutosaveEnabled(enabled);
      persistSettings({ autosaveEnabled: enabled });
    },
    onDialogBackdropDismissEnabledChange: (enabled: boolean) => {
      setDialogBackdropDismissEnabled(enabled);
      persistSettings({ dialogBackdropDismissEnabled: enabled });
    },
    onRowClickActionChange: (nextAction: 'Select/Navigate' | 'Edit') => {
      setRowClickAction(nextAction);
      persistSettings({ rowClickAction: nextAction });
    },
    zoomBandBoundaries,
    onZoomBandBoundariesChange: (nextBoundaries: number[]) => {
      setZoomBandBoundaries(nextBoundaries);
      persistSettings({ zoomBandBoundaries: nextBoundaries });
    },
    buildContinuationPolicy,
    onBuildContinuationPolicyChange: (policy: BuildContinuationPolicy) => {
      setBuildContinuationPolicy(policy);
      persistSettings({ buildContinuationPolicy: policy });
    },
  } as React.ComponentProps<typeof TreeConsoleToolbar>;

  return {
    toolbarProps,
    rowClickAction,
    setRowClickAction,
    autosaveEnabled,
    setAutosaveEnabled,
    dialogBackdropDismissEnabled,
    setDialogBackdropDismissEnabled,
    zoomBandBoundaries,
    setZoomBandBoundaries,
    buildContinuationPolicy,
    setBuildContinuationPolicy,
  };
}
