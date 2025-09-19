/**
 * useTreeConsoleIntegration Hook
 *
 * Manages TreeConsole state and interactions with WorkerAPIClient.
 * Avoids Orchestrated APIs and uses direct Worker API calls.
 */

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useTreeConsoleSSOT } from '~/state/treeconsole.atoms.js';
import { proxy as comlinkProxy } from 'comlink';
import { Subscriptions } from '~/subscriptions/controller.js';
import { showCommandError } from '~/shared/command-errors.js';
import type { NodeId, NodeType, TreeId, TreeNode, SubscriptionId } from '@hierarchidb/common-type';
import type { Remote } from 'comlink';
import type { WorkerAPI } from '@hierarchidb/common-api';
import type { TreeNodeData } from '@hierarchidb/ui-treeconsole-base';
import type { BreadcrumbNode } from '@hierarchidb/ui-treeconsole-breadcrumb';
import { useImportExport } from '@hierarchidb/ui-import-export';
import { convertTreeNodeToTreeNodeData, createDefaultColumns } from '../utils/treeNodeConverter.js';
import { rebuildAdjacency, buildVisibleRows } from '~/state/treeconsole.derive.js';
import { preconnectForNodeTypes, preconnectPluginServices } from '~/services/preconnect.js';

// Top-level helper types used across multiple callbacks
type MaybeCP = { getCommandProcessor?: () => Promise<{ canUndo?: () => boolean; canRedo?: () => boolean; undo?: () => Promise<void>; redo?: () => Promise<void> }> };
type GlobalWithClipboard = typeof globalThis & { __HDB_CLIPBOARD__?: { nodeIds: NodeId[]; cut?: boolean } };

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
  // Jotai SSOT for this pageNodeId
  const { state: ssot, set: setSSOT, incRef, decRef } = useTreeConsoleSSOT(pageNodeId as string | undefined);
  const treeData = ssot.treeData as TreeNodeData[];
  const rawNodes = ssot.rawNodes as TreeNode[];
  const selectedIds = ssot.selectedIds as NodeId[];
  const expandedIds = ssot.expandedIds as NodeId[];
  const searchTerm = ssot.searchTerm || '';
  const viewMode = (ssot.viewMode as ViewMode) || 'list';

  // TreeConsole internal state
  const [state, setState] = useState<TreeConsoleState>({
    loading: ssot.loading,
    error: ssot.error,
    sortBy: ssot.sortBy || 'name',
    sortDirection: ssot.sortDirection || 'asc',
    filterBy: ssot.filterBy || '',
    availableFilters: ['folder', 'basemap', '_shapes_buggy'],
    canGoBack: false,
    canGoForward: false,
    canUndo: ssot.canUndo,
    canRedo: ssot.canRedo,
    canPaste: ssot.canPaste,
  });

  // Memoized columns configuration
  const columns = useMemo(() => createDefaultColumns(), []);

  // Breadcrumb items: ancestors (root -> parent) + current node
  const [breadcrumbItems, setBreadcrumbItems] = useState<BreadcrumbNode[]>([]);
  const MAX_BREADCRUMB_ITEMS = (() => {
    try {
      const v = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_MAX_BREADCRUMB;
      const n = v ? Number(v) : NaN;
      return Number.isFinite(n) && n > 3 ? n : 20;
    } catch { return 20; }
  })();
  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        if (!client || !pageTreeNode?.id) { setBreadcrumbItems([]); return; }
        const queryAPI = await client.getQueryAPI();
        const ancestors = await queryAPI.listAncestors(pageTreeNode.id as NodeId);
        // ancestors: root -> parent
        let nodes: BreadcrumbNode[] = ancestors.map((n) => ({ id: n.id, name: n.name, nodeType: n.nodeType }));
        // Truncate for performance on deep trees
        if (nodes.length + 1 > MAX_BREADCRUMB_ITEMS) {
          const keepTail = Math.max(1, MAX_BREADCRUMB_ITEMS - 3); // root + ellipsis + tail + current
          const rootNode = nodes[0];
          const tail = nodes.slice(Math.max(1, nodes.length - keepTail));
          nodes = [
            ...(rootNode ? [{ id: rootNode.id, name: rootNode.name, nodeType: rootNode.nodeType }] : []),
            { id: '__ellipsis__', name: '…', nodeType: 'ellipsis', isClickable: false },
            ...tail,
          ];
        }
        const currentBreadcrumb: BreadcrumbNode = {
          id: pageTreeNode.id,
          name: pageTreeNode.name,
          nodeType: pageTreeNode.nodeType,
        };
        if (!disposed) setBreadcrumbItems([...nodes, currentBreadcrumb]);
      } catch {
        if (!disposed && pageTreeNode) {
          setBreadcrumbItems([
            {
              id: pageTreeNode.id,
              name: pageTreeNode.name,
              nodeType: pageTreeNode.nodeType,
            },
          ]);
        }
      }
    })();
    return () => { disposed = true; };
  }, [client, pageTreeNode?.id, pageTreeNode?.name, pageTreeNode?.nodeType, MAX_BREADCRUMB_ITEMS]);

  // Import/Export functionality
  const importExport = useImportExport(client, !!client);

  // Helper: sync canUndo/canRedo from CommandProcessor
  const refreshUndoRedo = useCallback(async () => {
    try {
      const getCP = (client as unknown as MaybeCP).getCommandProcessor;
      if (typeof getCP !== 'function') return;
      let cp: any;
      try { cp = await getCP(); } catch { return; }
      if (!cp) return;
      const canUndo = typeof cp.canUndo === 'function' ? (cp.canUndo() as boolean) : false;
      const canRedo = typeof cp.canRedo === 'function' ? (cp.canRedo() as boolean) : false;
      setState((prev) => (prev.canUndo === canUndo && prev.canRedo === canRedo ? prev : { ...prev, canUndo, canRedo }));
    } catch {
      // Swallow Comlink shape-mismatch errors
    }
  }, [client]);

  // Global event bus: listen to command-complete events to refresh canUndo/canRedo
  useEffect(() => {
    const handler = () => { void refreshUndoRedo(); };
    window.addEventListener('hdb-cmd', handler as EventListener);
    return () => window.removeEventListener('hdb-cmd', handler as EventListener);
  }, [refreshUndoRedo]);

  const fireCmdEvent = () => {
    window.dispatchEvent(new CustomEvent('hdb-cmd'));
  };

  // Cleanup helper: remove persisted UI state for given nodes
  const cleanupPersistedLayouts = (ids: NodeId[]) => {
    const keysToRemove = new Set<string>();
    for (const id of ids) {
      keysToRemove.add(`TreeTableCore.columnWidths:tree:${id}`);
      keysToRemove.add(`TreeTableCore.columnWidths:${id}`);
    }
    keysToRemove.forEach((k) => {
      localStorage.removeItem(k);
    });
  };

  // Helper: apply sort/filter/search to raw nodes
  const applySortFilterSearch = (nodes: TreeNodeData[], overrideTerm?: string): TreeNodeData[] => {
    const sortBy = state.sortBy || 'name';
    const sortDir = state.sortDirection || 'asc';
    const filterBy = state.filterBy || '';
    const term = (overrideTerm ?? searchTerm)?.trim();
    let arr: TreeNodeData[] = [...nodes];
    if (filterBy) arr = arr.filter((n) => n.nodeType === (filterBy as unknown as NodeType));
    if (term) {
      const t = term.toLowerCase();
      arr = arr.filter((n) => (n.name || '').toLowerCase().includes(t));
    }
    arr.sort((a, b) => {
      const key = sortBy ?? 'name';
      const va = (a as unknown as Record<string, unknown>)[key] ?? '';
      const vb = (b as unknown as Record<string, unknown>)[key] ?? '';
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: 'base' });
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  };

  // Helper: load children of a node and refresh view
  const loadChildrenOf = async (parentId: NodeId, optTerm?: string) => {
    if (!client) return;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    setSSOT({ loading: true, error: null });
    try {
      const queryAPI = await client.getQueryAPI();
      const children = await queryAPI.listChildren(parentId);
      const shouldFlattenTrash = pageTreeNode?.nodeType === 'trash' && parentId === (pageNodeId as NodeId);
      let displayNodes: TreeNode[] = children;
      if (shouldFlattenTrash) {
        const batches = await Promise.all(children.map((h) => queryAPI.listChildren(h.id as NodeId)));
        displayNodes = batches.flat();
      }
      // Normalize into adjacency maps and rebuild visible rows
      const nodesById = new Map<string, TreeNode>(ssot.nodesById ?? new Map<string, TreeNode>());
      const childrenByParent = new Map<string, Set<string>>(ssot.childrenByParent ?? new Map<string, Set<string>>());
      rebuildAdjacency(nodesById, childrenByParent, String(parentId), displayNodes);
      const rootId = String(pageNodeId || parentId);
      const flat = buildVisibleRows(rootId, nodesById, childrenByParent, expandedIds);
      const sorted = applySortFilterSearch(flat, optTerm);
      setSSOT({ rawNodes: displayNodes, nodesById, childrenByParent, treeData: sorted });
      // Opportunistically preconnect services for the node types present among children
      const types = displayNodes.map((n) => String((n as unknown as { nodeType?: string }).nodeType || ''));
      void preconnectForNodeTypes(types);
    } catch (err) {
      console.error('Failed to load children:', err);
      setState((prev) => ({ ...prev, error: err instanceof Error ? err.message : String(err) }));
    } finally {
      setState((prev) => ({ ...prev, loading: false }));
      setSSOT({ loading: false });
    }
  };

  // Actions implementation
  const actions = useMemo<TreeConsoleActions>(
    () => ({
      handleNodeClick: (node: TreeNodeData) => {
        const targetId = node.id as NodeId;
        // Preconnect for the clicked node's type (best-effort, non-blocking)
        void preconnectPluginServices(String(node.nodeType || ''));
        if (pushPath && treeId) {
          const isRootLike = pageTreeNode && pageTreeNode.id === targetId;
          const qs = searchTerm ? `?q=${encodeURIComponent(searchTerm)}` : '';
          pushPath(isRootLike ? `/t/${treeId}${qs}` : `/t/${treeId}/${targetId}${qs}`);
        }
      },

      handleNodeSelect: (nodeId: string, selected: boolean) => {
        setSSOT({
          selectedIds: (() => {
            const prev = selectedIds;
          if (selected) {
            return [...new Set([...(prev || []), nodeId as NodeId])];
          } else {
            return (prev || []).filter((id) => id !== nodeId);
          }
          })(),
        });
      },

      handleNodeExpand: async (nodeId: string, expanded: boolean) => {
        setSSOT({
          expandedIds: (() => {
            const prev = expandedIds;
            if (expanded) return [...new Set([...(prev || []), nodeId as NodeId])];
            return (prev || []).filter((id) => id !== nodeId);
          })(),
        });

        // Load children when expanding (SSOT優先, 未構築時のみ取得)
        if (expanded && client) {
          try {
            const nodesById = new Map<string, TreeNode>(ssot.nodesById ?? new Map<string, TreeNode>());
            const childrenByParent = new Map<string, Set<string>>(ssot.childrenByParent ?? new Map<string, Set<string>>());
            let children: TreeNode[] | null = null;
            const existing: Set<string> | undefined = childrenByParent.get(String(nodeId));
            if (existing && existing.size) {
              children = Array.from(existing)
                .map((cid) => nodesById.get(String(cid)))
                .filter((n): n is TreeNode => Boolean(n));
            }
            if (!children) {
              const queryAPI = await client.getQueryAPI();
              children = await queryAPI.listChildren(nodeId as NodeId);
              rebuildAdjacency(nodesById, childrenByParent, String(nodeId), children);
            }
            const rootId = String(pageNodeId || nodeId);
            const flat = buildVisibleRows(rootId, nodesById, childrenByParent, [...expandedIds, String(nodeId)]);
            setSSOT({ nodesById, childrenByParent, treeData: applySortFilterSearch(flat) });
          } catch (err) {
            console.error('Failed to load children for node:', nodeId, err);
          }
        }
      },

      handleSearchChange: async (term: string) => {
        setSSOT({ searchTerm: term });
        if (!client) return;
        const root = pageNodeId as NodeId;
        if (!term.trim()) {
          await loadChildrenOf(root, '');
          return;
        }
        try {
          const queryAPI = await client.getQueryAPI();
          const results = await queryAPI.searchNodes({ rootNodeId: root, query: term, mode: 'partial', maxResults: 200 });
          const rows = results.map(convertTreeNodeToTreeNodeData);
          setSSOT({ rawNodes: results, treeData: applySortFilterSearch(rows, term) });
        } catch (e) {
          console.error('Search failed:', e);
        }
      },

      handleSearchClear: () => {
        setSSOT({ searchTerm: '' });
        // When cleared, immediately show unfiltered children
        const root = pageNodeId as NodeId;
        void loadChildrenOf(root, '');
        // Reflect removal in URL: update only the search part (avoid duplicating basename)
        if (pushPath) {
          const sp = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
          sp.delete('q');
          const nextSearch = sp.toString();
          pushPath(nextSearch ? `?${nextSearch}` : '?');
        }
      },

      handleSearchCommit: () => {
        if (!pushPath) return;
        const term = (searchTerm || '').trim();
        const next = term ? `?q=${encodeURIComponent(term)}` : '?';
        const currentSearch = typeof window !== 'undefined' ? window.location.search : '';
        if (currentSearch !== (next === '?' ? '' : next)) pushPath(next);
      },

      handleCreate: async () => {
        // Toolbar create: request Worker to create a draft working copy, then navigate using wc nodeId
        if (!client || !pageNodeId || !treeId) return;
        try {
          const nodeType: NodeType = 'folder' as NodeType;
          const mutationAPI = await client.getMutationAPI();
          const res = await mutationAPI.createNode({
            nodeType,
            treeId: (treeId as TreeId),
            parentId: pageNodeId as NodeId,
            name: 'New Folder',
          });
          if (!res?.success) {
            const err = (res as unknown as { error?: string })?.error;
            showCommandError('INVALID_OPERATION', err || 'Create failed');
            return;
          }
          const wcNodeId = res.nodeId as NodeId; // working copy node id
          fireCmdEvent();
          if (pushPath) {
            pushPath(`/t/${treeId}/${pageNodeId}/${wcNodeId}/${String(nodeType)}/create`);
          }
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
          // Prevent Comlink from invoking a stale subscription callback during mutation
          await teardownSubscription();

          const mutationAPI = await client.getMutationAPI();
          const res = await mutationAPI.moveNodesToTrash(selectedIds as NodeId[]);
          if (!res.success) {
            showCommandError('INVALID_OPERATION', res.error || 'Remove failed');
            return;
          }
          const parent = pageNodeId as NodeId;
          await loadChildrenOf(parent);
          setSSOT({ selectedIds: [] });
          fireCmdEvent();

          // Restore live subscription after mutation completes
          await setupSubscription(parent);

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
        setSSOT({ expandedIds: allIds });
      },

      handleCollapseAll: () => {
        setSSOT({ expandedIds: [] });
      },

      handleSort: (columnId: string) => {
        setState((prev) => ({
          ...prev,
          sortBy: columnId,
          sortDirection: prev.sortBy === columnId && prev.sortDirection === 'asc' ? 'desc' : 'asc',
        }));
        {
          const nodesById = new Map<string, TreeNode>(ssot.nodesById ?? new Map());
          const childrenByParent = new Map<string, Set<string>>(ssot.childrenByParent ?? new Map());
          const rootId = String(pageNodeId || '');
          const flat = buildVisibleRows(rootId, nodesById, childrenByParent, expandedIds);
          setSSOT({ treeData: applySortFilterSearch(flat) });
        }
      },

      handleFilterChange: (filter: string) => {
        setState((prev) => ({ ...prev, filterBy: filter }));
        {
          const nodesById = new Map<string, TreeNode>(ssot.nodesById ?? new Map());
          const childrenByParent = new Map<string, Set<string>>(ssot.childrenByParent ?? new Map());
          const rootId = String(pageNodeId || '');
          const flat = buildVisibleRows(rootId, nodesById, childrenByParent, expandedIds);
          setSSOT({ treeData: applySortFilterSearch(flat) });
        }
      },

      handleViewModeChange: (mode: ViewMode) => {
        setSSOT({ viewMode: mode });
      },

      handleBreadcrumbNavigate: (nodeId: string, node?: BreadcrumbNode) => {
        // Ignore non-clickable breadcrumb items (e.g., ellipsis)
        if (!nodeId || (node && (node as any).isClickable === false)) return;
        const target = nodeId as NodeId;
        if (!target) return;
        if (pushPath && treeId) {
          const isRootLike = pageTreeNode && pageTreeNode.id === target;
          pushPath(isRootLike ? `/t/${treeId}` : `/t/${treeId}/${target}`);
        }
      },

      handleNavigateBack: () => {
        if (pushPath) pushPath(-1);
      },

      handleNavigateForward: () => {
        if (pushPath) pushPath(1);
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
              const displayName = nodeType.charAt(0).toUpperCase() + nodeType.slice(1);
              const mutationAPI = await client.getMutationAPI();
              const res = await mutationAPI.createNode({
                nodeType,
                treeId: (treeId as TreeId),
                parentId: pageNodeId as NodeId,
                name: `New ${displayName}`,
              });
              if (!res?.success) {
            {
              const err = (res as unknown as { error?: string })?.error;
              showCommandError('INVALID_OPERATION', err || 'Create failed');
            }
            return;
          }
              const wcNodeId = res.nodeId as NodeId;
              fireCmdEvent();
              if (pushPath) {
                const nodeTypePath = String(nodeType);
                pushPath(`/t/${treeId}/${pageNodeId}/${wcNodeId}/${nodeTypePath}/create`);
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

        if (action === 'update-desc-inline' && node?.id && typeof (node as TreeNodeData).description === 'string') {
          try {
            const mutationAPI = await client.getMutationAPI();
            const next = String((node as TreeNodeData).description ?? '').trim();
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
      const getCP = (client as unknown as MaybeCP).getCommandProcessor;
          if (typeof getCP !== 'function') return;
          const cp = await getCP();
          if (cp && typeof cp.undo === 'function') {
            await cp.undo();
            const root = pageNodeId as NodeId;
            await loadChildrenOf(root);
            await refreshUndoRedo();
            fireCmdEvent();
          }
        } catch (e) {
          // Ignore if CommandProcessor is not available in this build
        }
      },

      handleRedo: async () => {
        if (!client) return;
        try {
      const getCP = (client as unknown as MaybeCP).getCommandProcessor;
          if (typeof getCP !== 'function') return;
          const cp = await getCP();
          if (cp && typeof cp.redo === 'function') {
            await cp.redo();
            const root = pageNodeId as NodeId;
            await loadChildrenOf(root);
            await refreshUndoRedo();
            fireCmdEvent();
          }
        } catch (e) {
          // Ignore if CommandProcessor is not available
        }
      },

      handleCopy: () => {
        (globalThis as GlobalWithClipboard).__HDB_CLIPBOARD__ = { nodeIds: [...selectedIds] };
        setState((prev) => ({ ...prev, canPaste: selectedIds.length > 0 }));
        setSSOT({ canPaste: selectedIds.length > 0 });
      },

      handleCut: () => {
        (globalThis as GlobalWithClipboard).__HDB_CLIPBOARD__ = { nodeIds: [...selectedIds], cut: true };
        setState((prev) => ({ ...prev, canPaste: selectedIds.length > 0 }));
        setSSOT({ canPaste: selectedIds.length > 0 });
      },

      handlePaste: async () => {
        if (!client) return;
        const clip = (globalThis as GlobalWithClipboard).__HDB_CLIPBOARD__;
        const ids = clip?.nodeIds || [];
        const isCut = Boolean(clip && clip.cut);
        if (ids.length === 0) return;
        try {
          const mutationAPI = await client.getMutationAPI();
          const toParentId = pageNodeId as NodeId;
          const res = isCut
            ? await mutationAPI.moveNodes({ nodeIds: ids as NodeId[], toParentId })
            : await mutationAPI.duplicateNodes({ nodeIds: ids, toParentId });
          if (!('success' in res) || !res.success) {
            {
              const err = (res as unknown as { error?: string })?.error;
              showCommandError('INVALID_OPERATION', err || 'Paste failed');
            }
            return;
          }
          await loadChildrenOf(toParentId);
          // Clear cut clipboard after move
          if (isCut) {
            (globalThis as GlobalWithClipboard).__HDB_CLIPBOARD__ = undefined;
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

            const getCP = (client as unknown as MaybeCP).getCommandProcessor;
            if (typeof getCP === 'function') {
              const cp = await getCP();
              const canUndo = cp && typeof cp.canUndo === 'function' ? cp.canUndo() : false;
              const canRedo = cp && typeof cp.canRedo === 'function' ? cp.canRedo() : false;
              setState((prev) => ({ ...prev, canUndo, canRedo }));
            }

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
    if (!client || !pageNodeId) return;

    // Clear previous view state immediately to avoid showing stale content during route change
    setSSOT({
      treeData: [],
      rawNodes: [],
      selectedIds: [],
      expandedIds: [],
      searchTerm: '',
      error: null,
    });

    const loadTreeData = async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      setSSOT({ loading: true, error: null });

      try {
        
        // Initialize from query params if provided
        if (locationSearch) {
          const params = new URLSearchParams(locationSearch);
          const q = params.get('q') || '';
          if (q) setSSOT({ searchTerm: q });
          const root = pageNodeId as NodeId;
          if (q) {
            const queryAPI = await client.getQueryAPI();
            const results = await queryAPI.searchNodes({ rootNodeId: root, query: q, mode: 'partial', maxResults: 200 });
            const rows = results.map(convertTreeNodeToTreeNodeData);
            setSSOT({ rawNodes: results, treeData: applySortFilterSearch(rows, q) });
            setState((prev) => ({ ...prev, loading: false }));
            return;
          }
        }

        const rootToLoad = pageNodeId as NodeId;
        await loadChildrenOf(rootToLoad);
        setState((prev) => ({ ...prev, loading: false }));
      } catch (err) {
        
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
  const refreshTimerRef = useRef<number | null>(null);

  // Helpers to manage live subscription explicitly (to avoid stale Comlink callback errors)
  const teardownSubscription = useCallback(async (rootId?: NodeId) => {
    if (!client || !rootId) return;
    await Subscriptions.release('page', client, rootId);
  }, [client]);

  const setupSubscription = useCallback(async (rootId: NodeId) => {
    if (!client || !rootId) return;
    const requestRefresh = () => {
      if (refreshTimerRef.current !== null) return;
      refreshTimerRef.current = window.setTimeout(() => {
        refreshTimerRef.current = null;
        void loadChildrenOf(rootId);
      }, 60);
    };
    // Reflect subscription events directly into SSOT, and fall back to refresh for safety
    const cb = comlinkProxy((event: unknown) => {
      try {
        if (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SUBSCRIPTION_DEBUG === '1') {
          console.log('[Subscription][page] event', event);
        }
        type Ev = { type: 'created'|'updated'|'deleted'|'moved'; nodeId: string; node?: TreeNode; parentId?: string; previousParentNodeId?: string };
        const ev = event as Ev;
        const nodesById = new Map<string, TreeNode>(ssot.nodesById ?? new Map<string, TreeNode>());
        const childrenByParent = new Map<string, Set<string>>(ssot.childrenByParent ?? new Map<string, Set<string>>());

        if (ev.type === 'created' && ev.node) {
          nodesById.set(String(ev.node.id), ev.node);
          if (ev.node.parentId) {
            const pid = String(ev.node.parentId);
            const cur = childrenByParent.get(pid) || new Set<string>();
            if (!cur.has(String(ev.node.id))) { const next = new Set(cur); next.add(String(ev.node.id)); childrenByParent.set(pid, next); }
          }
        } else if (ev.type === 'updated' && ev.node) {
          const prev = nodesById.get(String(ev.node.id));
          nodesById.set(String(ev.node.id), { ...(prev || {} as TreeNode), ...(ev.node as TreeNode) });
        } else if (ev.type === 'deleted') {
          // Remove victim and all its descendants from SSOT
          const stack: string[] = [String(ev.nodeId)];
          const toRemove = new Set<string>();
          while (stack.length) {
            const id = stack.pop()!;
            if (toRemove.has(id)) continue;
            toRemove.add(id);
            const ch = childrenByParent.get(id);
            if (ch) for (const cid of ch) stack.push(cid);
          }
          for (const id of toRemove) {
            const n = nodesById.get(id);
            if (n?.parentId) {
              const pid = String(n.parentId);
              const cur = childrenByParent.get(pid);
              if (cur && cur.has(id)) { const next = new Set(cur); next.delete(id); childrenByParent.set(pid, next); }
            }
            childrenByParent.delete(id);
            nodesById.delete(id);
          }
        } else if (ev.type === 'moved' && ev.node) {
          const prev = nodesById.get(String(ev.node.id));
          nodesById.set(String(ev.node.id), { ...(prev || {} as TreeNode), ...(ev.node as TreeNode) });
          if (ev.previousParentNodeId) {
            const oldPid = String(ev.previousParentNodeId);
            const cur = childrenByParent.get(oldPid);
            if (cur && cur.has(String(ev.node.id))) { const next = new Set(cur); next.delete(String(ev.node.id)); childrenByParent.set(oldPid, next); }
          }
          const newPid = String(ev.parentId || ev.node.parentId || '');
          if (newPid) {
            const cur = childrenByParent.get(newPid) || new Set<string>();
            if (!cur.has(String(ev.node.id))) { const next = new Set(cur); next.add(String(ev.node.id)); childrenByParent.set(newPid, next); }
          }
        }

        const root = String(rootId);
        const flat = buildVisibleRows(root, nodesById, childrenByParent, expandedIds);
        setSSOT({ nodesById, childrenByParent, treeData: applySortFilterSearch(flat) });
      } catch (e) {
        // If any shape mismatch happens, fallback to safe refresh
        requestRefresh();
      }
    });
    // If already subscribed, skip re-subscribing/logging
    const existing = Subscriptions.getActive('page', rootId);
    if (existing) return;
    const { subId, created } = await Subscriptions.subscribe('page', client, rootId, cb);

      if (created && subId && import.meta.env && import.meta.env.VITE_SUBSCRIPTION_DEBUG === '1') {
        console.log('[Subscription][page] subscribed', { rootId, subId });
      }

  }, [client, loadChildrenOf]);

  useEffect(() => {
    let disposed = false;
    const run = async () => {
      if (!client || !pageNodeId) return;
      incRef();
      await setupSubscription(pageNodeId as NodeId);
    };

    void run();
    return () => {
      disposed = true;
      decRef();
      // Clear pending refresh
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      void teardownSubscription(pageNodeId as NodeId);
    };
  }, [client, pageNodeId]);

  // Poll CommandProcessor for canUndo/canRedo and reflect into state
  useEffect(() => {
    let stopped = false;
    let cp: any;
    const tick = async () => {
      try {
      const getCP = (client as unknown as MaybeCP).getCommandProcessor;
        if (typeof getCP !== 'function') return;
        cp = cp || (await getCP());
        if (!cp) return;
      const canUndo = typeof cp.canUndo === 'function' ? (cp.canUndo() as boolean) : false;
      const canRedo = typeof cp.canRedo === 'function' ? (cp.canRedo() as boolean) : false;
      setState((prev) => (prev.canUndo === canUndo && prev.canRedo === canRedo ? prev : { ...prev, canUndo, canRedo }));
      setSSOT({ canUndo, canRedo });
      } catch {
        // Swallow comlink method-missing errors
      }
    };
    // initial read
    tick();
    const id = globalThis.setInterval(() => {
      if (!stopped) tick();
    }, 600);
    return () => {
      stopped = true;
      globalThis.clearInterval(id);
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
