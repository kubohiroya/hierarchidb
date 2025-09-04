import { useLoaderData, useSearchParams, useNavigate, useParams } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { useState, useEffect } from 'react';
import { Box, CircularProgress, AppBar, Toolbar, Typography, Button, Stack, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import {
  ArrowBack as BackIcon,
  RestoreFromTrash as RestoreIcon,
  DeleteForever as EmptyTrashIcon,
} from '@mui/icons-material';
import { loadTree, type LoadTreeArgs } from '~/loader';
import type { LoadTreeReturn } from '~/loader';
import { WorkerAPIClient } from '../../WorkerAPIClient';
import { UserLoginButton } from '@hierarchidb/ui-usermenu';
import { TreeConsolePanel, type TreeNodeData, type TreeTableColumn } from '@hierarchidb/ui-treeconsole-base';
import type { TreeNode, NodeId } from '@hierarchidb/common-type';

// This loader will be used by the route that renders the dialog
export async function clientLoader(args: LoaderFunctionArgs) {
  const treeData = await loadTree(args.params as LoadTreeArgs);
  // Load trash root node
  if (treeData.tree) {
    // Use facade pattern: get QueryAPI first
    const queryAPI = await treeData.client.getQueryAPI();
    const trashRootNode = await queryAPI.getNode(treeData.tree.trashRootId);

    // Load trash items (children of trash root)
    const trashItems = await queryAPI.listChildren(treeData.tree.trashRootId);

    return {
      ...treeData,
      trashRootNode,
      trashItems,
    };
  }
  return treeData;
}

type TrashDialogData = LoadTreeReturn & {
  trashRootNode?: TreeNode;
  trashItems?: TreeNode[];
};

export default function TrashDialog() {
  const data = useLoaderData() as TrashDialogData;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { treeId, pageNodeId, targetNodeId, nodeType, action } = useParams();

  const mode = searchParams.get('mode') || 'restore'; // "restore" or "empty"

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Handle restore selected items
  const handleRestore = async () => {
    if (selectedIds.length === 0) return;

    setLoading(true);
    try {
      const client = await WorkerAPIClient.getSingleton();
      // Use facade pattern: get MutationAPI first
      const mutationAPI = await client.getMutationAPI();

      // Use recoverNodesFromTrash API
      const result = await mutationAPI.recoverNodesFromTrash({
        nodeIds: selectedIds as NodeId[],
      });

      if (result.success) {
        // Refresh the page to show updated trash
        // For dialog, we might want to close it and refresh parent
        navigate(-1); // Go back to the previous page
        window.location.reload(); // Or trigger a revalidation in parent route
      } else {
        console.error('Failed to restore:', result.error);
      }
    } catch (error) {
      console.error('Error restoring items:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle empty trash
  const handleEmptyTrash = async () => {
    if (
      !confirm(
        'Are you sure you want to permanently delete all items in the trash? This action cannot be undone.'
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      const client = await WorkerAPIClient.getSingleton();
      // Use facade pattern: get MutationAPI first
      const mutationAPI = await client.getMutationAPI();

      // Permanently delete all trash items
      const allTrashIds = (data.trashItems || []).map((item) => item.id);

      if (allTrashIds.length > 0) {
        const result = await mutationAPI.removeNodes(allTrashIds);

        if (result.success) {
          // Refresh the page to show empty trash
          navigate(-1); // Go back to the previous page
          window.location.reload(); // Or trigger a revalidation in parent route
        } else {
          console.error('Failed to empty trash:', result.error);
        }
      }
    } catch (error) {
      console.error('Error emptying trash:', error);
    } finally {
      setLoading(false);
    }
  };

  // Convert trash items to TreeNodeData format
  const treeData: TreeNodeData[] = (data.trashItems || []).map((node: TreeNode) => ({
    ...node,
    id: node.id,
    nodeType: node.nodeType,
    children: undefined,
  }));

  // Define columns for trash view
  const columns: TreeTableColumn[] = [
    {
      id: 'name',
      label: 'Name',
      sortable: true,
      width: 300,
      render: (_value, node) => node.name,
    },
    {
      id: 'nodeType',
      label: 'Type',
      sortable: true,
      width: 120,
      render: (_value, node) => node.nodeType,
    },
    {
      id: 'deletedAt',
      label: 'Deleted',
      sortable: true,
      width: 160,
      render: (_value, node) => {
        return node.updatedAt ? new Date(node.updatedAt).toLocaleDateString() : '';
      },
    },
  ];

  const handleClose = () => {
    navigate(-1); // Go back to the previous page
  };

  return (
    <Dialog open onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <AppBar position="static" color="default" elevation={1}>
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              {mode === 'restore' ? 'Restore from Trash' : 'Empty Trash'} - {data.tree?.name}
            </Typography>
            <UserLoginButton />
          </Toolbar>
        </AppBar>
      </DialogTitle>
      <DialogContent dividers sx={{ height: '60vh' }}>
        {loading ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
            }}
          >
            <CircularProgress />
          </Box>
        ) : (
          <TreeConsolePanel
            title={`Trash - ${data.tree?.name}`}
            rootNodeId={data.tree?.trashRootId}
            data={treeData}
            columns={columns}
            breadcrumbItems={[
              {
                id: (data.tree?.trashRootId as NodeId) || ('' as NodeId),
                name: 'Trash',
                nodeType: 'trash',
              },
            ]}
            loading={false}
            selectedIds={selectedIds}
            expandedIds={[]}
            searchTerm=""
            viewMode="list"
            canCreate={false}
            canEdit={false}
            canDelete={mode === 'empty'}
            onNodeClick={(node: TreeNodeData) => console.log('Node clicked:', node)}
            onNodeSelect={(nodeId: string, selected: boolean) => {
              setSelectedIds((prev) => {
                if (selected) {
                  return [...prev, nodeId];
                } else {
                  return prev.filter((id) => id !== nodeId);
                }
              });
            }}
            onNodeExpand={() => {}}
            availableFilters={[]}
            onSearchChange={() => {}}
            onSearchClear={() => {}}
            onCreate={() => {}}
            onEdit={() => {}}
            onDelete={() => {
              if (mode === 'empty') {
                handleEmptyTrash();
              }
            }}
            onRefresh={() => window.location.reload()}
            onExpandAll={() => {}}
            onCollapseAll={() => {}}
            onSort={() => {}}
            onFilterChange={() => {}}
            onViewModeChange={() => {}}
            onBreadcrumbNavigate={() => {}}
            onContextMenuAction={(action: string, node: TreeNodeData) => {
              console.log('Context menu action:', action, 'for node:', node);
              if (action === 'restore' && mode === 'restore') {
                setSelectedIds([node.id]);
                handleRestore();
              } else if (action === 'remove' && mode === 'empty') {
                // Handle single item permanent delete
              }
            }}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Stack direction="row" spacing={2} sx={{ flexGrow: 1, justifyContent: 'flex-end' }}>
          {mode === 'restore' ? (
            <Button
              variant="contained"
              color="primary"
              startIcon={<RestoreIcon />}
              onClick={handleRestore}
              disabled={selectedIds.length === 0 || loading}
            >
              Restore Selected ({selectedIds.length})
            </Button>
          ) : (
            <Button
              variant="contained"
              color="error"
              startIcon={<EmptyTrashIcon />}
              onClick={handleEmptyTrash}
              disabled={data.trashItems?.length === 0 || loading}
            >
              Empty All Trash ({data.trashItems?.length || 0} items)
            </Button>
          )}
          <Button onClick={handleClose} color="inherit">
            Close
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
