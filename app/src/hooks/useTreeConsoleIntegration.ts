/**
 * useTreeConsoleIntegration Hook
 *
 * Manages TreeConsole atoms and interactions with WorkerAPIClient.
 * Avoids Orchestrated APIs and uses direct Worker API calls.
 */

import type { NodeId, TreeId } from '@hierarchidb/core-types';
import type { TreeNode, TreeTableExpandedAPI } from '@hierarchidb/tree-api';
import type { HierarchicalTreeNode } from '@hierarchidb/ui-treeconsole-base';
import type { TreeConsoleSearchMode } from '@hierarchidb/ui-treeconsole-toolbar';
import { DualKeyMap } from '@hierarchidb/util';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useImportExport } from '~/hooks/useImportExport';
import { getMenuSpec } from '~/plugin-loaders/menu-spec';
import { useTreeConsoleSSOT } from '~/state/treeconsole.atoms';
import { buildVisibleRows, syncNodeIndex } from '~/state/treeconsole.derive';
import { convertTreeNodeToTreeNodeData, createDefaultColumns } from '~/utils/treeNodeConverter';
import { createTreeConsoleActions } from './treeconsole/createTreeConsoleActions.js';
import { applySortFilterSearch, deriveConfigFromState } from './treeconsole/sortFilter.js';
import type {
  ImportExportAdapter,
  TreeConsoleActions,
  TreeConsoleState,
  UseTreeConsoleIntegrationParams,
  ViewMode,
} from './treeconsole/types.ts';
import { useCommandProcessorTracker } from './treeconsole/useCommandProcessorTracker.js';
import { useTreeConsoleBreadcrumbs } from './treeconsole/useTreeConsoleBreadcrumbs.js';
import { useTreeConsoleLoader } from './treeconsole/useTreeConsoleLoader.js';
import { useTreeConsoleSubscription } from './treeconsole/useTreeConsoleSubscription.js';

