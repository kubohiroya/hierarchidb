/**
 * useTreeConsoleIntegration Hook
 *
 * Manages TreeConsole state and interactions with WorkerAPIClient.
 * Avoids Orchestrated APIs and uses direct Worker API calls.
 */

import { useEffect, useMemo, useState } from 'react';
import { showCommandError } from '~/shared/command-errors';
import type { NodeId, NodeType, TreeId, TreeNode } from '@hierarchidb/common-type';
import type { Remote } from 'comlink';
import type { WorkerAPI } from '@hierarchidb/common-api';
import type { TreeNodeData } from '@hierarchidb/ui-treeconsole-base';
import type { BreadcrumbNode } from '@hierarchidb/ui-treeconsole-breadcrumb';
import { useImportExport } from '@hierarchidb/ui-import-export';
import { convertTreeNodeToTreeNodeData, createDefaultColumns } from '../utils/treeNodeConverter';

export interface UseTreeConsoleIntegrationParams {
  client: Remote<WorkerAPI>;
  treeId?: string;
  pageNodeId?: NodeId;
  pageTreeNode?: TreeNode;
  // Optional router navigation bridge to keep URL in sync
  pushPath?: (to: string | number) => void;
  // Current location.search for initial sync and change detection
  locationSearch?: string;
}

export interface TreeConsoleState {
  loading: boolean;
  error: string | null;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  filterBy?: string;
  availableFilters: string[];
  canGoBack: boolean;
  canGoForward: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canPaste: boolean;
}

type ViewMode = 'list' | 'grid';
type ContextAction =
  | 'open'
  | 'openFolder'
  | 'preview'
  | 'edit'
  | 'duplicate'
  | 'remove'
  | 'checkReference'
  | `create:${string}`;

export interface TreeConsoleActions {
  handleNodeClick: (node: TreeNodeData) => void;
  handleNodeSelect: (nodeId: string, selected: boolean) => void;
  handleNodeExpand: (nodeId: string, expanded: boolean) => void;
  handleSearchChange: (term: string) => void;
  handleSearchClear: () => void;
  handleCreate: () => void;
  handleEdit: () => void;
  handleDelete: () => void;
  handleRefresh: () => void;
  handleExpandAll: () => void;
  handleCollapseAll: () => void;
  handleSort: (columnId: string) => void;
  handleFilterChange: (filter: string) => void;
  handleViewModeChange: (mode: ViewMode) => void;
  handleBreadcrumbNavigate: (nodeId: string, node?: BreadcrumbNode) => void;
  handleNavigateBack: () => void;
  handleNavigateForward: () => void;
  // Keep parameter as string to remain compatible with UI prop type
  handleContextMenuAction: (action: string, node: TreeNodeData) => void;
  handleUndo: () => void;
  handleRedo: () => void;
  handleCopy: () => void;
  handleCut: () => void;
  handlePaste: () => void;
  handleDuplicate: () => void;
  handleImport: () => void;
  handleExport: () => void;
  handleMoveNodes: (nodeIds: string[], targetParentId: string) => Promise<void>;
}

