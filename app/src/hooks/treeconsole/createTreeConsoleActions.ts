/**
 * TreeConsole action factory.
 *
 * Produces the event handlers consumed by the TreeConsole UI using the
 * extracted dependencies from the integration hook.
 */

import type {
  CommandResult,
  NodeId,
  NodeType,
  TreeId,
  TreeNode,
} from '@hierarchidb/common-types';
import type { TreeConsoleSearchMode } from '@hierarchidb/ui-treeconsole-base';
import type { TreeNodeData } from '@hierarchidb/ui-treeconsole-base';
import { DualKeyMap } from '@hierarchidb/util';
import { preconnectPluginServices } from '../../services/preconnect.js';
import type { TreeConsoleSSOTEntry } from '../../state/treeconsole.atoms.js';
import { buildVisibleRows, syncNodeIndex } from '../../state/treeconsole.derive.js';
import type { ContextAction, MaybeCP, TreeConsoleActionDeps, TreeConsoleActions } from './types.js';

type ClipboardPayload = { nodeIds: NodeId[]; cut?: boolean };

type GlobalWithClipboard = typeof globalThis & { __HDB_CLIPBOARD__?: ClipboardPayload };

function fireCmdEvent() {
  window.dispatchEvent(new CustomEvent('hdb-cmd'));
}

function ensureClipboard(): ClipboardPayload {
  const existing = (globalThis as GlobalWithClipboard).__HDB_CLIPBOARD__;
  if (existing) return existing;
  const fresh: ClipboardPayload = { nodeIds: [] };
  (globalThis as GlobalWithClipboard).__HDB_CLIPBOARD__ = fresh;
  return fresh;
}

function getOrCreateIndex(ssot: TreeConsoleSSOTEntry): DualKeyMap<NodeId, NodeId, TreeNode> {
  return ssot.nodeIndex ? ssot.nodeIndex.clone() : new DualKeyMap<NodeId, NodeId, TreeNode>();
}

function buildIndexFromNodes(
  nodes: readonly TreeNode[],
  fallbackParent: NodeId
): DualKeyMap<NodeId, NodeId, TreeNode> {
  const index = new DualKeyMap<NodeId, NodeId, TreeNode>();
  for (const node of nodes) {
    const key = String(node.id) as NodeId;
    const parentKey = node.parentId ? (String(node.parentId) as NodeId) : fallbackParent;
    index.set(key, node, parentKey);
  }
  return index;
}

const showCommandError = (...args: unknown[]) => {
  console.error('[HDB] Command Error:', ...args);
};

const isCommandResult = (value: unknown): value is CommandResult =>
  typeof value === 'object' && value !== null && 'success' in value;

