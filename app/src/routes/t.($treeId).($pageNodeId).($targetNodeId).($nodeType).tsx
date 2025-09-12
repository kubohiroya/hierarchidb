import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData, useNavigate, useParams } from 'react-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Typography,
} from '@mui/material';
import { Clear as RemoveIcon, Close as CloseIcon, RestoreFromTrash as RestoreIcon } from '@mui/icons-material';
import type { TreeNodeData } from '@hierarchidb/ui-treeconsole-base';
import { TreeConsolePanel } from '@hierarchidb/ui-treeconsole-base';
import type { LoadTargetNodeReturn } from '~/loader';
import { loadTargetNode, LoadTargetNodeArgs } from '~/loader';
import { WorkerAPIClient } from '../WorkerAPIClient';
import { NodeId, TreeNode } from '@hierarchidb/common-type';
import { convertTreeNodeToTreeNodeData, createDefaultColumns } from '~/utils/treeNodeConverter';

export async function clientLoader(args: LoaderFunctionArgs) {
  const params = args.params as LoadTargetNodeArgs & { nodeType: string };

  //  pageNodeIdID
  const pageNodeId = params.pageNodeId || (`${params.treeId}Root` as NodeId);
  const actualPageNodeId =
    pageNodeId === 'undefined' ? (`${params.treeId}Root` as NodeId) : pageNodeId;

  const result = await loadTargetNode({
    ...params,
    pageNodeId: actualPageNodeId,
  });

  // Load trash items if targetNodeId is "trash" or trash root
  const client = result.client;
  const tree = result.tree;

  let trashRootId: NodeId | undefined;
  let trashItems: TreeNode[] = [];

  if (tree) {
    trashRootId = tree.trashRootId;

    // Determine which node to load children from
    const nodeToLoad = params.targetNodeId === 'trash' ? trashRootId : params.targetNodeId;

    // Load children of the trash node
    if (nodeToLoad) {
      try {
        // Use facade pattern: get QueryAPI first
        const queryAPI = await client.getQueryAPI();
        trashItems = await queryAPI.listChildren(nodeToLoad as NodeId);
      } catch (error) {
        console.error('Failed to load trash items:', error);
      }
    }
  }

  return {
    ...result,
    trashRootId,
    trashItems,
    nodeType: params.nodeType,
  };
}

type LoaderData = LoadTargetNodeReturn & {
  trashRootId?: NodeId;
  trashItems?: TreeNode[];
  nodeType?: string;
};

