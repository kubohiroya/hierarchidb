/**
 * TreeConsole Integration Component
 *
 * Integrates TreeConsolePanel with WorkerAPIClient for tree data management.
 * Avoids Orchestrated APIs as requested and focuses on direct Worker API calls.
 */

import { useState, useCallback, useEffect } from 'react';
import { Box, Alert, CircularProgress } from '@mui/material';
import { TreeConsolePanelWithDynamicSpeedDial } from './TreeConsolePanelWithDynamicSpeedDial';
import { TreeConsoleToolbar } from '@hierarchidb/ui-treeconsole-toolbar';
import type { TreeConsoleToolbarActionParams } from '@hierarchidb/ui-treeconsole-toolbar';
import { useTreeConsoleIntegration } from '~/hooks/useTreeConsoleIntegration';
import { TopPageGuidedTour, ProjectsGuidedTour, ResourcesGuidedTour } from '@hierarchidb/_app-tour';
import { useLocation, useNavigate } from 'react-router';
import type { NodeId, TreeNode, TreeId } from '@hierarchidb/common-core';

export interface TreeConsoleIntegrationProps {
  readonly treeId?: string;
  readonly pageNodeId?: NodeId;
  readonly pageTreeNode?: TreeNode;
}

export const TreeConsoleIntegration: React.FC<TreeConsoleIntegrationProps> = ({
  treeId,
  pageNodeId,
  pageTreeNode,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [tourRun, setTourRun] = useState(false);
  const [hasTrashItems, setHasTrashItems] = useState(false);

  const {
    workerClient,
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
    treeId,
    pageNodeId,
    pageTreeNode,
  });

  // Check for trash items when worker client is available
  useEffect(() => {
    const checkTrashItems = async () => {
      if (workerClient && treeId) {
        try {
          const api = workerClient.getAPI();
          // Get trash root node and check if it has children
          const tree = await api.getTree({ treeId: treeId as TreeId });
          if (tree?.trashRootId) {
            const trashChildren = await api.getChildren({
              parentId: tree.trashRootId,
            });
            setHasTrashItems(trashChildren.length > 0);
          }
        } catch (error) {
          console.error('Failed to check trash items:', error);
        }
      }
    };
    checkTrashItems();
  }, [workerClient, treeId]);

  // Handle toolbar actions
  const handleToolbarAction = useCallback(
    (action: string, params?: TreeConsoleToolbarActionParams) => {
      const currentPageNodeId = pageNodeId || 'root';

      switch (action) {
        case 'restore':
          // Navigate to trash dialog in recover mode
          // Use the trash root as the target for now, will be refined based on selection
          navigate(`/t/${treeId}/${currentPageNodeId}/trash/recover`);
          break;
        case 'empty':
          // Navigate to trash dialog in delete mode
          navigate(`/t/${treeId}/${currentPageNodeId}/trash/delete`);
          break;
        case 'undo':
          actions.handleUndo?.();
          break;
        case 'redo':
          actions.handleRedo?.();
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
    [navigate, treeId, pageNodeId, actions]
  );

  // Handler for starting guided tour (kept for future use)
  // const handleStartTour = useCallback(() => {
  //   setTourRun(true);
  // }, []);

  const handleTourFinish = useCallback(() => {
    setTourRun(false);
  }, []);

  // Handle loading state
  if (workerLoading) {
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
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">Failed to initialize TreeConsole: {workerError}</Alert>
      </Box>
    );
  }

  // Handle no worker client
  if (!workerClient) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="warning">Worker client not available</Alert>
      </Box>
    );
  }

  // Select the appropriate tour based on the current path
  const renderGuidedTour = () => {
    const path = location.pathname.toLowerCase();

    if (path.includes('/projects') || pageTreeNode?.name?.toLowerCase().includes('project')) {
      return <ProjectsGuidedTour run={tourRun} onFinish={handleTourFinish} />;
    } else if (
      path.includes('/resources') ||
      pageTreeNode?.name?.toLowerCase().includes('resource')
    ) {
      return <ResourcesGuidedTour run={tourRun} onFinish={handleTourFinish} />;
    } else {
      return <TopPageGuidedTour run={tourRun} onFinish={handleTourFinish} />;
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {renderGuidedTour()}
      {/* TreeConsole Toolbar */}
      <TreeConsoleToolbar
        isProjectsPage={pageTreeNode?.name?.toLowerCase().includes('project')}
        isResourcesPage={pageTreeNode?.name?.toLowerCase().includes('resource')}
        controller={{
          searchText: searchTerm,
          handleSearchTextChange: actions.handleSearchChange,
        }}
        hasTrashItems={hasTrashItems}
        onAction={handleToolbarAction}
        rowClickAction="Select"
        canUndo={state.canUndo || false}
        canRedo={state.canRedo || false}
        canCopy={selectedIds.length > 0}
        canPaste={state.canPaste || false}
        canDuplicate={selectedIds.length > 0}
        canRemove={canDelete && selectedIds.length > 0}
      />
      {/* TreeConsole Panel */}
      <TreeConsolePanelWithDynamicSpeedDial
        treeId={treeId as TreeId}
        workerClient={workerClient}
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
      />
    </Box>
  );
};
