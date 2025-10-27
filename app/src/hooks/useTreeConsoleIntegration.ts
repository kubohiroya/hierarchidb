/**
 * useTreeConsoleIntegration Hook
 *
 * Manages TreeConsole state and interactions with WorkerAPIClient.
 * Avoids Orchestrated APIs and uses direct Worker API calls.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { NodeId, TreeId, TreeNode } from '@hierarchidb/common-types';
import type { TreeNodeData } from '@hierarchidb/ui-treeconsole-base';
import { useImportExport } from '../hooks/useImportExport.ts';
import { useTreeConsoleSSOT } from '../state/treeconsole.atoms.ts';
import { convertTreeNodeToTreeNodeData, createDefaultColumns } from '../utils/treeNodeConverter.js';
import { useTreeConsoleBreadcrumbs } from './treeconsole/useTreeConsoleBreadcrumbs.js';
import { useTreeConsoleLoader } from './treeconsole/useTreeConsoleLoader.js';
import { useTreeConsoleSubscription } from './treeconsole/useTreeConsoleSubscription.js';
import { useCommandProcessorTracker } from './treeconsole/useCommandProcessorTracker.js';
import { createTreeConsoleActions } from './treeconsole/createTreeConsoleActions.js';
import { getMenuSpec } from '../plugin-loader/menu-spec.ts';
import type {
  ImportExportAdapter,
  TreeConsoleActions,
  TreeConsoleState,
  UseTreeConsoleIntegrationParams,
  ViewMode,
} from './treeconsole/types.ts';

export function useTreeConsoleIntegration({
  client,
  treeId,
  pageNodeId,
  pageTreeNode,
  pushPath,
  locationSearch,
}: UseTreeConsoleIntegrationParams) {
  const { state: ssot, set: setSSOT, incRef, decRef } = useTreeConsoleSSOT(pageNodeId as string | undefined);
  const treeData = (ssot.treeData as TreeNodeData[]) || [];
  const selectedIds = (ssot.selectedIds as NodeId[]) || [];
  const expandedIds = (ssot.expandedIds as NodeId[]) || [];
  const searchTerm = ssot.searchTerm || '';
  const viewMode = (ssot.viewMode as ViewMode) || 'list';
  const defaultFilters = useMemo(() => getMenuSpec('resources').order, []);

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

  const columns = useMemo(() => createDefaultColumns(), []);
  const breadcrumbItems = useTreeConsoleBreadcrumbs({ client, pageTreeNode });
  const importExport = useImportExport(client, !!client) as unknown as ImportExportAdapter;

  const { applySortAndFilter, loadChildrenOf } = useTreeConsoleLoader({
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
    applySortFilterSearch: applySortAndFilter,
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
      treeData: [],
      rawNodes: [],
      selectedIds: [],
      expandedIds: [],
      searchTerm: '',
      error: null,
    });

    const load = async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      setSSOT({ loading: true, error: null });

      try {
        if (locationSearch) {
          const params = new URLSearchParams(locationSearch);
          const q = params.get('q') || '';
          if (q) {
            const queryAPI = await client.getQueryAPI();
            const results = (await queryAPI.searchNodes({
              rootNodeId: pageNodeId as NodeId,
              query: q,
              mode: 'partial',
              maxResults: 200,
            })) as TreeNode[];
            const rows = results.map(convertTreeNodeToTreeNodeData);
            setSSOT({ rawNodes: results, treeData: applySortAndFilter(rows, q) });
            setState((prev) => ({ ...prev, loading: false }));
            setSSOT({ loading: false, searchTerm: q });
            return;
          }
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
  }, [client, locationSearch, loadChildrenOf, pageNodeId, setSSOT, applySortAndFilter]);

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
        selectedIds,
        expandedIds,
        treeData,
        setState,
        setSSOT,
        ssot,
        applySortFilterSearch: applySortAndFilter,
        loadChildrenOf,
        refreshUndoRedo,
        importExport,
        teardownSubscription,
        setupSubscription,
      }),
    [
      applySortAndFilter,
      client,
      expandedIds,
      importExport,
      loadChildrenOf,
      pageNodeId,
      pageTreeNode,
      pushPath,
      refreshUndoRedo,
      searchTerm,
      selectedIds,
      setSSOT,
      setState,
      setupSubscription,
      ssot,
      teardownSubscription,
      treeData,
      treeId,
    ],
  );

  const canCreate = true;
  const canEdit = selectedIds.length === 1;
  const canDelete = selectedIds.length > 0;

  return {
    loading: state.loading,
    error: state.error,
    treeData,
    columns,
    breadcrumbItems,
    selectedIds,
    expandedIds,
    searchTerm,
    viewMode,
    canCreate,
    canEdit,
    canDelete,
    actions,
    state,
  };
}