export default function TrashDialog() {
  const { treeId, pageNodeId, targetNodeId, nodeType } = useParams();
  const navigate = useNavigate();
  const data = useLoaderData() as LoaderData;

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Determine mode from nodeType

  const mode = nodeType as 'recover' | 'delete';
  const isRecoverMode = mode === 'recover';
  const isDeleteMode = mode === 'delete';

  // Handle base-dialog close
  const handleClose = () => {
    navigate(`/t/${treeId}/${pageNodeId}`);
  };

  // Handle restore action with enhanced error handling and UX
  const handleRestore = async () => {
    if (selectedIds.length === 0) {
      setError('Please select items to restore');
      return;
    }

    // Show confirmation base-dialog for multiple items
    if (selectedIds.length > 1) {
      if (
        !confirm(`Are you sure you want to restore ${selectedIds.length} items from the trash?`)
      ) {
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const client = await WorkerAPIClient.getSingleton();
      // Use facade pattern: get MutationAPI first
      const mutationAPI = await client.getMutationAPI();

      const result = await mutationAPI.recoverNodesFromTrash({
        nodeIds: selectedIds as NodeId[],
      });

      if (result.success) {
        // Success - show success message briefly, then close base-dialog
        setError(null);
        // TODO: Show success notification instead of alert
        setTimeout(() => {
          handleClose();
          // TODO: Replace with proper refresh using React Router revalidation
          window.location.reload();
        }, 500);
      } else {
        setError(`Failed to restore items: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Handle empty trash action with enhanced confirmation and error handling
  const handleEmptyTrash = async () => {
    if (!data.trashItems || data.trashItems.length === 0) {
      setError('No items to delete');
      return;
    }

    // Enhanced confirmation base-dialog
    const itemCount = data.trashItems.length;
    const confirmMessage = `Are you sure you want to permanently remove all ${itemCount} items from the trash?

⚠️ This action cannot be undone and all selected items will be permanently deleted.`;

    if (!confirm(confirmMessage)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const client = await WorkerAPIClient.getSingleton();
      // Use facade pattern: get MutationAPI first
      const mutationAPI = await client.getMutationAPI();

      const allIds = data.trashItems.map((item: TreeNode) => item.id);

      const result = await mutationAPI.removeNodes(allIds);

      if (result.success) {
        // Success - show success message briefly, then close base-dialog
        setError(null);
        // TODO: Show success notification instead of alert
        setTimeout(() => {
          handleClose();
          // TODO: Replace with proper refresh using React Router revalidation
          window.location.reload();
        }, 500);
      } else {
        setError(`Failed to remove items: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Handle node click in trash (navigation within trash)
  const handleNodeClick = useCallback(
    (node: TreeNodeData) => {
      navigate(`/t/${treeId}/${pageNodeId}/${node.id}/${mode}`);
    },
    [navigate, treeId, pageNodeId, mode],
  );

  // Handle breadcrumb navigation
  const handleBreadcrumbNavigate = useCallback(
    (nodeId: string) => {
      if (nodeId === 'trash' || nodeId === data.trashRootId) {
        // Navigate to trash root
        navigate(`/t/${treeId}/${pageNodeId}/trash/${mode}`);
      } else {
        // Navigate to specific folder-plugin in trash
        navigate(`/t/${treeId}/${pageNodeId}/${nodeId}/${mode}`);
      }
    },
    [navigate, treeId, pageNodeId, mode, data.trashRootId],
  );

  // Handle back navigation (go up one level)
  const handleNavigateBack = useCallback(() => {
    if (targetNodeId !== 'trash' && targetNodeId !== data.trashRootId) {
      // Go back to trash root
      navigate(`/t/${treeId}/${pageNodeId}/trash/${mode}`);
    }
  }, [navigate, treeId, pageNodeId, targetNodeId, data.trashRootId, mode]);

  // Handle node selection
  const handleNodeSelect = useCallback((nodeId: string, selected: boolean) => {
    if (selected) {
      setSelectedIds((prev) => [...prev, nodeId]);
    } else {
      setSelectedIds((prev) => prev.filter((id) => id !== nodeId));
    }
  }, []);

  // Handle node expansion
  const handleNodeExpand = useCallback((nodeId: string, expanded: boolean) => {
    if (expanded) {
      setExpandedIds((prev) => [...prev, nodeId]);
    } else {
      setExpandedIds((prev) => prev.filter((id) => id !== nodeId));
    }
  }, []);

  // Convert trash items to TreeNodeData format
  const treeData: TreeNodeData[] = data.trashItems?.map(convertTreeNodeToTreeNodeData) || [];
  const columns = createDefaultColumns();

  // Create breadcrumb items with proper navigation
  const breadcrumbItems = useMemo(() => {
    const items: { id: string; name: string; nodeType: string }[] = [
      { id: 'trash', name: 'Trash', nodeType: 'folder' },
    ];

    // If we're not at trash root, add current folder-plugin to breadcrumbs
    if (targetNodeId !== 'trash' && targetNodeId !== data.trashRootId && data.targetNode) {
      items.push({
        id: data.targetNode.id,
        name: data.targetNode.name,
        nodeType: data.targetNode.nodeType,
      });
    }

    return items;
  }, [targetNodeId, data.trashRootId, data.targetNode]);

  // Get base-dialog title with context
  const getDialogTitle = () => {
    const baseTitle = isRecoverMode ? 'Restore from Trash' : isDeleteMode ? 'Empty Trash' : 'Trash';

    // Add current folder-plugin context if not at root
    if (targetNodeId !== 'trash' && targetNodeId !== data.trashRootId && data.targetNode) {
      return `${baseTitle} - ${data.targetNode.name}`;
    }

    return baseTitle;
  };

  // Get action button with enhanced UX
  const getActionButton = () => {
    if (isRecoverMode) {
      const buttonText = loading
        ? `Restoring ${selectedIds.length} items...`
        : `Restore Selected (${selectedIds.length})`;

      return (
        <Button
          variant="contained"
          color="primary"
          startIcon={<RestoreIcon />}
          onClick={handleRestore}
          disabled={selectedIds.length === 0 || loading}
          sx={{ minWidth: 180 }}
        >
          {buttonText}
        </Button>
      );
    } else if (isDeleteMode) {
      const itemCount = data.trashItems?.length || 0;
      const buttonText = loading
        ? `Removing ${itemCount} items...`
        : `Remove All (${itemCount} items)`;

      return (
        <Button
          variant="contained"
          color="error"
          startIcon={<RemoveIcon />}
          onClick={handleEmptyTrash}
          disabled={itemCount === 0 || loading}
          sx={{ minWidth: 180 }}
        >
          {buttonText}
        </Button>
      );
    }
    return null;
  };

  // If targetNodeId or nodeType is missing/undefined, don't render the base-dialog
  if (!targetNodeId || targetNodeId === 'undefined' || !nodeType || nodeType === 'undefined') {
    return null;
  }

  return (
    <Dialog
      open
      fullWidth
      maxWidth="lg"
      onClose={handleClose}
      PaperProps={{
        sx: {
          height: '80vh',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ flexGrow: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6">{getDialogTitle()}</Typography>
            {/* Show item count chip */}
            {treeData.length > 0 && (
              <Chip
                label={`${treeData.length} items`}
                size="small"
                variant="outlined"
                color={isDeleteMode ? 'error' : 'primary'}
              />
            )}
          </Box>
          {/* Show current location in subtitle */}
          {targetNodeId !== 'trash' && targetNodeId !== data.trashRootId && data.targetNode && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              📁 {data.targetNode.name}
            </Typography>
          )}
          {(targetNodeId === 'trash' || targetNodeId === data.trashRootId) &&
            treeData.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                🗑️ Trash is empty
              </Typography>
            )}
        </Box>
        <IconButton onClick={handleClose} size="small" disabled={loading}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {/* Loading indicator */}
      {loading && <LinearProgress />}

      <DialogContent sx={{ flex: 1, overflow: 'hidden', p: 0 }}>
        {error && (
          <Alert
            severity="error"
            onClose={() => setError(null)}
            sx={{ m: 2 }}
            action={
              <Button size="small" color="inherit" onClick={() => setError(null)}>
                Dismiss
              </Button>
            }
          >
            {error}
          </Alert>
        )}

        {/* Show empty state when no items */}
        {!loading && !error && treeData.length === 0 && (
          <Alert severity="info" sx={{ m: 2 }}>
            {targetNodeId === 'trash' || targetNodeId === data.trashRootId
              ? '🗑️ The trash is empty. Deleted items will appear here.'
              : '📁 This folder-plugin is empty.'}
          </Alert>
        )}

        {isDeleteMode && (
          <Alert severity="warning" sx={{ m: 2 }}>
            ⚠️ You are about to remove all items from the trash. This action cannot be undone.
          </Alert>
        )}

        {/* Phase 2: Using TreeConsolePanel for trash items display */}
        <TreeConsolePanel
          title="Trash Items"
          rootNodeId={data.trashRootId || 'trash'}
          data={treeData}
          columns={columns}
          breadcrumbItems={breadcrumbItems}
          loading={loading}
          error={error || undefined}
          selectedIds={isRecoverMode ? selectedIds : []}
          expandedIds={expandedIds}
          searchTerm={searchTerm}
          viewMode="list"
          canCreate={false}
          canEdit={false}
          canDelete={false}
          showNavigationButtons={false}
          dense={true}
          availableFilters={[]}
          onNodeClick={handleNodeClick}
          onNodeSelect={isRecoverMode && !loading ? handleNodeSelect : undefined}
          onNodeExpand={handleNodeExpand}
          onSearchChange={setSearchTerm}
          onSearchClear={() => setSearchTerm('')}
          onCreate={() => {
          }}
          onEdit={() => {
          }}
          onDelete={() => {
          }}
          onRefresh={() => window.location.reload()}
          onExpandAll={() => setExpandedIds(treeData.map((d) => d.id))}
          onCollapseAll={() => setExpandedIds([])}
          onSort={() => {
          }}
          onFilterChange={() => {
          }}
          onViewModeChange={() => {
          }}
          onBreadcrumbNavigate={handleBreadcrumbNavigate}
          onNavigateBack={handleNavigateBack}
          onNavigateForward={() => {
          }}
          canGoBack={targetNodeId !== 'trash' && targetNodeId !== data.trashRootId}
          canGoForward={false}
          onContextMenuAction={() => {
          }}
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={handleClose} color="inherit" disabled={loading}>
          Cancel
        </Button>
        {getActionButton()}

        {/* Show selection info in recover mode */}
        {isRecoverMode && selectedIds.length > 0 && !loading && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
            {selectedIds.length} item{selectedIds.length !== 1 ? 's' : ''} selected
          </Typography>
        )}
      </DialogActions>
    </Dialog>
  );
}
