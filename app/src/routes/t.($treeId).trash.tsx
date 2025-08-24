import { useLoaderData, useSearchParams, useNavigate } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { useState } from 'react';
import { Box, CircularProgress, AppBar, Toolbar, Typography, Button, Stack } from '@mui/material';
import {
  ArrowBack as BackIcon,
  RestoreFromTrash as RestoreIcon,
  DeleteForever as EmptyTrashIcon,
} from '@mui/icons-material';
import { loadTree, LoadTreeArgs } from '~/loader';
import { WorkerAPIClient } from '@hierarchidb/ui-client';
import { UserLoginButton } from '@hierarchidb/ui-usermenu';
import { TreeConsolePanel } from '@hierarchidb/ui-treeconsole-base';
import type { TreeNode, NodeId } from '@hierarchidb/common-core';

export async function clientLoader(args: LoaderFunctionArgs) {
  const treeData = await loadTree(args.params as LoadTreeArgs);
  // Load trash root node
  if (treeData.tree) {
    const trashRootNode = await treeData.client.getAPI().getNode(treeData.tree.trashRootId);

    // Load trash items (children of trash root)
    const trashItems = await treeData.client.getAPI().getChildren({
      parentId: treeData.tree.trashRootId,
    });

    return {
      ...treeData,
      trashRootNode,
      trashItems,
    };
  }
  return treeData;
}

export default function TrashPage() {
  const data = useLoaderData() as any;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const mode = searchParams.get('mode') || 'restore'; // "restore" or "empty"

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Handle restore selected items
  const handleRestore = async () => {
    if (selectedIds.length === 0) return;

    setLoading(true);
    try {
      const client = await WorkerAPIClient.getSingleton();
      const api = client.getAPI();

      // Use recoverFromTrash API
      const result = await api.recoverFromTrash({
        nodeIds: selectedIds as NodeId[],
      });

      if (result.success) {
        // Refresh the page to show updated trash
        window.location.reload();
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
      const api = client.getAPI();

      // Permanently delete all trash items
      const allTrashIds = data.trashItems?.map((item: TreeNode) => item.id) || [];

      if (allTrashIds.length > 0) {
        const result = await api.removeNodes(allTrashIds);

        if (result.success) {
          // Refresh the page to show empty trash
          window.location.reload();
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
  const treeData = (data.trashItems || []).map((node: TreeNode) => ({
    ...node,
    id: node.id,
    nodeType: node.nodeType,
    children: undefined,
  }));

  // Define columns for trash view
  const columns = [
    {
      id: 'name',
      label: 'Name',
      sortable: true,
      width: 300,
      render: (_: unknown, node: any) => node.name,
    },
    {
      id: 'nodeType',
      label: 'Type',
      sortable: true,
      width: 120,
      render: (_: unknown, node: any) => node.nodeType,
    },
    {
      id: 'deletedAt',
      label: 'Deleted',
      sortable: true,
      width: 160,
      render: (_: unknown, node: any) => {
        return node.updatedAt ? new Date(node.updatedAt).toLocaleDateString() : '';
      },
    },
  ];

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* AppBar with mode-specific actions */}
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          {/* Back button */}
          <Button
            startIcon={<BackIcon />}
            onClick={() => navigate(`/t/${data.tree?.id}`)}
            sx={{ mr: 2 }}
          >
            Back
          </Button>

          {/* Title */}
          <Typography variant="h6" component="div" sx={{ flexGrow: 0, mr: 3 }}>
            {mode === 'restore' ? 'Restore from Trash' : 'Empty Trash'} - {data.tree?.name}
          </Typography>

          {/* Mode-specific actions */}
          <Stack direction="row" spacing={2} sx={{ flexGrow: 1 }}>
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
          </Stack>

          {/* User Login Button */}
          <Box sx={{ ml: 'auto' }}>
            <UserLoginButton />
          </Box>
        </Toolbar>
      </AppBar>

      {/* Trash TreeConsole */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
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
            rootNodeId={data.tree?.trashRootNodeId}
            data={treeData}
            columns={columns}
            breadcrumbItems={[
              {
                id: data.tree?.trashRootNodeId || '',
                name: 'Trash',
                nodeType: 'Trash',
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
            onNodeClick={(node: any) => console.log('Node clicked:', node)}
            onNodeSelect={(nodeId: any, selected: any) => {
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
            onContextMenuAction={(action: any, node: any) => {
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
      </Box>
    </Box>
  );
}
