/**
 * useTreeConsoleIntegration Hook
 *
 * Manages TreeConsole state and interactions with WorkerAPIClient.
 * Avoids Orchestrated APIs and uses direct Worker API calls.
 */

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { showCommandError } from '~/shared/command-errors';
import type { NodeId, NodeType, TreeId, TreeNode, SubscriptionId } from '@hierarchidb/common-type';
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
  handleSearchCommit: () => void;
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

  // Helper: sync canUndo/canRedo from CommandProcessor
  const refreshUndoRedo = useCallback(async () => {
    try {
      const cp = await (client as any)?.getCommandProcessor?.();
      if (!cp) return;
      const canUndo = cp?.canUndo?.() ?? false;
      const canRedo = cp?.canRedo?.() ?? false;
      setState((prev) => (prev.canUndo === canUndo && prev.canRedo === canRedo ? prev : { ...prev, canUndo, canRedo }));
    } catch {}
  }, [client]);

  // Global event bus: listen to command-complete events to refresh canUndo/canRedo
  useEffect(() => {
    const handler = () => { void refreshUndoRedo(); };
    window.addEventListener('hdb-cmd', handler as any);
    return () => window.removeEventListener('hdb-cmd', handler as any);
  }, [refreshUndoRedo]);

  const fireCmdEvent = () => {
    try { window.dispatchEvent(new CustomEvent('hdb-cmd')); } catch {}
  };

  // Cleanup helper: remove persisted UI state for given nodes
  const cleanupPersistedLayouts = (ids: NodeId[]) => {
    try {
      const keysToRemove = new Set<string>();
      for (const id of ids) {
        // Current key scheme (per-node persistenceKey used by TreeTableCore)
        keysToRemove.add(`TreeTableCore.columnWidths:tree:${id}`);
        // Backward-compatible key patterns that may have been used
        keysToRemove.add(`TreeTableCore.columnWidths:${id}`);
      }
      keysToRemove.forEach((k) => {
        try { localStorage.removeItem(k); } catch {}
      });
    } catch {}
  };

  // Helper: apply sort/filter/search to raw nodes
  const applySortFilterSearch = (nodes: TreeNode[], overrideTerm?: string): TreeNodeData[] => {
    const sortBy = state.sortBy || 'name';
    const sortDir = state.sortDirection || 'asc';
    const filterBy = state.filterBy || '';
    const term = (overrideTerm ?? searchTerm)?.trim();
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
  const loadChildrenOf = async (parentId: NodeId, optTerm?: string) => {
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
      setTreeData(applySortFilterSearch(displayNodes, optTerm));
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
          await loadChildrenOf(root, '');
          return;
        }
        try {
          const queryAPI = await client.getQueryAPI();
          const results = await queryAPI.searchNodes({ rootNodeId: root, query: term, mode: 'partial', maxResults: 200 });
          setRawNodes(results);
          setTreeData(applySortFilterSearch(results, term));
        } catch (e) {
          console.error('Search failed:', e);
        }
      },

      handleSearchClear: () => {
        setSearchTerm('');
        // When cleared, immediately show unfiltered children
        const root = pageNodeId as NodeId;
        void loadChildrenOf(root, '');
        // Reflect removal in URL: update only the search part (avoid duplicating basename)
        try {
          if (pushPath) {
            const sp = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
            sp.delete('q');
            const nextSearch = sp.toString();
            pushPath(nextSearch ? `?${nextSearch}` : '?');
          }
        } catch {}
      },

      handleSearchCommit: () => {
        if (!pushPath) return;
        try {
          const term = (searchTerm || '').trim();
          // Update only the search part to avoid basename duplication
          const next = term ? `?q=${encodeURIComponent(term)}` : '?';
          const currentSearch = typeof window !== 'undefined' ? window.location.search : '';
          if (currentSearch !== (next === '?' ? '' : next)) pushPath(next);
        } catch {}
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
          fireCmdEvent();
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
          fireCmdEvent();
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
          fireCmdEvent();

          // Note: Do not clear persisted layouts on move-to-trash.
          // Cleanup is performed only on permanent deletion from Trash dialog.
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
        const allIds = treeData.map((node) => node.id as NodeId);
        setExpandedIds(allIds as unknown as NodeId[]);
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

        // Handle creation actions from SpeedDial / context menus
        if (actionStr.startsWith('create:')) {
          const nodeType = actionStr.replace('create:', '') as string as NodeType;
          console.log('Creating node of type:', nodeType);

          try {
            if (client && pageNodeId && treeId) {
              // 1) Create a draft working copy holder under the current page node (WorkingCopy pattern)
              const workingCopyAPI = await (client as any).getWorkingCopyAPI();
              const displayName = nodeType.charAt(0).toUpperCase() + nodeType.slice(1);
              // Use dedicated WorkingCopy root holder per design: parentId in holderName only;
              // holder itself is created under `${treeId}:workingCopy` by the service.
              const draft = await workingCopyAPI.createDraftWorkingCopy(
                nodeType,
                pageNodeId as NodeId,
                { name: `New ${displayName}` },
              );
              const wcId: string = (draft?.id || draft?.wcNodeId || draft) as string;

              if (!wcId) {
                showCommandError('INVALID_OPERATION', 'Failed to create draft working copy');
                return;
              }

              // 2) Route to plugin dialog in create mode
              if (pushPath) {
                const nodeTypePath = String(nodeType);
                pushPath(`/t/${treeId}/${pageNodeId}/${wcId}/${nodeTypePath}/create`);
              }
            } else {
              showCommandError('INVALID_OPERATION', 'Worker client or page context unavailable');
            }
          } catch (error) {
            console.error('Error creating node:', error);
            showCommandError('UNKNOWN_ERROR');
          }
          return;
        }

        // Inline rename
        if (action === 'rename-inline' && node?.id && typeof node.name === 'string') {
          try {
            const mutationAPI = await client.getMutationAPI();
            const next = node.name.trim();
            const current = rawNodes.find((n) => n.id === node.id)?.name ?? '';
            if (next === current) return; // 未変更ならスキップ
            if (!next) { showCommandError('VALIDATION_ERROR', 'Name is required'); return; }
            if (next.length > 255) { showCommandError('VALIDATION_ERROR', 'Name is too long (max 255)'); return; }
            if (!/^[^<>:"/\\|?*]+$/.test(next)) { showCommandError('VALIDATION_ERROR', 'Invalid characters in name'); return; }
            const res = await mutationAPI.updateNode({ nodeId: node.id as NodeId, name: next });
            if (!res.success) {
              showCommandError('INVALID_OPERATION', res.error || 'Update failed');
              return;
            }
            const parent = pageNodeId as NodeId;
            await loadChildrenOf(parent);
            await refreshUndoRedo();
            fireCmdEvent();
          } catch (e) {
            console.error('Inline rename failed:', e);
            showCommandError('UNKNOWN_ERROR');
          }
          return;
        }

        if (action === 'update-desc-inline' && node?.id && typeof (node as any).description === 'string') {
          try {
            const mutationAPI = await client.getMutationAPI();
            const next = String((node as any).description ?? '').trim();
            const current = rawNodes.find((n) => n.id === node.id)?.description ?? '';
            if (next === current) return; // 未変更ならスキップ
            if (next.length > 1000) { showCommandError('VALIDATION_ERROR', 'Description is too long (max 1000)'); return; }
            const res = await mutationAPI.updateNode({ nodeId: node.id as NodeId, description: next });
            if (!res.success) {
              showCommandError('INVALID_OPERATION', res.error || 'Update failed');
              return;
            }
            const parent = pageNodeId as NodeId;
            await loadChildrenOf(parent);
            await refreshUndoRedo();
            fireCmdEvent();
          } catch (e) {
            console.error('Inline description update failed:', e);
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
          await refreshUndoRedo();
          fireCmdEvent();
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
          await refreshUndoRedo();
          fireCmdEvent();
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
            ? await mutationAPI.moveNodes({ nodeIds: ids as NodeId[], toParentId })
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
          await refreshUndoRedo();
          fireCmdEvent();
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
          await refreshUndoRedo();
          fireCmdEvent();
          try {
            const cp = await (client as any).getCommandProcessor();
            setState((prev) => ({ ...prev, canUndo: cp?.canUndo?.() ?? false, canRedo: cp?.canRedo?.() ?? false }));
          } catch {}
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
              await refreshUndoRedo();
              fireCmdEvent();
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
          const res = await mutationAPI.moveNodes({ nodeIds: nodeIds as NodeId[], toParentId: targetParentId as NodeId });
          if (!res.success) {
            showCommandError('INVALID_OPERATION', res.error || 'Move failed');
            return;
          }
          await loadChildrenOf(targetParentId as NodeId);
          await refreshUndoRedo();
          fireCmdEvent();
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
              setTreeData(applySortFilterSearch(results, q));
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

  // Live subscription: when pageNodeId (root) changes, unsubscribe from old and subscribe to new
  const activeSubRef = useRef<SubscriptionId | null>(null);
  const refreshTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let disposed = false;
    const setup = async () => {
      if (!client || !pageNodeId) return;
      try {
        const subscriptionAPI = await client.getSubscriptionAPI();
        // Always unsubscribe previous subscription for prior page
        if (activeSubRef.current) {
          try { await subscriptionAPI.unsubscribe(activeSubRef.current); } catch {}
          activeSubRef.current = null;
        }

        const currentRoot = pageNodeId as NodeId;
        // Debounced refresh to coalesce bursts
        const requestRefresh = () => {
          if (disposed) return;
          if (refreshTimerRef.current !== null) return;
          refreshTimerRef.current = window.setTimeout(() => {
            refreshTimerRef.current = null;
            void loadChildrenOf(currentRoot);
          }, 60);
        };

        // Subscribe to the entire subtree under current page root
        const subId = await subscriptionAPI.subscribeSubtree(
          currentRoot,
          () => {
            requestRefresh();
          },
        );
        if (disposed) {
          try { await subscriptionAPI.unsubscribe(subId); } catch {}
          return;
        }
        activeSubRef.current = subId;
      } catch (err) {
        console.warn('[useTreeConsoleIntegration] Subscription setup failed:', err);
      }
    };

    void setup();
    return () => {
      disposed = true;
      // Clear pending refresh
      if (refreshTimerRef.current !== null) {
        try { window.clearTimeout(refreshTimerRef.current); } catch {}
        refreshTimerRef.current = null;
      }
      // Unsubscribe on cleanup
      const doUnsub = async () => {
        try {
          if (client && activeSubRef.current) {
            const subscriptionAPI = await client.getSubscriptionAPI();
            await subscriptionAPI.unsubscribe(activeSubRef.current);
          }
        } catch {}
        activeSubRef.current = null;
      };
      void doUnsub();
    };
  }, [client, pageNodeId]);

  // Poll CommandProcessor for canUndo/canRedo and reflect into state
  useEffect(() => {
    let stopped = false;
    let cp: any;
    const tick = async () => {
      try {
        cp = cp || (await (client as any)?.getCommandProcessor?.());
        if (!cp) return;
        const canUndo = cp?.canUndo?.() ?? false;
        const canRedo = cp?.canRedo?.() ?? false;
        setState((prev) => (prev.canUndo === canUndo && prev.canRedo === canRedo ? prev : { ...prev, canUndo, canRedo }));
      } catch {}
    };
    // initial read
    tick();
    const id = globalThis.setInterval(() => {
      if (!stopped) tick();
    }, 600);
    return () => {
      stopped = true;
      try { globalThis.clearInterval(id); } catch {}
    };
  }, [client]);

  // Remove live URL sync; URL will be updated on explicit commit (blur) via actions.handleSearchCommit

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
