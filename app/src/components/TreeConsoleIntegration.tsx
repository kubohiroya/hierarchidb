/**
 * TreeConsole Integration Component
 *
 * Integrates TreeConsolePanel with WorkerAPIClient for tree data management.
 * Avoids Orchestrated APIs as requested and focuses on direct Worker API calls.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { proxy as comlinkProxy } from 'comlink';
import { Alert, Box, CircularProgress } from '@mui/material';
import { TreeConsolePanelWithDynamicSpeedDial } from './TreeConsolePanelWithDynamicSpeedDial';
import type { TreeConsoleToolbarActionParams } from '@hierarchidb/ui-treeconsole-toolbar';
import { TreeConsoleToolbar } from '@hierarchidb/ui-treeconsole-toolbar';
import { useTreeConsoleIntegration } from '~/hooks/useTreeConsoleIntegration';
import { useWorkerClient } from '~/contexts/WorkerProvider';
import { ProjectsGuidedTour, ResourcesGuidedTour, TopPageGuidedTour } from '@hierarchidb/runtime-ui-tour';
import { useLocation, useNavigate } from 'react-router';
import type { NodeId, TreeId, TreeNode } from '@hierarchidb/common-type';
import type { Remote } from 'comlink';
import type { WorkerAPI } from '@hierarchidb/common-api';

export interface TreeConsoleIntegrationProps {
  readonly treeId?: string;
  readonly pageNodeId?: NodeId;
  readonly pageTreeNode?: TreeNode;
}

// Inner component that uses the hook (client is guaranteed to be non-null)
const TreeConsoleIntegrationInner: React.FC<
  TreeConsoleIntegrationProps & { client: Remote<WorkerAPI> }
> = ({ client: workerClient, treeId, pageNodeId, pageTreeNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [tourRun, setTourRun] = useState(false);
  const [hasTrashItems, setHasTrashItems] = useState(false);
  const trashSubRef = useRef<string | null>(null);
  const trashRefreshTimerRef = useRef<number | null>(null);

  const {
    loading: workerLoading,
    error: workerError,
    treeData,
    columns,
    breadcrumbItems,
    selectedIds,
    expandedIds,
    searchTerm,
    viewMode,
    canCreate,
    canEdit,
    canDelete,
    actions,
    state,
  } = useTreeConsoleIntegration({
    client: workerClient,
    treeId,
    pageNodeId,
    pageTreeNode,
    pushPath: (to: string | number) => navigate(to as any),
    locationSearch: location.search,
  });

  // Row Click Action state (Select | Edit | Navigate)
  const [rowClickAction, setRowClickAction] = useState<'Select' | 'Edit' | 'Navigate'>('Select');

  // Check for trash items when worker client is available
  useEffect(() => {
    const checkTrashItems = async () => {
      if (workerClient && treeId) {
        try {
          // Use facade APIs instead of deprecated direct methods
          const queryAPI = await workerClient.getQueryAPI();
          const tree = await queryAPI.getTree(treeId as TreeId);
          if (tree?.trashRootId) {
            const trashChildren = await queryAPI.listChildren(tree.trashRootId as NodeId);
            setHasTrashItems(trashChildren.length > 0);
          }
        } catch (error) {
          console.error('Failed to check trash items:', error);
        }
      }
    };
    checkTrashItems();
  }, [workerClient, treeId]);

  // Subscribe to trash root changes and update hasTrashItems reactively
  useEffect(() => {
    let disposed = false;
    const setup = async () => {
      if (!workerClient || !treeId) return;
      try {
        const queryAPI = await workerClient.getQueryAPI();
        const subscriptionAPI = await workerClient.getSubscriptionAPI();
        const tree = await queryAPI.getTree(treeId as TreeId);
        const trashRootId = tree?.trashRootId as NodeId | undefined;
        if (!trashRootId) return;

        // Clear previous subscription
        if (trashSubRef.current) {
          try { await subscriptionAPI.unsubscribe(trashSubRef.current as any); } catch {}
          trashSubRef.current = null;
        }

        // Debounced refresh to avoid bursty listChildren calls
        const requestRefresh = () => {
          if (disposed) return;
          if (trashRefreshTimerRef.current !== null) return;
          trashRefreshTimerRef.current = window.setTimeout(async () => {
            trashRefreshTimerRef.current = null;
            try {
              const children = await queryAPI.listChildren(trashRootId as NodeId);
              setHasTrashItems((children?.length || 0) > 0);
            } catch (e) {
              console.warn('Failed to refresh trash items:', e);
            }
          }, 80);
        };

        // Initial refresh
        requestRefresh();

        // Subscribe to trash subtree notifications (worker-driven)
        const sid = await subscriptionAPI.subscribeSubtree(
          trashRootId as NodeId,
          comlinkProxy((_ev: any) => {
            requestRefresh();
          }),
        );
        if (disposed) {
          try { await subscriptionAPI.unsubscribe(sid); } catch {}
          return;
        }
        trashSubRef.current = sid as any;
      } catch (error) {
        console.warn('Trash subscription setup failed:', error);
      }
    };

    void setup();
    return () => {
      disposed = true;
      if (trashRefreshTimerRef.current !== null) {
        try { window.clearTimeout(trashRefreshTimerRef.current); } catch {}
        trashRefreshTimerRef.current = null;
      }
      const cleanup = async () => {
        try {
          if (workerClient && trashSubRef.current) {
            const subscriptionAPI = await workerClient.getSubscriptionAPI();
            await subscriptionAPI.unsubscribe(trashSubRef.current as any);
          }
        } catch {}
        trashSubRef.current = null;
      };
      void cleanup();
    };
  }, [workerClient, treeId]);

  // Handle toolbar actions
  const handleToolbarAction = useCallback(
    (action: string, params?: TreeConsoleToolbarActionParams) => {
      const currentPageNodeId = pageNodeId || 'root';

      const importTemplate = async (templateId: string) => {
        try {
          const base = (import.meta as any)?.env?.BASE_URL || '/';
          const url = `${String(base).replace(/\/+$/, '/') }templates/${templateId}/tree-nodes.json`;
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Failed to load template: ${templateId}`);
          const data = await res.json();

          // Convert template structure (flat map + parent refs) to ImportData format
          const nodesMap: Record<string, any> = data?.nodes || {};
          const rootIds: string[] = data?.rootNodeIds || [];

          const buildTree = (id: string): any => {
            const n = nodesMap[id];
            if (!n) return null;
            const children = Object.values(nodesMap)
              .filter((c: any) => c?.parentTreeNodeId === id)
              .map((c: any) => buildTree(c.treeNodeId))
              .filter(Boolean);
            return {
              name: n.name,
              nodeType: (n.treeNodeType || 'folder') as any,
              description: n.description,
              metadata: n.metadata,
              children: children && children.length > 0 ? children : undefined,
            };
          };

          const importNodes = rootIds
            .map((rid) => buildTree(rid))
            .filter(Boolean);

          if (!workerClient) throw new Error('Worker client not ready');
          const importExportAPI = await workerClient.getImportExportAPI();
          await importExportAPI.importNodes({
            treeId: (treeId as TreeId) || ('' as TreeId),
            targetParentId: currentPageNodeId as NodeId,
            data: { nodes: importNodes as any[] },
            format: 'json',
            conflictResolution: 'rename',
          });

          await actions.handleRefresh?.();
        } catch (e) {
          console.error('Template import failed:', e);
          // Surface a simple error for now; production UX can use a snackbar/dialog
          try { alert(`Import Template failed: ${String(e)}`); } catch {}
        }
      };

      switch (action) {
        case 'setRowClickAction':
          if (typeof params === 'string') {
            setRowClickAction(params as 'Select' | 'Edit' | 'Navigate');
          }
          break;
        case 'import-template':
          if (params && typeof params === 'object' && 'templateId' in params) {
            void importTemplate((params as any).templateId);
          } else {
            console.warn('import-template action missing templateId');
          }
          break;
        case 'restore':
          // Open trash dialog in recover mode
          navigate(`/t/${treeId}/${currentPageNodeId}/trash/recover`);
          break;
        case 'empty':
          // High-level API: removeSubtree(trashRootId)
          (async () => {
            try {
              const ok = confirm('Trash will be permanently emptied. This cannot be undone. Continue?');
              if (!ok) return;
              const queryAPI = await workerClient.getQueryAPI();
              const mutationAPI = await workerClient.getMutationAPI();
              const t = await queryAPI.getTree(treeId as TreeId);
              const trashRootId = t?.trashRootId as NodeId | undefined;
              if (!trashRootId) {
                alert('Trash root not found.');
                return;
              }
              const res = await (mutationAPI as any).removeSubtree(trashRootId);
              if (!res?.success) {
                alert('Failed to empty trash: ' + (res?.error || 'Unknown error'));
                return;
              }
              await actions.handleRefresh?.();
            } catch (e) {
              console.error('Empty trash failed:', e);
              alert('Empty trash failed: ' + String(e));
            }
          })();
          break;
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
        case 'remove':
          actions.handleDelete?.();
          break;
        case 'import':
          actions.handleImport?.();
          break;
        case 'export':
          actions.handleExport?.();
          break;
        default:
          console.log('Unhandled toolbar action:', action, params);
      }
    },
    [navigate, treeId, pageNodeId, actions],
  );

  // Handler for starting guided tour
  const handleStartTour = useCallback(() => {
    setTourRun(true);
  }, []);

  const handleTourFinish = useCallback(() => {
    setTourRun(false);
  }, []);

  console.log('[TreeConsoleIntegration] Render state:', {
    workerLoading,
    workerError,
    workerClient: !!workerClient,
    treeData: treeData?.length || 0,
    loading: state.loading,
  });

  // Handle loading state
  if (workerLoading) {
    console.log('[TreeConsoleIntegration] Showing loading spinner (worker loading)');
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          minHeight: 400,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // Handle error state
  if (workerError) {
    console.log('[TreeConsoleIntegration] Showing error:', workerError);
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">Failed to initialize TreeConsole: {workerError}</Alert>
      </Box>
    );
  }

  // Handle no worker client
  if (!workerClient) {
    console.log('[TreeConsoleIntegration] Worker client not available');
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="warning">Worker client not available</Alert>
      </Box>
    );
  }

  // Select the appropriate tour based on the current path
  const renderGuidedTour = () => {
    if (treeId === 'p') {
      return <ProjectsGuidedTour run={tourRun} onFinish={handleTourFinish} />;
    } else if (
      treeId === 'r') {
      return <ResourcesGuidedTour run={tourRun} onFinish={handleTourFinish} />;
    } else {
      return <TopPageGuidedTour run={tourRun} onFinish={handleTourFinish} />;
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {renderGuidedTour()}
      <TreeConsoleToolbar
        isProjectsPage={pageTreeNode?.name?.toLowerCase().includes('project')}
        isResourcesPage={pageTreeNode?.name?.toLowerCase().includes('resource')}
        controller={{
          searchText: searchTerm,
          handleSearchTextChange: actions.handleSearchChange,
          handleSearchCommit: actions.handleSearchCommit,
        }}
        hasTrashItems={hasTrashItems}
        onAction={handleToolbarAction}
        rowClickAction={rowClickAction}
        canUndo={state.canUndo}
        canRedo={state.canRedo}
        canCopy={selectedIds.length > 0}
        canPaste={state.canPaste || false}
        canDuplicate={selectedIds.length > 0}
        canRemove={canDelete && selectedIds.length > 0}
      />

      {/* TreeConsole Panel */}
      <TreeConsolePanelWithDynamicSpeedDial
        treeId={treeId as TreeId}
        workerClient={workerClient}
        onStartTour={handleStartTour}
        title={`Tree: ${pageTreeNode?.name || 'Root'}`}
        rootNodeId={pageNodeId}
        data={treeData}
        columns={columns}
        breadcrumbItems={breadcrumbItems}
        loading={state.loading}
        error={state.error || undefined}
        selectedIds={selectedIds}
        expandedIds={expandedIds}
        searchTerm={searchTerm}
        sortBy={state.sortBy}
        sortDirection={state.sortDirection}
        filterBy={state.filterBy}
        availableFilters={state.availableFilters}
        viewMode={viewMode}
        rowClickAction={rowClickAction}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
        showNavigationButtons={true}
        dense={false}
        onNodeClick={actions.handleNodeClick}
        onNodeSelect={actions.handleNodeSelect}
        onNodeExpand={actions.handleNodeExpand}
        onSearchChange={actions.handleSearchChange}
        onSearchClear={actions.handleSearchClear}
        onCreate={actions.handleCreate}
        onEdit={actions.handleEdit}
        onDelete={actions.handleDelete}
        onRefresh={actions.handleRefresh}
        onExpandAll={actions.handleExpandAll}
        onCollapseAll={actions.handleCollapseAll}
        onSort={actions.handleSort}
        onFilterChange={actions.handleFilterChange}
        onViewModeChange={actions.handleViewModeChange}
        onBreadcrumbNavigate={actions.handleBreadcrumbNavigate}
        onNavigateBack={actions.handleNavigateBack}
        onNavigateForward={actions.handleNavigateForward}
        canGoBack={state.canGoBack}
        canGoForward={state.canGoForward}
        onContextMenuAction={actions.handleContextMenuAction}
        onMoveNodes={actions.handleMoveNodes}
      />
    </Box>
  );
};

// Outer component that handles client loading
export const TreeConsoleIntegration: React.FC<TreeConsoleIntegrationProps> = ({
                                                                                treeId,
                                                                                pageNodeId,
                                                                                pageTreeNode,
                                                                              }) => {
  console.log('[TreeConsoleIntegration] Rendering with props:', {
    treeId,
    pageNodeId,
    pageTreeNode,
  });

  // Get the Worker API client from WorkerSingletonProvider
  const { client: workerClient, isConnected } = useWorkerClient();

  // Check connection status
  if (!isConnected || !workerClient) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100%">
        <CircularProgress />
      </Box>
    );
  }

  // Render the inner component with guaranteed non-null client
  return (
    <TreeConsoleIntegrationInner
      client={workerClient}
      treeId={treeId}
      pageNodeId={pageNodeId}
      pageTreeNode={pageTreeNode}
    />
  );
};