export function createTreeConsoleActions(deps: TreeConsoleActionDeps): TreeConsoleActions {
  const {
    client,
    treeId,
    pageNodeId,
    pageTreeNode,
    pushPath,
    searchTerm,
    searchMode,
    locale,
    selectedIds,
    expandedIds,
    setState,
    setSSOT,
    ssot,
    loadChildrenOf,
    refreshUndoRedo,
    importExport,
    teardownSubscription,
    setupSubscription,
  } = deps;

  const applyClipboard = (ids: NodeId[], cut: boolean) => {
    const clip = ensureClipboard();
    clip.nodeIds = [...ids];
    if (cut) {
      clip.cut = true;
    } else {
      delete clip.cut;
    }
    const canPaste = ids.length > 0;
    setState((prev) => ({ ...prev, canPaste }));
    setSSOT({ canPaste });
  };

  const resolveRefreshTarget = (): NodeId | undefined => {
    if (pageNodeId) return pageNodeId as NodeId;
    if (treeId) return `${treeId}:root` as NodeId;
    return undefined;
  };

  const runHistoryAction = async (method: 'undo' | 'redo') => {
    if (!client) return;
    const getCP = (client as unknown as MaybeCP).getCommandProcessor;
    if (typeof getCP !== 'function') return;

    let historyInvoked = false;
    try {
      const cp = await getCP();
      const historyFn =
        cp && typeof cp[method] === 'function' ? (cp[method] as () => Promise<unknown>) : undefined;
      if (!historyFn) return;

      historyInvoked = true;
      const result = await historyFn();

      if (isCommandResult(result) && !result.success) {
        showCommandError(result.code, result.error ?? `${method} failed`);
        return;
      }

      const refreshTarget = resolveRefreshTarget();
      if (refreshTarget) {
        try {
          await loadChildrenOf(refreshTarget);
        } catch (error) {
          console.warn(`[TreeConsoleActions] ${method} refresh failed`, error);
        }
      }
    } catch (error) {
      console.error(`[TreeConsoleActions] ${method} failed:`, error);
      showCommandError('UNKNOWN_ERROR', error instanceof Error ? error.message : String(error));
    } finally {
      if (historyInvoked) {
        try {
          await refreshUndoRedo();
        } catch (error) {
          console.warn(`[TreeConsoleActions] refreshUndoRedo failed after ${method}`, error);
        }
        fireCmdEvent();
      }
    }
  };

  const runLocalSearch = async (term: string) => {
    if (!client) return;
    const root = pageNodeId as NodeId;
    const trimmed = term.trim();
    if (!trimmed) {
      await loadChildrenOf(root, '');
      return;
    }
    try {
      const queryAPI = await client.getQueryAPI();
      const results = (await queryAPI.searchNodes({
        rootNodeId: root,
        query: trimmed,
        mode: 'partial',
        maxResults: 200,
      })) as TreeNode[];
      const index = buildIndexFromNodes(results, root);
      setSSOT({ nodeIndex: index });
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const runFulltextSearch = async (term: string) => {
    if (!client) return;
    const root = pageNodeId as NodeId;
    const trimmed = term.trim();
    if (!trimmed) {
      await loadChildrenOf(root, '');
      return;
    }
    try {
      const queryAPI = await client.getQueryAPI();
      const effectiveLocale = locale ?? 'en';
      const results = (await queryAPI.searchNodesFulltext({
        rootNodeId: root,
        query: trimmed,
        maxResults: 200,
        locale: effectiveLocale,
      })) as TreeNode[];
      const index = buildIndexFromNodes(results, root);
      setSSOT({ nodeIndex: index });
    } catch (error) {
      console.error('Full-text search failed:', error);
    }
  };

  const navigateTo = (targetId: NodeId | null | undefined) => {
    if (!pushPath || !treeId) return;
    if (!targetId) {
      pushPath(`/t/${treeId}`);
    } else {
      pushPath(`/t/${treeId}/${targetId}`);
    }
  };

  const openEditDialog = async (targetNodeId: NodeId, nodeHint?: TreeNodeData | TreeNode) => {
    if (!client || !pushPath || !treeId) {
      return;
    }

    const nodeIndex = ssot.nodeIndex ?? new DualKeyMap<NodeId, NodeId, TreeNode>();
    const nodeRecord = nodeIndex.get(targetNodeId);
    const hintedType =
      (nodeRecord as { nodeType?: string; type?: string } | undefined)?.nodeType ??
      (nodeRecord as { type?: string } | undefined)?.type ??
      (nodeHint as { nodeType?: string } | undefined)?.nodeType ??
      (nodeHint as { type?: string } | undefined)?.type ??
      (pageTreeNode && pageTreeNode.id === targetNodeId ? pageTreeNode.nodeType : undefined);
    const nodeType = String(hintedType ?? 'folder');

    await preconnectPluginServices(nodeType).catch(() => {});

    try {
      const wcApi = await client.getWorkingCopyAPI();

      const ensureWorkingCopy = async () => {
        const existing = await wcApi.getWorkingCopy(targetNodeId);
        if (existing) return existing;
        await wcApi.createWorkingCopyFromNode(targetNodeId);
        return await wcApi.getWorkingCopy(targetNodeId);
      };

      const workingCopy = await ensureWorkingCopy();
      if (!workingCopy) {
        showCommandError('UNKNOWN_ERROR', 'Unable to prepare working copy for edit dialog');
        return;
      }

      const workingCopyId = (workingCopy.id as NodeId) ?? targetNodeId;

      const hintedParent =
        nodeRecord?.parentId ??
        (nodeHint as { parentId?: NodeId | null } | undefined)?.parentId ??
        (pageTreeNode && pageTreeNode.id === targetNodeId ? pageTreeNode.parentId : undefined);
      const parentForRoute: NodeId = (() => {
        if (pageNodeId) return pageNodeId as NodeId;
        if (hintedParent) return hintedParent as NodeId;
        return targetNodeId;
      })();

      pushPath(`/t/${treeId}/${parentForRoute}/${workingCopyId}/${nodeType}/edit`);
    } catch (error) {
      console.error('Failed to launch edit dialog:', error);
      showCommandError('UNKNOWN_ERROR', error instanceof Error ? error.message : String(error));
    }
  };

  const moveSelectionToTrash = async () => {
    if (!client || selectedIds.length === 0) return;
    const ok = confirm(`Move ${selectedIds.length} item(s) to trash?`);
    if (!ok) return;
    try {
      await teardownSubscription(pageNodeId as NodeId);
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
      await setupSubscription(parent);
    } catch (error) {
      console.error('Trash failed:', error);
      showCommandError('UNKNOWN_ERROR');
    }
  };

  return {
    handleNodeClick: (node: TreeNodeData) => {
      const targetId = node.id as NodeId;
      void preconnectPluginServices(String(node.nodeType || ''));
      if (pushPath && treeId) {
        const isRootLike = pageTreeNode && pageTreeNode.id === targetId;
        const qs = searchTerm ? `?q=${encodeURIComponent(searchTerm)}` : '';
        pushPath(isRootLike ? `/t/${treeId}${qs}` : `/t/${treeId}/${targetId}${qs}`);
      }
    },

    handleNodeSelect: (nodeIds: string[], selected: boolean) => {
      const next = new Set<NodeId>((selectedIds || []).map((id) => id as NodeId));
      const ids = Array.isArray(nodeIds) ? nodeIds : [nodeIds];
      ids.forEach((rawId) => {
        const id = rawId as NodeId;
        if (selected) {
          next.add(id);
        } else {
          next.delete(id);
        }
      });

      setSSOT({
        selectedIds: Array.from(next),
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

      if (expanded && client) {
        try {
          const index = getOrCreateIndex(ssot);
          const parentKey = nodeId as NodeId;
          const existingChildIds = Array.from(index.getPrimaryKeysBySecondary(parentKey));
          if (!existingChildIds.length) {
            const queryAPI = await client.getQueryAPI();
            const result = await queryAPI.listChildren(nodeId as NodeId);
            syncNodeIndex(index, parentKey, result);
            setSSOT({ nodeIndex: index });
          }
        } catch (err) {
          console.error('Failed to load children for node:', nodeId, err);
        }
      }
    },

    handleSearchChange: async (term: string) => {
      setSSOT({ searchTerm: term });
      if (searchMode === 'local') {
        await runLocalSearch(term);
      } else {
        await runFulltextSearch(term);
      }
    },

    handleSearchClear: () => {
      setSSOT({ searchTerm: '' });
      const root = pageNodeId as NodeId;
      void loadChildrenOf(root, '');
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

    handleSearchModeChange: (mode: TreeConsoleSearchMode) => {
      if (mode === searchMode) return;
      setSSOT({ searchMode: mode });
      if (mode === 'local') {
        void runLocalSearch(searchTerm);
      } else {
        void runFulltextSearch(searchTerm);
      }
    },

    handleCreate: async () => {
      if (!client || !pageNodeId || !treeId) return;
      try {
        const nodeType: NodeType = 'folder' as NodeType;
        const mutationAPI = await client.getMutationAPI();
        const res = await mutationAPI.createNode({
          nodeType,
          treeId: treeId as TreeId,
          parentId: pageNodeId as NodeId,
          name: 'New Folder',
        });
        if (!res?.success) {
          const err = (res as unknown as { error?: string })?.error;
          showCommandError('INVALID_OPERATION', err || 'Create failed');
          return;
        }
        const wcNodeId = res.nodeId as NodeId;
        fireCmdEvent();
        if (pushPath) {
          pushPath(`/t/${treeId}/${pageNodeId}/${wcNodeId}/${String(nodeType)}/create`);
        }
      } catch (error) {
        console.error('Create failed:', error);
        showCommandError('UNKNOWN_ERROR');
      }
    },

    handleEdit: async () => {
      if (selectedIds.length !== 1) return;
      await openEditDialog(selectedIds[0] as NodeId);
    },

    handleTrash: () => {
      void moveSelectionToTrash();
    },
    handleRemove: () => {
      void moveSelectionToTrash();
    },

    handleRefresh: async () => {
      const root = pageNodeId as NodeId;
      if (!client || !root) return;
      await loadChildrenOf(root);
    },

    handleExpandAll: () => {
      const index = getOrCreateIndex(ssot);
      const rootId = (pageNodeId || '') as NodeId;
      const flat = buildVisibleRows(rootId, index, expandedIds);
      const allIds = flat.map((node) => node.id as NodeId);
      setSSOT({ nodeIndex: index, expandedIds: allIds });
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
      // Sorting applied on derived view; index remains unchanged.
    },

    handleFilterChange: (filter: string) => {
      setState((prev) => ({ ...prev, filterBy: filter }));
      // Filtering applied on derived view; index remains unchanged.
    },

    handleViewModeChange: (mode) => {
      setSSOT({ viewMode: mode });
    },

    handleBreadcrumbNavigate: (nodeId: string, node) => {
      if (!nodeId || (node && node.isClickable === false)) return;
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

    handleContextMenuAction: async (action, node, options = {}) => {
      const normalizedAction = (action === 'remove' ? 'trash' : action) as ContextAction;
      console.log('Context menu action:', normalizedAction, 'for node:', node);

      const targetNodeId = node.id as NodeId;
      const parentId = (node.parentId as NodeId | undefined) ?? (pageNodeId as NodeId | undefined);

      const refreshParent = async (id: NodeId | undefined) => {
        if (!id) return;
        await loadChildrenOf(id);
      };

      if (normalizedAction === 'edit') {
        setSSOT({ selectedIds: [targetNodeId] });
        await openEditDialog(targetNodeId, node);
        return;
      }

      if (normalizedAction.startsWith('create:')) {
        if (!client || !treeId) return;
        const source = options.source ?? 'speedDial';
        const newType = normalizedAction.replace('create:', '') as NodeType;
        try {
          const mutationAPI = await client.getMutationAPI();
          const displayName = newType.charAt(0).toUpperCase() + newType.slice(1);
          const res = await mutationAPI.createNode({
            nodeType: newType,
            treeId: treeId as TreeId,
            parentId: targetNodeId,
            name: `New ${displayName}`,
          });
          if (!res?.success) {
            const err = (res as unknown as { error?: string })?.error;
            showCommandError('INVALID_OPERATION', err || 'Create failed');
            return;
          }
          const wcNodeId = res.nodeId as NodeId;
          fireCmdEvent();
          const navigateToCreateDialog = () => {
            if (!pushPath) return;
            const nodeTypePath = String(newType);
            pushPath(`/t/${treeId}/${targetNodeId}/${wcNodeId}/${nodeTypePath}/create`);
          };

          if (source === 'breadcrumb') {
            await refreshParent(targetNodeId);
            if (pushPath) {
              navigateTo(targetNodeId);
            }
            return;
          }

          if (source === 'treetable') {
            const expanded = new Set<NodeId>((ssot.expandedIds as NodeId[]) ?? []);
            if (!expanded.has(targetNodeId)) {
              expanded.add(targetNodeId);
              setSSOT({ expandedIds: Array.from(expanded) });
            }
            const selected = new Set<NodeId>((ssot.selectedIds as NodeId[]) ?? []);
            selected.clear();
            selected.add(wcNodeId);
            setSSOT({ selectedIds: Array.from(selected) });

            setTimeout(() => {
              void refreshParent(targetNodeId);
            }, 0);
            await refreshUndoRedo();
            navigateToCreateDialog();
            return;
          }

          // default (speed dial etc.)
          await refreshParent(targetNodeId);
          navigateToCreateDialog();
        } catch (error) {
          console.error('Context create failed:', error);
          showCommandError('UNKNOWN_ERROR');
        }
        return;
      }

      if (normalizedAction === 'rename-inline' && node?.id && typeof node.name === 'string') {
        try {
          const mutationAPI = await client.getMutationAPI();
          const next = node.name.trim();
          const current = ssot.nodeIndex?.get(node.id as NodeId)?.name ?? '';
          if (next === current) return;
          if (!next) {
            showCommandError('VALIDATION_ERROR', 'Name is required');
            return;
          }
          if (next.length > 255) {
            showCommandError('VALIDATION_ERROR', 'Name is too long (max 255)');
            return;
          }
          if (!/^[^<>:"/\\|?*]+$/.test(next)) {
            showCommandError('VALIDATION_ERROR', 'Invalid characters in name');
            return;
          }
          const res = await mutationAPI.updateNode({ nodeId: node.id as NodeId, name: next });
          if (!res.success) {
            showCommandError('INVALID_OPERATION', res.error || 'Update failed');
            return;
          }
          await refreshParent(parentId ?? (pageNodeId as NodeId));
          await refreshUndoRedo();
          fireCmdEvent();
        } catch (error) {
          console.error('Inline rename failed:', error);
          showCommandError('UNKNOWN_ERROR');
        }
        return;
      }

      if (
        normalizedAction === 'update-desc-inline' &&
        node?.id &&
        typeof node.description === 'string'
      ) {
        try {
          const mutationAPI = await client.getMutationAPI();
          const next = String(node.description ?? '').trim();
          const current = ssot.nodeIndex?.get(node.id as NodeId)?.description ?? '';
          if (next === current) return;
          if (next.length > 1000) {
            showCommandError('VALIDATION_ERROR', 'Description is too long (max 1000)');
            return;
          }
          const res = await mutationAPI.updateNode({
            nodeId: node.id as NodeId,
            description: next,
          });
          if (!res.success) {
            showCommandError('INVALID_OPERATION', res.error || 'Update failed');
            return;
          }
          await refreshParent(parentId ?? (pageNodeId as NodeId));
          await refreshUndoRedo();
          fireCmdEvent();
        } catch (error) {
          console.error('Inline description update failed:', error);
          showCommandError('UNKNOWN_ERROR');
        }
        return;
      }

      if (normalizedAction === 'copy') {
        applyClipboard([targetNodeId], false);
        return;
      }

      if (normalizedAction === 'cut') {
        applyClipboard([targetNodeId], true);
        if (options.navigateToParent) {
          navigateTo(parentId ?? null);
        }
        return;
      }

      if (normalizedAction === 'duplicate') {
        if (!client) return;
        try {
          const mutationAPI = await client.getMutationAPI();
          const toParentId = parentId ?? pageNodeId;
          const res = await mutationAPI.duplicateNodes({
            nodeIds: [targetNodeId],
            toParentId: toParentId as NodeId,
          });
          if (!res.success) {
            showCommandError('INVALID_OPERATION', res.error || 'Duplicate failed');
            return;
          }
          await refreshParent(toParentId as NodeId);
          await refreshUndoRedo();
          fireCmdEvent();
        } catch (error) {
          console.error('Duplicate failed:', error);
          showCommandError('UNKNOWN_ERROR');
        }
        return;
      }

      if (normalizedAction === 'trash') {
        if (!client) return;
        try {
          const scopeParent = parentId ?? pageNodeId;
          if (scopeParent) await teardownSubscription(scopeParent);
          const mutationAPI = await client.getMutationAPI();
          const res = await mutationAPI.moveNodesToTrash([targetNodeId]);
          if (!res.success) {
            showCommandError('INVALID_OPERATION', res.error || 'Trash failed');
            return;
          }
          if (scopeParent) {
            await loadChildrenOf(scopeParent);
            await setupSubscription(scopeParent);
          }
          setSSOT({ selectedIds: (selectedIds || []).filter((id) => id !== targetNodeId) });
          fireCmdEvent();
          if (options.navigateToParent) {
            navigateTo(scopeParent ?? null);
          }
        } catch (error) {
          console.error('Trash failed:', error);
          showCommandError('UNKNOWN_ERROR');
        }
        return;
      }

      if (normalizedAction === 'navigate') {
        navigateTo(targetNodeId);
        return;
      }

      if (normalizedAction === 'export' && node?.id) {
        return;
      }
    },

    handleUndo: () => runHistoryAction('undo'),

    handleRedo: () => runHistoryAction('redo'),

    handleCopy: () => {
      applyClipboard(selectedIds as NodeId[], false);
    },

    handleCut: () => {
      applyClipboard(selectedIds as NodeId[], true);
    },

    handlePaste: async () => {
      if (!client) return;
      const clip = ensureClipboard();
      const ids = clip.nodeIds || [];
      const isCut = Boolean(clip.cut);
      if (ids.length === 0) return;
      try {
        const mutationAPI = await client.getMutationAPI();
        const toParentId = pageNodeId as NodeId;
        const res = isCut
          ? await mutationAPI.moveNodes({ nodeIds: ids as NodeId[], toParentId })
          : await mutationAPI.duplicateNodes({ nodeIds: ids, toParentId });
        if (!('success' in res) || !res.success) {
          const err = (res as unknown as { error?: string })?.error;
          showCommandError('INVALID_OPERATION', err || 'Paste failed');
          return;
        }
        await loadChildrenOf(toParentId);
        if (isCut) {
          (globalThis as GlobalWithClipboard).__HDB_CLIPBOARD__ = undefined;
        }
        await refreshUndoRedo();
        fireCmdEvent();
      } catch (error) {
        console.error('Paste failed:', error);
      }
    },

    handleDuplicate: async () => {
      if (!client || selectedIds.length === 0) return;
      try {
        const mutationAPI = await client.getMutationAPI();
        const toParentId = pageNodeId as NodeId;
        const res = await mutationAPI.duplicateNodes({
          nodeIds: selectedIds as NodeId[],
          toParentId,
        });
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
          setState((prev) => ({ ...prev, canUndo: Boolean(canUndo), canRedo: Boolean(canRedo) }));
        }
      } catch (error) {
        console.error('Duplicate failed:', error);
      }
    },

    handleImport: async () => {
      console.log('Import action triggered');
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,.csv';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file && pageNodeId) {
          const detected = importExport.detectFileFormat(file) ?? null;
          const isSupported = (v: string | null): v is 'json' | 'csv' =>
            v === 'json' || v === 'csv';
          const format: 'json' | 'csv' = isSupported(detected) ? detected : 'json';
          try {
            await importExport.importFile({
              file,
              targetNodeId: pageNodeId,
              format,
              onProgress: (progress) => {
                console.log('Import progress:', progress);
              },
            });
            await loadChildrenOf(pageNodeId);
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

    handleMoveNodes: async (nodeIds, targetParentId) => {
      if (!client || nodeIds.length === 0 || !targetParentId) return;
      try {
        const mutationAPI = await client.getMutationAPI();
        const res = await mutationAPI.moveNodes({
          nodeIds: nodeIds as NodeId[],
          toParentId: targetParentId as NodeId,
        });
        if (!res.success) {
          showCommandError('INVALID_OPERATION', res.error || 'Move failed');
          return;
        }
        await loadChildrenOf(targetParentId as NodeId);
        await refreshUndoRedo();
        fireCmdEvent();
      } catch (error) {
        console.error('Move failed:', error);
        showCommandError('UNKNOWN_ERROR');
      }
    },
  };
}
