import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ColumnSizingState,
  ColumnDef,
  GroupingState,
  Header,
  RowSelectionState,
  SortingState,
  Updater,
  VisibilityState,
} from '@tanstack/react-table';
import {
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import type {
  GridColumnSizingState,
  GridColumnVisibilityState,
  GridGroupingState,
  GridSortingState,
} from './TanstackDataGrid.js';

type RowRecord = { id?: string | number } & Record<PropertyKey, unknown>;

type UseTanstackDataGridViewArgs = {
  columns: ColumnDef<RowRecord>[];
  rows: RowRecord[];
  getRowId?: (row: RowRecord, index?: number) => string | number;
  rowHeight: number;
  enableVirtualization: boolean;
  selectable: boolean;
  sorting?: GridSortingState;
  onSortingChange?: (sorting: GridSortingState) => void;
  grouping?: GridGroupingState;
  onGroupingChange?: (grouping: GridGroupingState) => void;
  columnVisibility?: GridColumnVisibilityState;
  onColumnVisibilityChange?: (visibility: GridColumnVisibilityState) => void;
  columnSizing?: GridColumnSizingState;
  onColumnSizingChange?: (sizing: GridColumnSizingState) => void;
  selectedRows?: Set<string | number>;
  onSelectionChange?: (selected: Set<string | number>) => void;
  selectionMode: 'single' | 'multiple';
  globalFilter?: string;
  onGlobalFilterChange?: (value: string) => void;
  matchedRows?: Set<string | number>;
  hoveredRows?: Set<string | number>;
  draggingRows?: Set<string | number>;
  dropTargetRows?: Set<string | number>;
};

const resolveUpdater = <T,>(updater: Updater<T>, prev: T): T => (
  typeof updater === 'function' ? (updater as (value: T) => T)(prev) : updater
);

const MIN_COLUMN_WIDTH = 60;
const toDefaultRowId = <T extends RowRecord>(row: T, index?: number): string | number => {
  const candidate = row.id;
  if (typeof candidate === 'string' || typeof candidate === 'number') {
    return candidate;
  }
  return index ?? 0;
};

export const useTanstackDataGridView = ({
  columns,
  rows,
  getRowId,
  rowHeight,
  enableVirtualization,
  selectable,
  sorting,
  onSortingChange,
  grouping,
  onGroupingChange,
  columnVisibility,
  onColumnVisibilityChange,
  columnSizing,
  onColumnSizingChange,
  selectedRows,
  onSelectionChange,
  selectionMode,
  globalFilter,
  onGlobalFilterChange,
  matchedRows,
  hoveredRows,
  draggingRows,
  dropTargetRows,
}: UseTanstackDataGridViewArgs) => {
  const [internalSorting, setInternalSorting] = useState<GridSortingState>(sorting ?? []);
  const [internalGrouping, setInternalGrouping] = useState<GridGroupingState>(grouping ?? []);
  const [internalColumnVisibility, setInternalColumnVisibility] = useState<GridColumnVisibilityState>(columnVisibility ?? {});
  const [internalColumnSizing, setInternalColumnSizing] = useState<GridColumnSizingState>(columnSizing ?? {});
  const [internalSelectedRows, setInternalSelectedRows] = useState<Set<string | number>>(selectedRows ?? new Set());
  const headerContainerRef = useRef<HTMLDivElement | null>(null);
  const bodyContainerRef = useRef<HTMLDivElement | null>(null);
  const resizeRef = useRef<{
    startX: number;
    leftStart: number;
    rightStart: number;
    leftId: string;
    rightId: string;
  }>({ startX: 0, leftStart: 0, rightStart: 0, leftId: '', rightId: '' });

  const resolvedSorting = sorting ?? internalSorting;
  const resolvedGrouping = grouping ?? internalGrouping;
  const resolvedColumnVisibility = columnVisibility ?? internalColumnVisibility;
  const resolvedColumnSizing = columnSizing ?? internalColumnSizing;
  const resolvedSelectedRows = selectedRows ?? internalSelectedRows;

  const normalizedSelectedRows = useMemo(
    () => new Set(Array.from(resolvedSelectedRows).map(String)),
    [resolvedSelectedRows],
  );
  const normalizedMatchedRows = useMemo(
    () => (matchedRows ? new Set(Array.from(matchedRows).map(String)) : undefined),
    [matchedRows],
  );
  const normalizedHoveredRows = useMemo(
    () => (hoveredRows ? new Set(Array.from(hoveredRows).map(String)) : undefined),
    [hoveredRows],
  );
  const normalizedDraggingRows = useMemo(
    () => (draggingRows ? new Set(Array.from(draggingRows).map(String)) : undefined),
    [draggingRows],
  );
  const normalizedDropTargetRows = useMemo(
    () => (dropTargetRows ? new Set(Array.from(dropTargetRows).map(String)) : undefined),
    [dropTargetRows],
  );

  useEffect(() => {
    if (sorting !== undefined) setInternalSorting(sorting);
  }, [sorting]);
  useEffect(() => {
    if (grouping !== undefined) setInternalGrouping(grouping);
  }, [grouping]);
  useEffect(() => {
    if (columnVisibility !== undefined) setInternalColumnVisibility(columnVisibility);
  }, [columnVisibility]);
  useEffect(() => {
    if (columnSizing !== undefined) setInternalColumnSizing(columnSizing);
  }, [columnSizing]);
  useEffect(() => {
    if (selectedRows !== undefined) setInternalSelectedRows(selectedRows);
  }, [selectedRows]);

  const rowSelectionState = useMemo<RowSelectionState>(() => {
    const mapping: RowSelectionState = {};
    normalizedSelectedRows.forEach((id) => {
      mapping[id] = true;
    });
    return mapping;
  }, [normalizedSelectedRows]);

  const handleRowSelectionChange = useCallback((updater: Updater<RowSelectionState>) => {
    const next = resolveUpdater(updater, rowSelectionState);
    let normalized = next;

    if (selectionMode === 'single') {
      const entries = Object.entries(next).filter(([, value]) => value);
      normalized = entries.length > 0 ? { [entries[entries.length - 1]![0]]: true } : {};
    }

    const nextSet = new Set<string | number>();
    Object.entries(normalized).forEach(([key, value]) => {
      if (value) nextSet.add(key);
    });

    if (selectedRows === undefined) {
      setInternalSelectedRows(nextSet);
    }
    onSelectionChange?.(nextSet);
  }, [onSelectionChange, rowSelectionState, selectedRows, selectionMode]);

  const handleSortingChange = useCallback((updater: Updater<SortingState>) => {
    const next = resolveUpdater(updater, resolvedSorting);
    if (sorting === undefined) setInternalSorting(next);
    onSortingChange?.(next);
  }, [onSortingChange, resolvedSorting, sorting]);

  const handleGroupingChange = useCallback((updater: Updater<GroupingState>) => {
    const next = resolveUpdater(updater, resolvedGrouping);
    if (grouping === undefined) setInternalGrouping(next);
    onGroupingChange?.(next);
  }, [grouping, onGroupingChange, resolvedGrouping]);

  const handleColumnVisibilityChange = useCallback((updater: Updater<VisibilityState>) => {
    const next = resolveUpdater(updater, resolvedColumnVisibility);
    if (columnVisibility === undefined) setInternalColumnVisibility(next);
    onColumnVisibilityChange?.(next);
  }, [columnVisibility, onColumnVisibilityChange, resolvedColumnVisibility]);

  const handleColumnSizingChange = useCallback((updater: Updater<ColumnSizingState>) => {
    const next = resolveUpdater(updater, resolvedColumnSizing);
    if (columnSizing === undefined) setInternalColumnSizing(next);
    onColumnSizingChange?.(next);
  }, [columnSizing, onColumnSizingChange, resolvedColumnSizing]);

  const handleResizeStart = useCallback(<T,>(
    leftHeader: Header<T, unknown>,
    rightHeader: Header<T, unknown>,
    event: React.MouseEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const handleRect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const startX = handleRect.left + handleRect.width / 2;
    const leftStart = leftHeader.getSize();
    const rightStart = rightHeader.getSize();

    resizeRef.current = {
      startX,
      leftStart,
      rightStart,
      leftId: leftHeader.column.id,
      rightId: rightHeader.column.id,
    };

    const handleMouseMove = (nativeEvent: MouseEvent) => {
      const { startX: originX, leftStart: initialLeft, rightStart: initialRight, leftId, rightId } = resizeRef.current;
      const deltaX = nativeEvent.clientX - originX;
      const maxPositive = initialRight - MIN_COLUMN_WIDTH;
      const maxNegative = initialLeft - MIN_COLUMN_WIDTH;
      const clamped = Math.max(-maxNegative, Math.min(deltaX, maxPositive));
      const leftNew = Math.max(MIN_COLUMN_WIDTH, initialLeft + clamped);
      const rightNew = Math.max(MIN_COLUMN_WIDTH, initialRight - clamped);
      handleColumnSizingChange((prev) => ({
        ...prev,
        [leftId]: leftNew,
        [rightId]: rightNew,
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [handleColumnSizingChange]);

  const table = useReactTable({
    data: rows,
    columns: columns as ColumnDef<RowRecord>[],
    state: {
      sorting: resolvedSorting,
      grouping: resolvedGrouping,
      columnVisibility: resolvedColumnVisibility,
      columnSizing: resolvedColumnSizing,
      rowSelection: rowSelectionState,
      globalFilter,
    },
    columnResizeMode: 'onChange',
    enableColumnResizing: true,
    enableRowSelection: selectable,
    enableMultiRowSelection: selectionMode === 'multiple',
    getRowId: (row, index) => String((getRowId ?? toDefaultRowId)(row, index)),
    onRowSelectionChange: handleRowSelectionChange,
    onSortingChange: handleSortingChange,
    onGroupingChange: handleGroupingChange,
    onColumnVisibilityChange: handleColumnVisibilityChange,
    onColumnSizingChange: handleColumnSizingChange,
    onGlobalFilterChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  const rowModel = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: enableVirtualization ? rowModel.length : 0,
    getScrollElement: () => bodyContainerRef.current,
    estimateSize: () => rowHeight,
    measureElement: (element) => element?.getBoundingClientRect().height ?? rowHeight,
    overscan: 6,
  });

  useEffect(() => {
    const bodyElement = bodyContainerRef.current;
    const headerElement = headerContainerRef.current;
    if (!bodyElement || !headerElement) return undefined;

    const handleScroll = () => {
      headerElement.scrollLeft = bodyElement.scrollLeft;
    };

    bodyElement.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      bodyElement.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const virtualRows = enableVirtualization
    ? virtualizer.getVirtualItems()
    : rowModel.map((_, index) => ({ index, start: index * rowHeight, size: rowHeight, end: 0, key: index }));
  const paddingTop = enableVirtualization && virtualRows.length > 0 ? virtualRows[0]?.start ?? 0 : 0;
  const paddingBottom = enableVirtualization && virtualRows.length > 0
    ? virtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1]?.end ?? 0)
    : 0;
  const leafColumnCount = table.getAllLeafColumns().length;
  const measureRowElement = enableVirtualization ? virtualizer.measureElement : undefined;

  return {
    bodyContainerRef,
    handleColumnSizingChange,
    handleColumnVisibilityChange,
    handleGroupingChange,
    handleResizeStart,
    handleRowSelectionChange,
    handleSortingChange,
    headerContainerRef,
    normalizedDraggingRows,
    normalizedDropTargetRows,
    normalizedHoveredRows,
    normalizedMatchedRows,
    normalizedSelectedRows,
    resolvedColumnSizing,
    resolvedColumnVisibility,
    resolvedGrouping,
    resolvedSelectedRows,
    resolvedSorting,
    rowModel,
    rowSelectionState,
    table,
    virtualRows,
    paddingTop,
    paddingBottom,
    leafColumnCount,
    measureRowElement: measureRowElement as ((row: HTMLTableRowElement | null) => void) | undefined,
  };
};
