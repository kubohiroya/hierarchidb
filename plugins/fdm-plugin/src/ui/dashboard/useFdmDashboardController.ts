import {
  assertFdmNodeData,
  type FdmAxisDimension,
  type FdmAxisMap,
  type FdmFilters,
  type FdmNodeData,
  type FdmViewMode,
  normalizeFdmNodeData,
} from '@hierarchidb/fdm-api';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fdmDashboardActionAtom,
  fdmDashboardAxisMapAtom,
  fdmDashboardCellDetailQueryAtom,
  fdmDashboardDisabledAtom,
  fdmDashboardFiltersAtom,
  fdmDashboardNodeAtom,
  fdmDashboardNodeChangeAtom,
  fdmDashboardPortAtom,
  fdmDashboardQueryAtom,
  fdmDashboardSelectedCellIdAtom,
  fdmDashboardSelectedViewModeAtom,
} from './fdmDashboardAtoms.js';
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
  const setNode = useSetAtom(fdmDashboardNodeAtom);
  const setPort = useSetAtom(fdmDashboardPortAtom);
  const setDisabled = useSetAtom(fdmDashboardDisabledAtom);
  const setOnNodeDataChange = useSetAtom(fdmDashboardNodeChangeAtom);
  const [selectedCellId, setSelectedCellId] = useAtom(fdmDashboardSelectedCellIdAtom);
  const [selectedViewMode, setSelectedViewMode] = useAtom(fdmDashboardSelectedViewModeAtom);
  const [filters, setFilters] = useAtom(fdmDashboardFiltersAtom);
  const [axisMap, setAxisMap] = useAtom(fdmDashboardAxisMapAtom);
  const queryResult = useAtomValue(fdmDashboardQueryAtom);
  const cellDetailResult = useAtomValue(fdmDashboardCellDetailQueryAtom);
  const [actionResult] = useAtom(fdmDashboardActionAtom);
  const storedOnNodeDataChange = useAtomValue(fdmDashboardNodeChangeAtom);
  const [cellLogLines, setCellLogLines] = useState<readonly string[]>([]);

  useEffect(() => {
    const normalizedNode = normalizeFdmNodeData(node);
    setNode(normalizedNode);
    setSelectedViewMode(normalizedNode.viewMode);
    setFilters(normalizedNode.filters);
    setAxisMap(normalizedNode.axisMap);
  }, [node, setAxisMap, setFilters, setNode, setSelectedViewMode]);

  useEffect(() => {
    setPort(port);
  }, [port, setPort]);

  useEffect(() => {
    setDisabled(disabled ?? false);
  }, [disabled, setDisabled]);

  useEffect(() => {
    setOnNodeDataChange(() => onNodeDataChange);
  }, [onNodeDataChange, setOnNodeDataChange]);

  useEffect(() => {
    const response = queryResult.data;
    const selectedCell = response?.cells.find((cell) => cell.id === selectedCellId);
    setCellLogLines([]);
    if (
      disabled ||
      port.subscribeCellLog === undefined ||
      node === undefined ||
      response === undefined ||
      selectedCell === undefined
    ) {
      return;
    }
    return port.subscribeCellLog(
      {
        node,
        cell: selectedCell,
        selectedStateDir: response.selectedStateDir,
      },
      (event) => {
        setCellLogLines(event.latestLogLines);
      }
    );
  }, [disabled, node, port, queryResult.data, selectedCellId]);

  const updateNodePresentation = useCallback(
    (partial: Pick<FdmNodeData, 'viewMode' | 'filters' | 'axisMap'>) => {
      const nextNode = {
        ...node,
        viewMode: partial.viewMode,
        filters: partial.filters,
        axisMap: partial.axisMap,
      };
      assertFdmNodeData(nextNode);
      storedOnNodeDataChange?.(nextNode);
    },
    [node, storedOnNodeDataChange]
  );

  const performAction = useCallback(
    async (action: 'refresh' | 'reconnect' | 'run-selected' | 'open-result') => {
      if (disabled) return;
      try {
        await actionResult.mutateAsync(action);
      } catch {
        // The mutation atom carries the error into controller state.
      }
    },
    [actionResult, disabled]
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
      const nextAxisMap = replaceFdmAxisDimension(axisMap, slot, dimension);
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
      response: queryResult.data,
      cellDetail: cellDetailResult.data,
      cellLogLines,
      selectedCellId,
      selectedViewMode,
      filters,
      axisMap,
      loading: queryResult.isFetching || cellDetailResult.isFetching || actionResult.isPending,
      error: formatDashboardError(
        queryResult.error ?? cellDetailResult.error ?? actionResult.error
      ),
    },
    actions,
  };
}

function formatDashboardError(unknownError: unknown): string | undefined {
  if (unknownError === null || unknownError === undefined) return undefined;
  return unknownError instanceof Error ? unknownError.message : 'FDM_DASHBOARD_FAILED';
}

export function replaceFdmAxisDimension(
  axisMap: FdmAxisMap,
  slot: keyof FdmAxisMap,
  dimension: FdmAxisDimension
): FdmAxisMap {
  const previousDimension = axisMap[slot];
  if (previousDimension === dimension) return axisMap;
  const occupiedSlot = (
    Object.entries(axisMap) as Array<[keyof FdmAxisMap, FdmAxisDimension]>
  ).find(([, value]) => value === dimension)?.[0];
  if (occupiedSlot === undefined) {
    throw new Error(`FDM axis dimension is not present in the current map: ${dimension}`);
  }
  return {
    ...axisMap,
    [slot]: dimension,
    [occupiedSlot]: previousDimension,
  };
}
