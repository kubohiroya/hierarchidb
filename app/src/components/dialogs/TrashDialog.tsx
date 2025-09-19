import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData, useNavigate, useParams, useSearchParams } from 'react-router';
import { useState, useRef, useEffect } from 'react';
import { Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, Stack, Typography } from '@mui/material';
import { DeleteForever as EmptyTrashIcon, RestoreFromTrash as RestoreIcon } from '@mui/icons-material';
import type { LoadTreeReturn } from '~/loader.js';
import { loadTree } from '~/loader.js';
import { WorkerAPIClient } from '../../WorkerAPIClient.js';
import { UserLoginButton } from '@hierarchidb/ui-usermenu';
import { CommonDialogTitle } from '@hierarchidb/ui-dialog';
import { TreeConsolePanel, type TreeNodeData, type TreeTableColumn } from '@hierarchidb/ui-treeconsole-base';
import type { NodeId, TreeNode } from '@hierarchidb/common-type';

// This loader will be used by the route that renders the dialog
export async function clientLoader(args: LoaderFunctionArgs) {
  const { treeId } = args.params;
  if (!treeId) {
    throw new Response('Missing treeId parameter.', { status: 400 });
  }
  const treeData = await loadTree({ treeId });
  // Load trash root node
  if (treeData.tree) {
    // Use facade pattern: get QueryAPI first
    const queryAPI = await treeData.client.getQueryAPI();
    const trashRootId = treeData.tree.trashRootId;
    const trashRootNode = await queryAPI.getNode(trashRootId);

    // Load trash items (children of trash root)
    const trashItems = await queryAPI.listChildren(trashRootId);

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
  const data = useLoaderData<TrashDialogData>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { treeId, pageNodeId, targetNodeId, nodeType, action } = useParams();

  const mode = searchParams.get('mode') || 'restore'; // "restore" or "empty"

  const [selectedIds, setSelectedIds] = useState<NodeId[]>([]);
  const [loading, setLoading] = useState(false);
  const [displayMode, setDisplayMode] = useState<'standard' | 'maximized' | 'fullscreen'>('standard');
  const isFullscreen = displayMode === 'fullscreen';
  const isMaximized = displayMode === 'maximized';
  const setIsFullscreen = (v: boolean) => setDisplayMode(v ? 'fullscreen' : (isMaximized ? 'maximized' : 'standard'));
  const setIsMaximized = (v: boolean) => setDisplayMode(v ? 'maximized' : (isFullscreen ? 'fullscreen' : 'standard'));
  const paperRef = useRef<HTMLDivElement | null>(null);

  // No persistence for TrashDialog (not tied to a stable nodeId)
  useEffect(() => { /* noop */ }, []);
  const persistDisplayMode = (_: 'standard' | 'maximized' | 'fullscreen') => { /* noop */ };

  const toggleMaximize = (next?: boolean) => {
    const val = next ?? !isMaximized;
    setIsMaximized(val);
    const m = val ? 'maximized' : 'standard';
    setDisplayMode(m);
    persistDisplayMode(m);
  };
  type FullscreenElement = HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
    msRequestFullscreen?: () => Promise<void> | void;
  };

  type FullscreenDocument = Document & {
    webkitExitFullscreen?: () => Promise<void> | void;
    webkitFullscreenElement?: Element | null;
  };

  const toggleFullscreen = async (next?: boolean) => {
    const val = next ?? !isFullscreen;
    if (val) {
      const el = paperRef.current as FullscreenElement | null;
      const request = el?.requestFullscreen?.bind(el)
        ?? el?.webkitRequestFullscreen?.bind(el)
        ?? el?.msRequestFullscreen?.bind(el);
      if (request) {
        try {
          await Promise.resolve(request());
          setIsFullscreen(true);
          setDisplayMode('fullscreen');
          persistDisplayMode('fullscreen');
          return;
        } catch {
          // fallback
        }
      }
      setIsFullscreen(true);
      setDisplayMode('fullscreen');
      persistDisplayMode('fullscreen');
    } else {
      const fullscreenDoc = document as FullscreenDocument;
      const exit = document.exitFullscreen?.bind(document)
        ?? fullscreenDoc.webkitExitFullscreen?.bind(fullscreenDoc);
      if (exit) {
        await Promise.resolve(exit());
      }
      setIsFullscreen(false);
      const m = isMaximized ? 'maximized' : 'standard';
      setDisplayMode(m);
      persistDisplayMode(m);
    }
  };
  useEffect(() => {
    const fullscreenDoc = document as FullscreenDocument;
    const onFsChange = (_event: Event) => {
      const active = Boolean(document.fullscreenElement ?? fullscreenDoc.webkitFullscreenElement);
      setIsFullscreen(active);
      if (active) {
        setDisplayMode('fullscreen');
        persistDisplayMode('fullscreen');
      } else {
        const m = isMaximized ? 'maximized' : 'standard';
        setDisplayMode(m);
        persistDisplayMode(m);
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, []);
  const handleChangeDisplayMode = (m: 'standard' | 'maximized' | 'fullscreen') => {
    if (m === 'fullscreen') {
      if (!isFullscreen) void toggleFullscreen(true);
      if (isMaximized) toggleMaximize(false);
    } else if (m === 'maximized') {
      if (isFullscreen) void toggleFullscreen(false);
      if (!isMaximized) toggleMaximize(true);
    } else {
      if (isFullscreen) void toggleFullscreen(false);
      if (isMaximized) toggleMaximize(false);
    }
  };

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
        nodeIds: selectedIds,
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
        'Are you sure you want to permanently delete all items in the trash? This action cannot be undone.',
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      const client = await WorkerAPIClient.getSingleton();
      // Use facade pattern: get MutationAPI first
      const mutationAPI = await client.getMutationAPI();

      // Permanently delete all trash items (holders)
      const allTrashIds = (data.trashItems ?? []).map((item) => item.id);

      if (allTrashIds.length > 0) {
        const result = await mutationAPI.removeNodes(allTrashIds);

        if (result.success) {
          // Dispatch removal event so cleanup is centralized
          const targetIds = (data.trashItems ?? []).map((item) => item.holderTargetId ?? item.id);
          window.dispatchEvent(new CustomEvent('hdb-remove', { detail: { treeId, nodeIds: targetIds.map(String) } }));
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
  const treeData: TreeNodeData[] = (data.trashItems ?? []).map((node) => ({
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
      render: (_value: unknown, node: TreeNodeData) => node.name,
    },
    {
      id: 'nodeType',
      label: 'Type',
      sortable: true,
      width: 120,
      render: (_value: unknown, node: TreeNodeData) => node.nodeType,
    },
    {
      id: 'deletedAt',
      label: 'Deleted',
      sortable: true,
      width: 160,
      render: (_value: unknown, node: TreeNodeData) => {
        return node.updatedAt ? new Date(node.updatedAt).toLocaleDateString() : '';
      },
    },
  ];

  const handleClose = () => {
    navigate(-1); // Go back to the previous page
  };

  return (
    <Dialog
      open
      onClose={handleClose}
      maxWidth={isFullscreen ? false : (isMaximized ? false : 'md')}
      fullWidth={!isFullscreen && !isMaximized}
      fullScreen={isFullscreen}
      PaperProps={{
        ref: paperRef,
        sx: isFullscreen
          ? undefined
          : (isMaximized
            ? {
                m: 1,
                width: 'calc(100vw - 16px * 2)',
                height: 'calc(100vh - 16px * 2)',
                display: 'flex',
                flexDirection: 'column',
                '& .MuiDialogContent-root': { flex: 1, minHeight: 200 },
              }
            : undefined),
      }}
    >
      <CommonDialogTitle
        title={`${mode === 'restore' ? 'Restore from Trash' : 'Empty Trash'} - ${data.tree?.name ?? ''}`}
        onClose={handleClose}
        displayMode={displayMode}
        onChangeDisplayMode={handleChangeDisplayMode}
        showDisplayModeControls
      />
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
            pageNodeId={data.tree?.trashRootId}
            data={treeData}
            columns={columns}
            breadcrumbItems={data.tree ? [
              {
                id: data.tree.trashRootId,
                name: 'Trash',
                nodeType: 'trash',
              },
            ] : []}
            loading={false}
            selectedIds={selectedIds.map(String)}
            expandedIds={[]}
            searchTerm=""
            viewMode="list"
            canCreate={false}
            canEdit={false}
            canDelete={mode === 'empty'}
            onNodeClick={(node: TreeNodeData) => console.log('Node clicked:', node)}
            onNodeSelect={(nodeId: string, selected: boolean) => {
              const branded = nodeId as NodeId;
              setSelectedIds((prev) => {
                if (selected) {
                  return prev.includes(branded) ? prev : [...prev, branded];
                }
                return prev.filter((id) => id !== branded);
              });
            }}
            onNodeExpand={() => {
            }}
            availableFilters={[]}
            onSearchChange={() => {
            }}
            onSearchClear={() => {
            }}
            onCreate={() => {
            }}
            onEdit={() => {
            }}
            onDelete={() => {
              if (mode === 'empty') {
                handleEmptyTrash();
              }
            }}
            onRefresh={() => window.location.reload()}
            onExpandAll={() => {
            }}
            onCollapseAll={() => {
            }}
            onSort={() => {
            }}
            onFilterChange={() => {
            }}
            onViewModeChange={() => {
            }}
            onBreadcrumbNavigate={() => {
            }}
            onContextMenuAction={async (action: string, node: TreeNodeData) => {
              if (action === 'restore' && mode === 'restore') {
                setSelectedIds([node.id]);
                await handleRestore();
              } else if (action === 'remove' && mode === 'empty') {
                // Permanently delete a single trash item (holder)
                const ok = confirm('Permanently delete this item? This cannot be undone.');
                if (!ok) return;
                try {
                  const client = await WorkerAPIClient.getSingleton();
                  const mutationAPI = await client.getMutationAPI();
                  const res = await mutationAPI.removeNodes([node.id]);
                  if (res.success) {
                    try {
                      const raw = (data.trashItems ?? []).find((t) => String(t.id) === String(node.id));
                      const targetId = raw?.holderTargetId ?? node.id;
                      window.dispatchEvent(new CustomEvent('hdb-remove', { detail: { treeId, nodeIds: [String(targetId)] } }));
                    } catch (error) {
                      console.warn('[TrashDialog] Failed to dispatch hdb-remove event', error);
                    }
                    window.location.reload();
                  } else {
                    console.error('Permanent delete failed:', res.error);
                  }
                } catch (e) {
                  console.error('Error removing item:', e);
                }
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
          <UserLoginButton />
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
