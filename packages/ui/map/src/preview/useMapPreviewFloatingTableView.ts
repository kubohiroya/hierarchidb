import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type GridColumn,
  type GridColumnSizingState,
  type GridColumnVisibilityState,
  type GridGroupingState,
  type GridSortingState,
  buildGridStateKey,
  loadGridStateValue,
  saveGridStateValue,
} from '@hierarchidb/ui-grid';

type UseMapPreviewFloatingTableViewArgs<Row extends { id: string | number }> = {
  resolvedColumns: GridColumn<Row>[];
  persistKeyBase?: string;
  defaultGrouping: GridGroupingState;
  grouping?: GridGroupingState;
  defaultSorting: GridSortingState;
};

export const useMapPreviewFloatingTableView = <Row extends { id: string | number }>({
  resolvedColumns,
  persistKeyBase,
  defaultGrouping,
  grouping,
  defaultSorting,
}: UseMapPreviewFloatingTableViewArgs<Row>) => {
  const [columnSelectorOpen, setColumnSelectorOpen] = useState(false);
  const visibilityKey = persistKeyBase ? buildGridStateKey(persistKeyBase, 'visibility') : null;
  const columnSizingKey = persistKeyBase ? buildGridStateKey(persistKeyBase, 'columnSizing') : null;
  const sortingKey = persistKeyBase ? buildGridStateKey(persistKeyBase, 'sorting') : null;
  const groupingKey = persistKeyBase ? buildGridStateKey(persistKeyBase, 'grouping') : null;
  const isGroupingControlled = grouping !== undefined;

  const [columnVisibility, setColumnVisibility] = useState<GridColumnVisibilityState>(() => (
    visibilityKey ? (loadGridStateValue<GridColumnVisibilityState>(visibilityKey) ?? {}) : {}
  ));
  const [columnSizing, setColumnSizing] = useState<GridColumnSizingState>(() => (
    columnSizingKey ? (loadGridStateValue<GridColumnSizingState>(columnSizingKey) ?? {}) : {}
  ));
  const [sorting, setSorting] = useState<GridSortingState>(() => {
    if (sortingKey) {
      const saved = loadGridStateValue<GridSortingState>(sortingKey);
      if (saved) return saved;
    }
    return defaultSorting;
  });
  const [groupingState, setGroupingState] = useState<GridGroupingState>(() => {
    if (isGroupingControlled) return grouping;
    if (groupingKey) {
      const saved = loadGridStateValue<GridGroupingState>(groupingKey);
      if (saved) return saved;
    }
    return defaultGrouping;
  });

  const resolvedColumnIds = useMemo(
    () => resolvedColumns.map((column) => String(column.id)),
    [resolvedColumns],
  );
  const prevColumnIdsRef = useRef<string[]>([]);

  useEffect(() => {
    const prevIds = prevColumnIdsRef.current;
    const isSame =
      prevIds.length === resolvedColumnIds.length &&
      prevIds.every((id, idx) => id === resolvedColumnIds[idx]);
    if (isSame) return;
    prevColumnIdsRef.current = resolvedColumnIds;
    setColumnVisibility((prev: GridColumnVisibilityState) => {
      const next = { ...prev };
      let changed = false;
      const resolvedSet = new Set(resolvedColumnIds);
      resolvedColumnIds.forEach((id) => {
        if (!(id in next)) {
          next[id] = true;
          changed = true;
        }
      });
      Object.keys(next).forEach((id) => {
        if (!resolvedSet.has(id)) {
          delete next[id];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [resolvedColumnIds]);

  useEffect(() => {
    if (!visibilityKey) return;
    saveGridStateValue(visibilityKey, columnVisibility);
  }, [columnVisibility, visibilityKey]);

  useEffect(() => {
    if (!columnSizingKey) return;
    saveGridStateValue(columnSizingKey, columnSizing);
  }, [columnSizing, columnSizingKey]);

  useEffect(() => {
    if (!sortingKey) return;
    saveGridStateValue(sortingKey, sorting);
  }, [sorting, sortingKey]);

  useEffect(() => {
    if (!groupingKey || isGroupingControlled) return;
    saveGridStateValue(groupingKey, groupingState);
  }, [groupingKey, groupingState, isGroupingControlled]);

  useEffect(() => {
    if (!isGroupingControlled) return;
    setGroupingState(grouping);
  }, [grouping, isGroupingControlled]);

  const handleOpenColumnSelector = () => {
    setColumnSelectorOpen(true);
  };

  const handleCloseColumnSelector = () => {
    setColumnSelectorOpen(false);
  };

  const handleColumnVisibilityToggle = (id: string, checked: boolean) => {
    setColumnVisibility((prev: GridColumnVisibilityState) => ({
      ...prev,
      [id]: checked,
    }));
  };

  return {
    columnSelectorOpen,
    columnVisibility,
    setColumnVisibility,
    columnSizing,
    setColumnSizing,
    sorting,
    setSorting,
    groupingState,
    setGroupingState,
    isGroupingControlled,
    resolvedGrouping: isGroupingControlled ? grouping : groupingState,
    handleOpenColumnSelector,
    handleCloseColumnSelector,
    handleColumnVisibilityToggle,
  };
};
