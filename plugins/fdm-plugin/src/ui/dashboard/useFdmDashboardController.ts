import {
  assertFdmDashboardResponse,
  assertFdmNodeData,
  type FdmAxisDimension,
  type FdmAxisMap,
  type FdmDashboardResponse,
  type FdmFilters,
  type FdmNodeData,
  type FdmViewMode,
} from '@hierarchidb/fdm-api';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  FdmDashboardControllerActions,
  FdmDashboardControllerState,
  FdmDashboardViewProps,
} from './fdmDashboardViewTypes.js';

export function useFdmDashboardController({
  node,
  port,
  disabled,
  onNodeDataChange,
}: FdmDashboardViewProps): {
  readonly state: FdmDashboardControllerState;
  readonly actions: FdmDashboardControllerActions;
} {
  const [response, setResponse] = useState<FdmDashboardResponse | undefined>();
  const [selectedCellId, setSelectedCellId] = useState<string | undefined>();
  const [selectedViewMode, setSelectedViewMode] = useState<FdmViewMode>(node.viewMode);
  const [filters, setFilters] = useState<FdmFilters>(node.filters);
  const [axisMap, setAxisMap] = useState<FdmAxisMap>(node.axisMap);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const applyResponse = useCallback((next: FdmDashboardResponse) => {
    assertFdmDashboardResponse(next);
    setResponse(next);
    setError(undefined);
  }, []);

  const load = useCallback(
    async (signal: AbortSignal) => {
      assertFdmNodeData(node);
      setLoading(true);
      setError(undefined);
      try {
        const next = await port.loadDashboard({
          node,
          filters,
          axisMap,
          selectedStateDir: node.selectedStateDir,
          signal,
        });
        if (!signal.aborted) {
          applyResponse(next);
        }
      } catch (unknownError) {
        if (!signal.aborted) {
          setError(
            unknownError instanceof Error ? unknownError.message : 'FDM_DASHBOARD_LOAD_FAILED'
          );
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    },
    [applyResponse, axisMap, filters, node, port]
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const updateNodePresentation = useCallback(
    (partial: Pick<FdmNodeData, 'viewMode' | 'filters' | 'axisMap'>) => {
      const nextNode = {
        ...node,
        viewMode: partial.viewMode,
        filters: partial.filters,
        axisMap: partial.axisMap,
      };
      assertFdmNodeData(nextNode);
      onNodeDataChange?.(nextNode);
    },
    [node, onNodeDataChange]
  );

  const performAction = useCallback(
    async (action: 'refresh' | 'reconnect' | 'run-selected' | 'open-result') => {
      if (disabled) return;
      const controller = new AbortController();
      setLoading(true);
      setError(undefined);
      try {
        const next = await port.performAction({
          node,
          action,
          selectedCellId,
          signal: controller.signal,
        });
        applyResponse(next);
      } catch (unknownError) {
        setError(
          unknownError instanceof Error ? unknownError.message : 'FDM_DASHBOARD_ACTION_FAILED'
        );
      } finally {
        setLoading(false);
      }
    },
    [applyResponse, disabled, node, port, selectedCellId]
  );

  const setViewMode = useCallback(
    (viewMode: FdmViewMode) => {
      setSelectedViewMode(viewMode);
      updateNodePresentation({ viewMode, filters, axisMap });
    },
    [axisMap, filters, updateNodePresentation]
  );

  const setFilter = useCallback(
    (dimension: keyof FdmFilters, values: readonly string[]) => {
      const nextFilters = {
        ...filters,
        [dimension]: [...values],
      };
      setFilters(nextFilters);
      updateNodePresentation({ viewMode: selectedViewMode, filters: nextFilters, axisMap });
    },
    [axisMap, filters, selectedViewMode, updateNodePresentation]
  );

  const setAxis = useCallback(
    (slot: keyof FdmAxisMap, dimension: FdmAxisDimension) => {
      const nextAxisMap = {
        ...axisMap,
        [slot]: dimension,
      };
      setAxisMap(nextAxisMap);
      updateNodePresentation({ viewMode: selectedViewMode, filters, axisMap: nextAxisMap });
    },
    [axisMap, filters, selectedViewMode, updateNodePresentation]
  );

  const actions = useMemo<FdmDashboardControllerActions>(
    () => ({
      refresh: () => void performAction('refresh'),
      reconnect: () => void performAction('reconnect'),
      runSelected: () => void performAction('run-selected'),
      openSelectedResult: () => void performAction('open-result'),
      selectCell: setSelectedCellId,
      setViewMode,
      setFilter,
      setAxis,
    }),
    [performAction, setAxis, setFilter, setViewMode]
  );

  return {
    state: {
      response,
      selectedCellId,
      selectedViewMode,
      filters,
      axisMap,
      loading,
      error,
    },
    actions,
  };
}