export function useTreeConsoleIntegration({
                                            client,
                                            treeId,
                                            pageNodeId,
                                            pageTreeNode,
                                            pushPath,
                                            locationSearch,
                                          }: UseTreeConsoleIntegrationParams) {
  // TreeTypes data state
  const [treeData, setTreeData] = useState<TreeNodeData[]>([]);
  const [rawNodes, setRawNodes] = useState<TreeNode[]>([]);
  const [selectedIds, setSelectedIds] = useState<NodeId[]>([]);
  const [expandedIds, setExpandedIds] = useState<NodeId[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // TreeConsole internal state
  const [state, setState] = useState<TreeConsoleState>({
    loading: false,
    error: null,
    sortBy: 'name',
    sortDirection: 'asc',
    filterBy: '',
    availableFilters: ['folder', 'basemap', '_shapes_buggy'],
    canGoBack: false,
    canGoForward: false,
    canUndo: false,
    canRedo: false,
    canPaste: false,
  });

  // Memoized columns configuration
  const columns = useMemo(() => createDefaultColumns(), []);

  // Memoized breadcrumb items
  const breadcrumbItems = useMemo<BreadcrumbNode[]>(() => {
    if (!pageTreeNode) return [];

    return [
      {
        id: pageTreeNode.id,
        name: pageTreeNode.name,
        nodeType: pageTreeNode.nodeType,
      },
    ];
  }, [pageTreeNode]);

  // Import/Export functionality
  const importExport = useImportExport(client, !!client);

  // Helper: apply sort/filter/search to raw nodes
  const applySortFilterSearch = (nodes: TreeNode[]): TreeNodeData[] => {
    const sortBy = state.sortBy || 'name';
    const sortDir = state.sortDirection || 'asc';
    const filterBy = state.filterBy || '';
    const term = searchTerm?.trim();
    let arr = [...nodes];
    if (filterBy) arr = arr.filter((n) => n.nodeType === (filterBy as unknown as NodeType));
    if (term) {
      const t = term.toLowerCase();
      arr = arr.filter((n) => (n.name || '').toLowerCase().includes(t));
    }
    arr.sort((a, b) => {
      const va = (a as any)[sortBy] ?? '';
      const vb = (b as any)[sortBy] ?? '';
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: 'base' });
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr.map(convertTreeNodeToTreeNodeData);
  };

  // Helper: load children of a node and refresh view
  const loadChildrenOf = async (parentId: NodeId) => {
    if (!client) return;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const queryAPI = await client.getQueryAPI();
      const children = await queryAPI.listChildren(parentId);
      const shouldFlattenTrash = pageTreeNode?.nodeType === 'trash' && parentId === (pageNodeId as NodeId);
      let displayNodes: TreeNode[] = children;
      if (shouldFlattenTrash) {
        const batches = await Promise.all(children.map((h) => queryAPI.listChildren(h.id as NodeId)));
        displayNodes = batches.flat();
      }
      setRawNodes(displayNodes);
      setTreeData(applySortFilterSearch(displayNodes));
    } catch (err) {
      console.error('Failed to load children:', err);
      setState((prev) => ({ ...prev, error: err instanceof Error ? err.message : String(err) }));
    } finally {
      setState((prev) => ({ ...prev, loading: false }));
    }
  };

  // Actions implementation
  const actions = useMemo<TreeConsoleActions>(
    () => ({
      handleNodeClick: (node: TreeNodeData) => {
        const targetId = node.id as NodeId;
        try {
          if (pushPath && treeId) {
            const isRootLike = pageTreeNode && pageTreeNode.id === targetId;
            const qs = searchTerm ? `?q=${encodeURIComponent(searchTerm)}` : '';
            pushPath(isRootLike ? `/t/${treeId}${qs}` : `/t/${treeId}/${targetId}${qs}`);
          }
        } catch {}
      },

      handleNodeSelect: (nodeId: string, selected: boolean) => {
        setSelectedIds((prev) => {
          if (selected) {
            return [...new Set([...prev, nodeId as NodeId])];
          } else {
            return prev.filter((id) => id !== nodeId);
          }
        });
      },

      handleNodeExpand: async (nodeId: string, expanded: boolean) => {
        setExpandedIds((prev) => {
          if (expanded) {
            return [...new Set([...prev, nodeId as NodeId])];
          } else {
            return prev.filter((id) => id !== nodeId);
          }
        });

        // Load children when expanding (if not already loaded)
        if (expanded && client) {
          try {
            const queryAPI = await client.getQueryAPI();
            const children = await queryAPI.listChildren(nodeId as NodeId);

            // Update tree data with children
            setTreeData((prev) => {
              const updated = [...prev];
              const parentIndex = updated.findIndex((node) => node.id === nodeId);
              if (parentIndex >= 0) {
                const currentNode = updated[parentIndex];
                if (currentNode?.id) {
                  updated[parentIndex] = {
                    ...currentNode,
                    children: children.map((child) => convertTreeNodeToTreeNodeData(child)),
                  };
                }
              }
              return updated;
            });
          } catch (err) {
            console.error('Failed to load children for node:', nodeId, err);
          }
        }
      },

      handleSearchChange: async (term: string) => {
        setSearchTerm(term);
        if (!client) return;
        const root = pageNodeId as NodeId;
        if (!term.trim()) {
          loadChildrenOf(root);
          return;
        }
        try {
          const queryAPI = await client.getQueryAPI();
          const results = await queryAPI.searchNodes({ rootNodeId: root, query: term, mode: 'partial', maxResults: 200 });
          setRawNodes(results);
          setTreeData(applySortFilterSearch(results));
        } catch (e) {
          console.error('Search failed:', e);
        }
      },

      handleSearchClear: () => {
        setSearchTerm('');
      },

      handleCreate: async () => {
        if (!client) return;
        const name = prompt('Enter new item name (default: New Item)')?.trim() || 'New Item';
        const parentId = pageNodeId as NodeId;
        const nodeType: NodeType = 'folder' as NodeType;
        try {
          const mutationAPI = await client.getMutationAPI();
          const res = await mutationAPI.createNode({ nodeType, treeId: (treeId as TreeId) || ('default-tree' as TreeId), parentId, name });
          if (!res.success) {
            showCommandError('INVALID_OPERATION', res.error || 'Create failed');
            return;
          }
          await loadChildrenOf(parentId);
        } catch (e) {
          console.error('Create failed:', e);
          showCommandError('UNKNOWN_ERROR');
        }
      },

      handleEdit: async () => {
        if (!client || selectedIds.length !== 1) return;
        const nodeId = selectedIds[0] as NodeId;
        const newName = prompt('Enter new name')?.trim();
        if (!newName) return;
        try {
          const mutationAPI = await client.getMutationAPI();
          const res = await mutationAPI.updateNode({ nodeId, name: newName });
          if (!res.success) {
            showCommandError('INVALID_OPERATION', res.error || 'Update failed');
            return;
          }
          const parent = pageNodeId as NodeId;
          await loadChildrenOf(parent);
        } catch (e) {
          console.error('Update failed:', e);
          showCommandError('UNKNOWN_ERROR');
        }
      },

      handleDelete: async () => {
        if (!client || selectedIds.length === 0) return;
        const ok = confirm(`Move ${selectedIds.length} item(s) to trash?`);
        if (!ok) return;
        try {
          const mutationAPI = await client.getMutationAPI();
          const res = await mutationAPI.moveNodesToTrash(selectedIds as NodeId[]);
          if (!res.success) {
            showCommandError('INVALID_OPERATION', res.error || 'Remove failed');
            return;
          }
          const parent = pageNodeId as NodeId;
          await loadChildrenOf(parent);
          setSelectedIds([]);
        } catch (e) {
          console.error('Remove failed:', e);
          showCommandError('UNKNOWN_ERROR');
        }
      },

      handleRefresh: async () => {
        const root = pageNodeId as NodeId;
        if (!client || !root) return;
        await loadChildrenOf(root);
      },

      handleExpandAll: () => {
        const allIds = treeData.map((node) => node.id);
        setExpandedIds(allIds);
      },

      handleCollapseAll: () => {
        setExpandedIds([]);
      },

      handleSort: (columnId: string) => {
        setState((prev) => ({
          ...prev,
          sortBy: columnId,
          sortDirection: prev.sortBy === columnId && prev.sortDirection === 'asc' ? 'desc' : 'asc',
        }));
        setTreeData(applySortFilterSearch(rawNodes));
      },

      handleFilterChange: (filter: string) => {
        setState((prev) => ({ ...prev, filterBy: filter }));
        setTreeData(applySortFilterSearch(rawNodes));
      },

      handleViewModeChange: (mode: ViewMode) => {
        setViewMode(mode);
      },

      handleBreadcrumbNavigate: (nodeId: string) => {
        const target = nodeId as NodeId;
        if (!target) return;
        try {
          if (pushPath && treeId) {
            // If navigating to the tree root, prefer the short form `/t/:treeId`
            const isRootLike = pageTreeNode && pageTreeNode.id === target;
            pushPath(isRootLike ? `/t/${treeId}` : `/t/${treeId}/${target}`);
          }
        } catch {}
      },

      handleNavigateBack: () => {
        try {
          if (pushPath) pushPath(-1);
        } catch {}
      },

      handleNavigateForward: () => {
        try {
          if (pushPath) pushPath(1);
        } catch {}
      },

      handleContextMenuAction: async (action: string, node: TreeNodeData) => {
        const actionStr = action as ContextAction;
        console.log('Context menu action:', actionStr, 'for node:', node);

        // Handle creation actions from SpeedDial
        if (actionStr.startsWith('create:')) {
          const nodeType = actionStr.replace('create:', '') as string as NodeType;
          console.log('Creating node of type:', nodeType);

          try {
            // Use the worker API to create a new node
            if (client && pageNodeId) {
              // Generate a user-friendly name based on the node type
              const displayName = nodeType.charAt(0).toUpperCase() + nodeType.slice(1);

              const mutationAPI = await client.getMutationAPI();
              const result = await mutationAPI.createNode({
                nodeType,
                treeId: (treeId as TreeId) || ('default-tree' as TreeId),
                parentId: pageNodeId as NodeId,
                name: `New ${displayName}`,
                description: '',
              });

              if (result.success) {
                console.log('Node created successfully:', result.nodeId);
                // Refresh the tree data
                if (client && pageNodeId) {
                  try {
                    const queryAPI = await client.getQueryAPI();
                    const children = await queryAPI.listChildren(pageNodeId as NodeId);
                    const treeNodeData = children.map(convertTreeNodeToTreeNodeData);
                    setTreeData(treeNodeData);
                  } catch (refreshError) {
                    console.error('Failed to refresh after creation:', refreshError);
                  }
                }
              } else {
                console.error('Failed to create node:', result.error);
                // Temporary user feedback until NotificationSystem is mounted
                showCommandError('INVALID_OPERATION', result.error);
              }
            }
          } catch (error) {
            console.error('Error creating node:', error);
            showCommandError('UNKNOWN_ERROR');
          }
          return;
        }

        // Handle import/export through context menu
        if ((action as string) === 'export' && node?.id) {
          // Export is handled via actions.handleExport; in this minimal phase, omit here.
          return;
        }
        // TODO: Implement other context menu actions
        // Avoiding Orchestrated APIs as requested
      },

      handleUndo: async () => {
        if (!client) return;
        try {
          const cp = await (client as any).getCommandProcessor();
          await cp.undo();
          const root = pageNodeId as NodeId;
          await loadChildrenOf(root);
        } catch (e) {
          console.error('Undo failed:', e);
        }
      },

      handleRedo: async () => {
        if (!client) return;
        try {
          const cp = await (client as any).getCommandProcessor();
          await cp.redo();
          const root = pageNodeId as NodeId;
          await loadChildrenOf(root);
        } catch (e) {
          console.error('Redo failed:', e);
        }
      },

      handleCopy: () => {
        (globalThis as any).__HDB_CLIPBOARD__ = { nodeIds: [...selectedIds] };
        setState((prev) => ({ ...prev, canPaste: selectedIds.length > 0 }));
      },

      handleCut: () => {
        (globalThis as any).__HDB_CLIPBOARD__ = { nodeIds: [...selectedIds], cut: true };
        setState((prev) => ({ ...prev, canPaste: selectedIds.length > 0 }));
      },

      handlePaste: async () => {
        if (!client) return;
        const clip = (globalThis as any).__HDB_CLIPBOARD__ as { nodeIds: NodeId[] } | undefined;
        const ids = clip?.nodeIds || [];
        const isCut = Boolean(clip && (clip as any).cut);
        if (ids.length === 0) return;
        try {
          const mutationAPI = await client.getMutationAPI();
          const toParentId = pageNodeId as NodeId;
          const res = isCut
            ? await mutationAPI.moveNodes(ids as NodeId[], toParentId)
            : await mutationAPI.duplicateNodes({ nodeIds: ids, toParentId });
          if (!('success' in res) || !res.success) {
            showCommandError('INVALID_OPERATION', (res as any)?.error || 'Paste failed');
            return;
          }
          await loadChildrenOf(toParentId);
          // Clear cut clipboard after move
          if (isCut) {
            (globalThis as any).__HDB_CLIPBOARD__ = undefined;
          }
        } catch (e) {
          console.error('Paste failed:', e);
        }
      },

      handleDuplicate: async () => {
        if (!client || selectedIds.length === 0) return;
        try {
          const mutationAPI = await client.getMutationAPI();
          const toParentId = pageNodeId as NodeId;
          const res = await mutationAPI.duplicateNodes({ nodeIds: selectedIds as NodeId[], toParentId });
          if (!res.success) {
            showCommandError('INVALID_OPERATION', res.error || 'Duplicate failed');
            return;
          }
          await loadChildrenOf(toParentId);
        } catch (e) {
          console.error('Duplicate failed:', e);
        }
      },

      handleImport: async () => {
        console.log('Import action triggered');
        // Open file picker
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,.csv';
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file && pageNodeId) {
            const detected = importExport.detectFileFormat(file) ?? null;
            const isSupported = (v: string | null): v is 'json' | 'csv' => v === 'json' || v === 'csv';
            const format: 'json' | 'csv' = isSupported(detected) ? detected : 'json';
            try {
              const result = await importExport.importFile({
                file,
                targetNodeId: pageNodeId,
                format,
                onProgress: (progress) => {
                  console.log('Import progress:', progress);
                },
              });
              console.log('Import result:', result);
              // Refresh tree data after import
              await actions.handleRefresh();
            } catch (error) {
              console.error('Import failed:', error);
              setState((prev) => ({
                ...prev,
                error: `Import failed: ${error}`,
              }));
            }
          }
        };
        input.click();
      },

      handleExport: async () => {
        console.log('Export action triggered');
        if (selectedIds.length === 0) {
          console.warn('No nodes selected for export');
          return;
        }

        try {
          const blob = await importExport.exportNodes({
            nodeIds: selectedIds,
            format: 'json',
            includeChildren: true,
            onProgress: (progress) => {
              console.log('Export progress:', progress);
            },
          });

          // Create download link
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `export-${Date.now()}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          console.log('Export completed');
        } catch (error) {
          console.error('Export failed:', error);
          setState((prev) => ({
            ...prev,
            error: `Export failed: ${error}`,
          }));
        }
      },
      handleMoveNodes: async (nodeIds: string[], targetParentId: string) => {
        if (!client || nodeIds.length === 0 || !targetParentId) return;
        try {
          const mutationAPI = await client.getMutationAPI();
          const res = await mutationAPI.moveNodes(nodeIds as NodeId[], targetParentId as NodeId);
          if (!res.success) {
            showCommandError('INVALID_OPERATION', res.error || 'Move failed');
            return;
          }
          await loadChildrenOf(targetParentId as NodeId);
        } catch (e) {
          console.error('Move failed:', e);
          showCommandError('UNKNOWN_ERROR');
        }
      },
    }),
    [client, treeId, pageNodeId, selectedIds, treeData, importExport],
  );

  // Load tree data when client is ready
  useEffect(() => {
    if (!client || !pageNodeId) {
      console.log(
        '[useTreeConsoleIntegration] Skipping load - client:',
        !!client,
        'pageNodeId:',
        pageNodeId,
      );
      return;
    }

    const loadTreeData = async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        console.log('[useTreeConsoleIntegration] Loading tree data for node:', pageNodeId);
        // Initialize from query params if provided
        try {
          if (locationSearch) {
            const params = new URLSearchParams(locationSearch);
            const q = params.get('q') || '';
            if (q) setSearchTerm(q);
            const root = pageNodeId as NodeId;
            if (q) {
              const queryAPI = await client.getQueryAPI();
              const results = await queryAPI.searchNodes({ rootNodeId: root, query: q, mode: 'partial', maxResults: 200 });
              setRawNodes(results);
              setTreeData(applySortFilterSearch(results));
              setState((prev) => ({ ...prev, loading: false }));
              return;
            }
          }
        } catch {}

        const rootToLoad = pageNodeId as NodeId;
        await loadChildrenOf(rootToLoad);
        setState((prev) => ({ ...prev, loading: false }));
      } catch (err) {
        console.error('[useTreeConsoleIntegration] Failed to load tree data:', err);
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    };

    loadTreeData();
  }, [client, pageNodeId, locationSearch]);

  // Sync search (q) only to URL query parameters
  useEffect(() => {
    if (!pushPath || !treeId) return;
    const root = pageNodeId as NodeId;
    if (!root) return;
    const params = new URLSearchParams();
    if (searchTerm?.trim()) params.set('q', searchTerm.trim());
    const qs = params.toString();
    // Do not append the rootId segment when the current URL is already the short form `/t/:treeId`
    let pathBase = `/t/${treeId}`;
    try {
      const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
      let isDeep = pathname.startsWith(`${pathBase}/`);
      // If the current page node is the tree root, prefer the short form even when URL was deep
      if (pageTreeNode && pageTreeNode.id === root) {
        isDeep = false;
      }
      const path = `${pathBase}${isDeep ? `/${root}` : ''}${qs ? `?${qs}` : ''}`;
      pushPath(path);
    } catch {
      // Fallback: never include the rootId segment
      const path = `${pathBase}${qs ? `?${qs}` : ''}`;
      try { pushPath(path); } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, pageNodeId]);

  // Permission checks (simplified for now, avoiding Orchestrated APIs)
  const canCreate = true;
  const canEdit = selectedIds.length === 1;
  const canDelete = selectedIds.length > 0;

  return {
    // Worker client (removed to avoid TS4094 error)
    loading: state.loading,
    error: state.error,

    // TreeTypes data
    treeData,
    columns,
    breadcrumbItems,

    // UI state
    selectedIds,
    expandedIds,
    searchTerm,
    viewMode,

    // Permissions
    canCreate,
    canEdit,
    canDelete,

    // Actions
    actions,

    // Internal state
    state,
  };
}
