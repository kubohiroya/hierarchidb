import type { NodeId, TreeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { useOptionalBuildSessionRuntimeContext } from '@hierarchidb/ui-batch-progress';
import type {
  TreeConsolePanelProps as BaseTreeConsolePanelProps,
  HierarchicalTreeNode,
} from '@hierarchidb/ui-treeconsole-base';
import { TagsLinkButton } from '@hierarchidb/ui-treeconsole-base';
import { useLocation, useNavigate } from '@tanstack/react-router';
import type { Remote } from 'comlink';
import { createElement, useCallback, useMemo, useState } from 'react';
import { resolvePreviewGuardState } from '~/hooks/treeconsole/actions/dialog.ts';
import { resolveOpenStepsForNode } from '~/hooks/treeconsole/resolveOpenSteps.ts';
import { useTreeConsoleIntegration } from '~/hooks/useTreeConsoleIntegration.ts';
import type { WorkerAPI } from '~/types/worker-api.js';
import { resolveDeveloperMode } from '~/utils/developerMode.ts';
import { useIndexedDbReset } from './useIndexedDbReset.js';
import { useTreeConsoleResumeDialog } from './useTreeConsoleResumeDialog.js';
import { useTreeConsoleToolbarActions } from './useTreeConsoleToolbarActions.js';
import { useTreeConsoleArchiveWatcher } from './useTreeConsoleArchiveWatcher.js';

type TreeConsolePanelProps = BaseTreeConsolePanelProps;
type TreeConsoleBreadcrumbProps = React.ComponentProps<
  typeof import('@hierarchidb/ui-plugin-shell/ui-treeconsole-breadcrumb').TreeConsoleBreadcrumb
>;
type TreeNodeInfoPanelProps = React.ComponentProps<
  typeof import('./TreeNodeInfoPanel.js').TreeNodeInfoPanel
>;

export type UseTreeConsoleIntegrationInnerArgs = {
  client?: Remote<WorkerAPI>;
  treeId?: string;
  pageNodeId?: NodeId;
  pageTreeNode?: TreeNode;
  resetWorker: () => void;
  initializeWorker: () => Promise<void>;
};

export type UseTreeConsoleIntegrationInnerResult = {
  workerLoading: boolean;
  workerError: unknown;
  shouldRenderTreeTable: boolean;
  isDialogRoute: boolean;
  speedDialSuppressed: boolean;
  setSpeedDialSuppressed: React.Dispatch<React.SetStateAction<boolean>>;
  toolbarProps: React.ComponentProps<
    typeof import('@hierarchidb/ui-treeconsole-toolbar').TreeConsoleToolbar
  >;
  treeConsolePanelProps: TreeConsolePanelProps;
  breadcrumbProps: TreeConsoleBreadcrumbProps;
  infoPanelProps: TreeNodeInfoPanelProps;
};

export function useTreeConsoleIntegrationInner({
  client,
  treeId,
  pageNodeId,
  pageTreeNode,
  resetWorker,
  initializeWorker,
}: UseTreeConsoleIntegrationInnerArgs): UseTreeConsoleIntegrationInnerResult {
  const location = useLocation();
  const navigate = useNavigate();

  const {
    loading: workerLoading,
    error: workerError,
    treeData,
    nodeIndex,
    columns,
    breadcrumbItems,
    selectedIds,
    expandedIds,
    searchTerm,
    viewMode,
    canCreate,
    canEdit,
    canArchive,
    actions,
    state,
  } = useTreeConsoleIntegration({
    client: client ?? undefined,
    treeId,
    pageNodeId,
    pageTreeNode,
    pushPath: (to: string | number) => {
      if (typeof to === 'number') {
        window.history.go(to);
        return;
      }

      if (to.startsWith('?')) {
        const nextHref = `${location.pathname}${to}`;
        navigate({ to: nextHref, replace: false });
        return;
      }

      navigate({ to, replace: false });
    },
    locationSearch: location.searchStr,
    returnTo: `${location.pathname}${location.searchStr ?? ''}`,
  });

  const [speedDialSuppressed, setSpeedDialSuppressed] = useState(false);
  const isDialogRoute = useMemo(() => {
    const pathname = location.pathname;
    if (typeof window === 'undefined') {
      const segments = pathname.replace(/^\/+|\/+$/g, '').split('/');
      return segments.length >= 6 && segments[0] === 't';
    }
    const hash = window.location.hash ?? '';
    const hashPath = hash.startsWith('#/') ? hash.slice(1).split('?')[0] : '';
    const path = hashPath || pathname;
    const segments = path.replace(/^\/+|\/+$/g, '').split('/');
    return segments.length >= 6 && segments[0] === 't';
  }, [location.pathname]);

  const developerModeEnabled = useMemo(
    () => resolveDeveloperMode(location.searchStr),
    [location.searchStr]
  );

  const runtimeContext = useOptionalBuildSessionRuntimeContext();
  const buildSessionIndicator = useMemo(
    () => ({
      runningNodeIds: runtimeContext?.runningNodeIds
        ? new Set(runtimeContext.runningNodeIds)
        : new Set<NodeId>(),
      activeNodeIds: runtimeContext?.activeNodeIds
        ? new Set(runtimeContext.activeNodeIds)
        : new Set<NodeId>(),
    }),
    [runtimeContext?.activeNodeIds, runtimeContext?.runningNodeIds]
  );

  const resolvePreviewGuardStateForNode = useCallback(
    async (node: HierarchicalTreeNode) => {
      if (!client) return { canOpen: true };
      return resolvePreviewGuardState({
        client,
        nodeType: String(node.nodeType ?? ''),
        nodeId: node.id as NodeId,
      });
    },
    [client]
  );

  const { hasArchiveItems, trashRootIdRef } = useTreeConsoleArchiveWatcher({
    client,
    treeId,
  });

  const { handleIndexedDbReset } = useIndexedDbReset({
    developerModeEnabled,
    resetWorker,
    initializeWorker,
    navigate,
  });

  const { requestEdit } = useTreeConsoleResumeDialog({
    client,
    actions: {
      handleEdit: actions.handleEdit,
      handleContextMenuAction: actions.handleContextMenuAction,
    },
  });

  const handleContextMenuAction = useCallback(
    (
      action: string,
      node: HierarchicalTreeNode,
      options?: { navigateToParent?: boolean; nextVisible?: boolean }
    ) => {
      if (action === 'edit') {
        void (async () => {
          await requestEdit(node.id as NodeId, node);
        })();
        return;
      }
      actions.handleContextMenuAction(action, node, options);
    },
    [actions, requestEdit]
  );

  const handleTagsNavigate = useCallback(() => {
    if (!treeId || !pageNodeId) return;
    navigate({
      to: '/t/$treeId/$pageNodeId/tags',
      params: {
        treeId: String(treeId),
        pageNodeId: String(pageNodeId),
      },
    });
  }, [navigate, pageNodeId, treeId]);

  const handleBreadcrumbContextAction = useCallback(
    (
      action: string,
      breadcrumbNode: {
        id?: string;
        treeNodeId?: string;
        parentId?: string | null;
        nodeType?: string;
        type?: string;
        name?: string;
        metadata?: { name?: string; description?: string; tags?: string[] };
        visible?: boolean;
        depth?: number;
      },
      options?: { navigateToParent?: boolean; nextVisible?: boolean }
    ) => {
      const rawId = breadcrumbNode.id ?? breadcrumbNode.treeNodeId;
      if (!rawId) return;
      const parentFallback =
        breadcrumbNode.parentId ??
        (pageNodeId ? String(pageNodeId) : treeId ? `${treeId}:root` : null);
      const nodeData: HierarchicalTreeNode = {
        id: rawId as NodeId,
        nodeType: (breadcrumbNode.nodeType ?? 'folder') as HierarchicalTreeNode['nodeType'],
        metadata: {
          name: breadcrumbNode.metadata?.name ?? breadcrumbNode.name ?? '',
          description: breadcrumbNode.metadata?.description,
          tags: breadcrumbNode.metadata?.tags ?? [],
        },
        visible: breadcrumbNode.visible,
        draftMetadata: null,
        data: null,
        draftData: undefined,
        parentId: parentFallback ? (parentFallback as NodeId) : (pageNodeId as NodeId | undefined),
        depth: breadcrumbNode.depth ?? 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      } as HierarchicalTreeNode;

      actions.handleContextMenuAction(action, nodeData, options);
    },
    [actions, pageNodeId, treeId]
  );

  const resolveOpenSteps = useCallback(
    async (nodeId: string, nodeType: string) => {
      const resolvedId = nodeId as NodeId;
      const indexedNode =
        (nodeIndex?.get(resolvedId) as TreeNode | undefined) ??
        (pageTreeNode && String(pageTreeNode.id) === String(resolvedId) ? pageTreeNode : undefined);
      return resolveOpenStepsForNode({
        nodeId: resolvedId,
        nodeType,
        node: indexedNode ?? null,
        client: client ?? null,
      });
    },
    [client, nodeIndex, pageTreeNode]
  );

  const { toolbarProps, rowClickAction } = useTreeConsoleToolbarActions({
    treeId,
    pageNodeId,
    pageTreeNode,
    hasArchiveItems,
    trashRootIdRef,
    navigate,
    actions: {
      handleUndo: actions.handleUndo,
      handleRedo: actions.handleRedo,
      handleCut: actions.handleCut,
      handleCopy: actions.handleCopy,
      handlePaste: actions.handlePaste,
      handleDuplicate: actions.handleDuplicate,
      handleArchive: actions.handleArchive,
      handleImport: actions.handleImport,
      handleExport: actions.handleExport,
      handleRefresh: actions.handleRefresh,
      handleSearchChange: actions.handleSearchChange,
      handleSearchCommit: actions.handleSearchCommit,
    },
    state: {
      canUndo: state.canUndo,
      canRedo: state.canRedo,
      canPaste: state.canPaste,
      canArchive,
    },
    developerModeEnabled,
    handleIndexedDbReset,
    requestEdit,
    searchTerm,
    selectedCount: selectedIds.length,
  });

  const shouldRenderTreeTable =
    !pageTreeNode ||
    (pageTreeNode.nodeType ?? '').toLowerCase() === 'folder' ||
    (pageTreeNode.nodeType ?? '').toLowerCase() === 'trash_highlight_placeholder';

  const lowerPageNodeId = pageNodeId ? String(pageNodeId).toLowerCase() : '';
  const isArchivePage =
    pageTreeNode?.nodeType === 'trash' ||
    lowerPageNodeId.endsWith(':trash') ||
    lowerPageNodeId === 'trash';

  const treeConsolePanelProps: TreeConsolePanelProps = {
    treeId: treeId as TreeId,
    client,
    title: `Tree: ${pageTreeNode?.metadata?.name || 'Root'}`,
    pageNodeId,
    pageTreeNode,
    data: [...treeData],
    nodeIndex,
    columnsDeprecated: columns,
    breadcrumbItems,
    loading: state.loading,
    error: state.error || undefined,
    selectedIds,
    expandedIds,
    searchTerm,
    sortBy: state.sortBy,
    sortDirection: state.sortDirection,
    filterBy: state.filterBy,
    availableFilters: state.availableFilters,
    viewMode,
    rowClickAction,
    canCreate,
    canEdit,
    canArchive,
    showNavigationButtons: true,
    dense: false,
    onNodeClick: actions.handleNodeClick,
    onNodeSelect: actions.handleNodeSelect,
    onNodeExpand: actions.handleNodeExpand,
    onSearchChange: actions.handleSearchChange,
    onSearchClear: actions.handleSearchClear,
    onCreate: actions.handleCreate,
    onEdit: actions.handleEdit,
    onDelete: actions.handleArchive,
    onRefresh: actions.handleRefresh,
    onExpandAll: actions.handleExpandAll,
    onCollapseAll: actions.handleCollapseAll,
    onSort: actions.handleSort,
    onFilterChange: actions.handleFilterChange,
    onViewModeChange: actions.handleViewModeChange,
    onBreadcrumbNavigate: actions.handleBreadcrumbNavigate,
    onNavigateBack: actions.handleNavigateBack,
    onNavigateForward: actions.handleNavigateForward,
    canGoBack: state.canGoBack,
    canGoForward: state.canGoForward,
    onContextMenuAction: handleContextMenuAction,
    resolvePreviewGuardState: resolvePreviewGuardStateForNode,
    resolveOpenSteps,
    onBreadcrumbContextAction: handleBreadcrumbContextAction,
    onMoveNodes: actions.handleMoveNodes,
    buildSessionIndicator,
    onNavigateTags: handleTagsNavigate,
    useArchiveColumns: isArchivePage,
    speedDialSuppressed,
    setSpeedDialSuppressed,
    isDialogRoute,
  } as TreeConsolePanelProps;

  const tagsLeftSlot =
    treeId && pageNodeId
      ? createElement(TagsLinkButton, {
          treeId: String(treeId),
          pageNodeId: String(pageNodeId),
          onNavigate: handleTagsNavigate,
        })
      : undefined;

  const breadcrumbProps: TreeConsoleBreadcrumbProps = {
    nodePath: breadcrumbItems,
    onNodeClick: actions.handleBreadcrumbNavigate,
    treeId,
    pageNodeId,
    useArchiveColumns: isArchivePage,
    iconInteractive: !isArchivePage,
    onContextAction: handleBreadcrumbContextAction,
    resolveOpenSteps,
    leftSlot: tagsLeftSlot,
  } as TreeConsoleBreadcrumbProps;

  const infoPanelProps: TreeNodeInfoPanelProps = {
    treeId: treeId as TreeId | undefined,
    pageNodeId: pageNodeId as NodeId | undefined,
    node: pageTreeNode,
    onContextMenuAction: handleContextMenuAction,
  } as TreeNodeInfoPanelProps;

  return {
    workerLoading,
    workerError,
    shouldRenderTreeTable,
    isDialogRoute,
    speedDialSuppressed,
    setSpeedDialSuppressed,
    toolbarProps,
    treeConsolePanelProps,
    breadcrumbProps,
    infoPanelProps,
  };
}
