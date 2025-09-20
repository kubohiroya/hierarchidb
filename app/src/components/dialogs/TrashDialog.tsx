import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData, useNavigate, useParams } from 'react-router';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, Stack } from '@mui/material';
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
  const { treeId, targetNodeId } = args.params;
  if (!treeId) {
    throw new Response('Missing treeId parameter.', { status: 400 });
  }
  const treeData = await loadTree({ treeId });
  // Load trash root node
  if (!treeData.tree) {
    return {
      ...treeData,
      activeTrashNodeId: (targetNodeId as NodeId | undefined) ?? null,
    };
  }

  const queryAPI = await treeData.client.getQueryAPI();
  const fallbackTrashId = treeData.tree.trashRootId as NodeId | undefined;
  const activeTrashNodeId = (targetNodeId as NodeId | undefined) ?? fallbackTrashId;
  if (!activeTrashNodeId) {
    throw new Response('Trash root not found.', { status: 404 });
  }

  const trashRootNode = await queryAPI.getNode(activeTrashNodeId);

  const trashItems = await queryAPI.listChildren(activeTrashNodeId);

  const isRootTrash = Boolean(fallbackTrashId && activeTrashNodeId === fallbackTrashId);
  let trashDisplayItems = trashItems;
  const holderLookup: Record<string, { holderId: NodeId; holderName?: string }> = {};

  if (isRootTrash && trashItems.length > 0) {
    const batches = await Promise.all(
      trashItems.map(async (holder) => {
        const childNodes = await queryAPI.listChildren(holder.id as NodeId);
        return childNodes.map((child) => {
          holderLookup[String(child.id)] = { holderId: holder.id as NodeId, holderName: holder.name };
          return {
            ...child,
            parentId: activeTrashNodeId,
            depth: 1,
          } as TreeNode;
        });
      }),
    );
    trashDisplayItems = batches.flat();
  }

  return {
    ...treeData,
    trashRootNode,
    trashItems,
    trashDisplayItems,
    holderLookup,
    activeTrashNodeId,
  };
}

type TrashDialogData = LoadTreeReturn & {
  trashRootNode?: TreeNode;
  trashItems?: TreeNode[];
  trashDisplayItems?: TreeNode[];
  holderLookup?: Record<string, { holderId: NodeId; holderName?: string }>;
  activeTrashNodeId: NodeId | null;
};

export default function TrashDialog() {
  const data = useLoaderData<TrashDialogData>();
  const navigate = useNavigate();
  const { treeId, targetNodeId: trashNodeIdParam, action } = useParams();

  const mode: 'restore' | 'empty' = action === 'empty' ? 'empty' : 'restore';
  const activeTrashNodeId = data.activeTrashNodeId ?? (trashNodeIdParam as NodeId | null) ?? null;
  const effectiveTrashNodeId = activeTrashNodeId ?? (data.tree?.trashRootId as NodeId | undefined) ?? null;

  const [selectedIds, setSelectedIds] = useState<NodeId[]>([]);
  const [loading, setLoading] = useState(false);
  const [displayMode, setDisplayMode] = useState<'standard' | 'maximized' | 'fullscreen'>('standard');
  const isFullscreen = displayMode === 'fullscreen';
  const isMaximized = displayMode === 'maximized';
  const setIsFullscreen = useCallback((v: boolean) => setDisplayMode(v ? 'fullscreen' : (isMaximized ? 'maximized' : 'standard')), [isMaximized]);
  const setIsMaximized = useCallback((v: boolean) => setDisplayMode(v ? 'maximized' : (isFullscreen ? 'fullscreen' : 'standard')), [isFullscreen]);
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
  }, [isMaximized, setIsFullscreen]);
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
      const client = WorkerAPIClient.getSingleton();
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
  const displayNodes = data.trashDisplayItems ?? data.trashItems ?? [];

  const treeData: TreeNodeData[] = displayNodes.map((node) => ({
    ...node,
    id: node.id,
    nodeType: node.nodeType,
    depth: 1,
    children: undefined,
  }));

  const dialogContextName = data.trashRootNode?.name ?? (effectiveTrashNodeId ? String(effectiveTrashNodeId) : data.tree?.name ?? '');
  const breadcrumbItems = data.trashRootNode
    ? [{ id: data.trashRootNode.id, name: data.trashRootNode.name ?? 'Trash', nodeType: data.trashRootNode.nodeType ?? 'trash' }]
    : [];

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
        title={`${mode === 'restore' ? 'Restore from Trash' : 'Empty Trash'}${dialogContextName ? ` - ${dialogContextName}` : ''}`}
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
            title={`Trash - ${dialogContextName}`}
            pageNodeId={effectiveTrashNodeId ?? undefined}
            data={treeData}
            columns={columns}
            breadcrumbItems={breadcrumbItems}
            loading={false}
            selectedIds={selectedIds.map(String)}
            expandedIds={[]}
            searchTerm=""
            viewMode="list"
            canCreate={false}
            canEdit={false}
            canDelete={mode === 'empty'}
            onNodeClick={(node: TreeNodeData) => console.log('Node clicked:', node)}
            onNodeSelect={(nodeIds: string[], selected: boolean) => {
              const brandedIds = nodeIds.map((id) => id as NodeId);
              setSelectedIds((prev) => {
                const next = new Set<NodeId>(prev);
                if (selected) {
                  brandedIds.forEach((id) => next.add(id));
                } else {
                  brandedIds.forEach((id) => next.delete(id));
                }
                return Array.from(next);
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
                  const client = WorkerAPIClient.getSingleton();
                  const mutationAPI = await client.getMutationAPI();
                  const holderId = data.holderLookup?.[String(node.id)]?.holderId ?? (node.id as NodeId);
                  const res = await mutationAPI.removeNodes([holderId]);
                  if (res.success) {
                    try {
                      const raw = (data.trashItems ?? []).find((t) => String(t.id) === String(holderId));
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
