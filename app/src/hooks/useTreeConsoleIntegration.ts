/**
 * useTreeConsoleIntegration Hook
 *
 * Manages TreeConsole state and interactions with WorkerAPIClient.
 * Avoids Orchestrated APIs and uses direct Worker API calls.
 */

import type { NodeId, TreeId, TreeNode } from '@hierarchidb/common-types';
import type { TreeConsoleSearchMode } from '@hierarchidb/ui-treeconsole-toolbar';
import type { HierarchicalTreeNode } from '@hierarchidb/ui-treeconsole-base';
import { DualKeyMap } from '@hierarchidb/util';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useImportExport } from '../hooks/useImportExport.ts';
import { getMenuSpec } from '../plugin-loader/menu-spec.ts';
import { useTreeConsoleSSOT } from '../state/treeconsole.atoms.ts';
import { buildVisibleRows, syncNodeIndex } from '../state/treeconsole.derive.js';
import { convertTreeNodeToTreeNodeData, createDefaultColumns } from '../utils/treeNodeConverter.js';
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
  const importExport = useImportExport(client, !!client) as unknown as ImportExportAdapter;

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
    if (!client || !pageNodeId) return;

    setSSOT({
      nodeIndex: undefined,
      selectedIds: [],
      expandedIds: [],
      searchTerm: '',
      searchMode: 'local',
      error: null,
    });

    const load = async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      setSSOT({ loading: true, error: null });

      try {
        if (searchQuery) {
          const queryAPI = await client.getQueryAPI();
          const results = (await queryAPI.searchNodes({
            rootNodeId: pageNodeId as NodeId,
            query: searchQuery,
            mode: 'partial',
            maxResults: 200,
          })) as TreeNode[];
          const index = new DualKeyMap<NodeId, NodeId, TreeNode>();
          syncNodeIndex(index, pageNodeId as NodeId, results);
          setSSOT({ nodeIndex: index });
          setState((prev) => ({ ...prev, loading: false }));
          setSSOT({ loading: false, searchTerm: searchQuery });
          return;
        }

        await loadChildrenOf(pageNodeId as NodeId);
        setState((prev) => ({ ...prev, loading: false }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : String(err),
        }));
      } finally {
        setSSOT({ loading: false });
      }
    };

    void load();
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
      selectedIds,
      setSSOT,
      setupSubscription,
      ssot,
      teardownSubscription,
      treeId,
    ]
  );

  const canCreate = true;
  const canEdit = selectedIds.length === 1;
  const canTrash = selectedIds.length > 0;

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
    canTrash,
    actions,
    state,
  };
}