export function useTreeConsoleIntegration({
  client,
  treeId,
  pageNodeId,
  pageTreeNode,
  pushPath,
  locationSearch,
  returnTo,
}: UseTreeConsoleIntegrationParams) {
  const {
    state: ssot,
    set: setSSOT,
    incRef,
    decRef,
  } = useTreeConsoleSSOT(pageNodeId as string | undefined);
  const debugEnabled = (() => {
    try {
      const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
      return env?.VITE_SUBSCRIPTION_DEBUG === '1';
    } catch {
      return false;
    }
  })();
  const selectedIds = (ssot.selectedIds as NodeId[]) || [];
  const expandedIds = (ssot.expandedIds as NodeId[]) || [];
  const searchTerm = ssot.searchTerm || '';
  const searchMode = (ssot.searchMode as TreeConsoleSearchMode) || 'local';
  const viewMode = (ssot.viewMode as ViewMode) || 'list';
  const defaultFilters = useMemo(() => getMenuSpec('resources').order, []);
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? 'en';
  const translateWithFallback = useMemo(
    () => (key: string, fallback: string) => t(key, { defaultValue: fallback }) as string,
    [t]
  );
  const searchQuery = useMemo(() => {
    try {
      if (!locationSearch) return '';
      const params = new URLSearchParams(locationSearch);
      return params.get('q') || '';
    } catch {
      return '';
    }
  }, [locationSearch]);

  const [state, setState] = useState<TreeConsoleState>({
    loading: ssot.loading,
    error: ssot.error,
    sortBy: ssot.sortBy || 'name',
    sortDirection: ssot.sortDirection || 'asc',
    filterBy: ssot.filterBy || '',
    availableFilters: defaultFilters,
    canGoBack: false,
    canGoForward: false,
    canUndo: ssot.canUndo,
    canRedo: ssot.canRedo,
    canPaste: ssot.canPaste,
  });

  const columns = useMemo(() => createDefaultColumns({ t, locale }), [locale, t]);
  const breadcrumbItems = useTreeConsoleBreadcrumbs({ client, pageTreeNode });
  const importExport = useImportExport(client, !!client) as ImportExportAdapter;

  const nodeIndex = ssot.nodeIndex;
  const nodeIndexSnapshot = useMemo(
    () => (nodeIndex ? nodeIndex.clone() : new DualKeyMap<NodeId, NodeId, TreeNode>()),
    [nodeIndex]
  );
  const sortConfig = useMemo(() => deriveConfigFromState(state, searchTerm), [state, searchTerm]);
  const treeData = useMemo<HierarchicalTreeNode[]>(() => {
    if (!nodeIndex) return [];
    const root = (pageNodeId || '') as NodeId;
    const rows = buildVisibleRows(root, nodeIndex, expandedIds);
    const mapped = rows.map((node) => convertTreeNodeToTreeNodeData(node as TreeNode));
    return applySortFilterSearch(mapped, sortConfig, searchTerm);
  }, [nodeIndex, pageNodeId, expandedIds, sortConfig, searchTerm]);

  useEffect(() => {
    if (!debugEnabled) return;
    console.log('[TreeConsoleIntegration] treeData snapshot', {
      length: treeData.length,
      sample: treeData.slice(0, 10).map((node) => ({
        id: String(node.id),
        parentId: node.parentId ? String(node.parentId) : null,
        name: node.metadata?.name,
        depth: node.depth,
        nodeType: node.nodeType,
      })),
    });
  }, [debugEnabled, treeData]);

  const { loadChildrenOf } = useTreeConsoleLoader({
    client,
    pageNodeId,
    pageTreeNode,
    state,
    searchTerm,
    expandedIds,
    ssot,
    setState,
    setSSOT,
  });

  const { setupSubscription, teardownSubscription } = useTreeConsoleSubscription({
    client,
    setSSOT,
    ssot,
    expandedIds,
    loadChildrenOf,
  });

  const refreshUndoRedo = useCommandProcessorTracker({ client, setState, setSSOT });

  const expandedApiRef = useRef<TreeTableExpandedAPI | null>(null);
  const prevExpandedIdsRef = useRef<NodeId[]>([]);
  const incRefRef = useRef<() => void>(() => {});
  const decRefRef = useRef<() => void>(() => {});
  const setupSubscriptionRef = useRef<(id: NodeId) => Promise<void> | void>(() => {});
  const teardownSubscriptionRef = useRef<(id: NodeId) => Promise<void> | void>(() => {});
  const clientRef = useRef(client);

  const clientReady = Boolean(client);

  useEffect(() => {
    incRefRef.current = incRef;
  }, [incRef]);

  useEffect(() => {
    decRefRef.current = decRef;
  }, [decRef]);

  useEffect(() => {
    setupSubscriptionRef.current = setupSubscription;
  }, [setupSubscription]);

  useEffect(() => {
    teardownSubscriptionRef.current = teardownSubscription;
  }, [teardownSubscription]);

  useEffect(() => {
    clientRef.current = client;
  }, [client]);

  useEffect(() => {
    let cancelled = false;
    expandedApiRef.current = null;
    if (!client)
      return () => {
        cancelled = true;
      };
    (async () => {
      try {
        const api = await client.getTreeTableExpandedAPI();
        if (!cancelled) {
          expandedApiRef.current = api;
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('[TreeConsoleIntegration] failed to initialize expanded atoms API', error);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client]);

  useEffect(() => {
    if (!client || !pageNodeId) {
      prevExpandedIdsRef.current = [];
      return;
    }

    prevExpandedIdsRef.current = [];
    setSSOT({
      nodeIndex: undefined,
      selectedIds: [],
      expandedIds: [],
      searchTerm: '',
      searchMode: 'local',
      error: null,
    });

    let cancelled = false;

    const load = async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      setSSOT({ loading: true, error: null });

      let initialExpanded: NodeId[] = [];
      try {
        const api =
          expandedApiRef.current ?? (await client.getTreeTableExpandedAPI().catch(() => null));
        if (!cancelled) {
          expandedApiRef.current = api;
        }
        if (api && pageNodeId) {
          initialExpanded = (await api.getExpandedNodes(pageNodeId as NodeId)) as NodeId[];
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('[TreeConsoleIntegration] failed to load persisted expanded atoms', error);
        }
      }

      if (cancelled) return;
      setSSOT({ expandedIds: initialExpanded, error: null });
      prevExpandedIdsRef.current = initialExpanded;

      try {
        if (searchQuery) {
          const queryAPI = await client.getQueryAPI();
          const results = (await queryAPI.searchNodes({
            rootNodeId: pageNodeId as NodeId,
            query: searchQuery,
            mode: 'contains',
            maxResults: 200,
          })) as TreeNode[];
          const index = new DualKeyMap<NodeId, NodeId, TreeNode>();
          syncNodeIndex(index, pageNodeId as NodeId, results);
          if (cancelled) return;
          setSSOT({ nodeIndex: index, searchTerm: searchQuery });
          setState((prev) => ({ ...prev, loading: false }));
          setSSOT({ loading: false });
          return;
        }

        await loadChildrenOf(pageNodeId as NodeId);
        if (cancelled) return;

        if (initialExpanded.length) {
          for (const id of initialExpanded) {
            await loadChildrenOf(id as NodeId, undefined, { suppressLoading: true });
          }
        }
      } catch (err) {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: err instanceof Error ? err.message : String(err),
          }));
          setSSOT({ loading: false, error: err instanceof Error ? err.message : String(err) });
        }
        return;
      }

      if (cancelled) return;
      setState((prev) => ({ ...prev, loading: false }));
      setSSOT({ loading: false });
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [client, loadChildrenOf, pageNodeId, searchQuery, setSSOT]);

  useEffect(() => {
    if (!clientReady || !pageNodeId) return;
    incRefRef.current();
    void setupSubscriptionRef.current(pageNodeId as NodeId);
    return () => {
      decRefRef.current();
      void teardownSubscriptionRef.current(pageNodeId as NodeId);
    };
  }, [clientReady, pageNodeId]);

  useEffect(() => {
    if (!pageNodeId) {
      prevExpandedIdsRef.current = [];
      return;
    }
    const api = expandedApiRef.current;
    const prev = new Set(prevExpandedIdsRef.current.map((id) => String(id)));
    const next = new Set(expandedIds.map((id) => String(id)));
    const opened = Array.from(next).filter((id) => !prev.has(id));
    const closed = Array.from(prev).filter((id) => !next.has(id));
    prevExpandedIdsRef.current = expandedIds;
    if (!api || (!opened.length && !closed.length)) return;
    void (async () => {
      try {
        if (opened.length) {
          await api.openNodes(pageNodeId as NodeId, opened as NodeId[]);
        }
        if (closed.length) {
          await api.closeNodes(pageNodeId as NodeId, closed as NodeId[]);
        }
      } catch (error) {
        console.warn('[TreeConsoleIntegration] failed to persist expanded ids', error);
      }
    })();
  }, [expandedIds, pageNodeId]);

  const actions = useMemo<TreeConsoleActions>(
    () =>
      createTreeConsoleActions({
        client,
        treeId: treeId as TreeId | undefined,
        pageNodeId,
        pageTreeNode,
        pushPath,
        searchTerm,
        searchMode,
        locale,
        translateWithFallback,
        selectedIds,
        expandedIds,
        returnTo,
        setState,
        setSSOT,
        ssot,
        loadChildrenOf,
        refreshUndoRedo,
        importExport,
        teardownSubscription,
        setupSubscription,
      }),
    [
      client,
      expandedIds,
      importExport,
      loadChildrenOf,
      pageNodeId,
      pageTreeNode,
      pushPath,
      refreshUndoRedo,
      searchMode,
      searchTerm,
      locale,
      translateWithFallback,
      selectedIds,
      setSSOT,
      setupSubscription,
      ssot,
      teardownSubscription,
      treeId,
      returnTo,
    ]
  );

  const canCreate = true;
  const canEdit = selectedIds.length === 1;
  const canArchive = selectedIds.length > 0;

  return {
    loading: state.loading,
    error: state.error,
    treeData,
    nodeIndex: nodeIndexSnapshot,
    columns,
    breadcrumbItems,
    selectedIds,
    expandedIds,
    searchTerm,
    searchMode,
    viewMode,
    locale,
    canCreate,
    canEdit,
    canArchive,
    actions,
    state,
  };
}
