import { useVirtualizer } from '@tanstack/react-virtual';
import type { ChangeEvent, RefObject } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GenericDataGridProps, GridColumn } from './GenericDataGrid.js';

type RowRecord = { id?: string | number } & Record<PropertyKey, unknown>;

const getCellValue = <T extends RowRecord>(row: T, columnId: GridColumn<T>['id']): unknown => {
  const propertyKey = columnId as PropertyKey;
  return Object.hasOwn(row, propertyKey) ? row[propertyKey] : undefined;
};

type UseGenericDataGridViewArgs<T extends RowRecord> = {
  columns: GridColumn<T>[];
  rows: T[];
  getRowId: NonNullable<GenericDataGridProps<T>['getRowId']>;
  page: number;
  rowsPerPage: number;
  sortColumn?: string;
  sortDirection: 'asc' | 'desc';
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  filters: Record<string, string>;
  onFilterChange?: (filters: Record<string, string>) => void;
  searchValue: string;
  onSearchChange?: (value: string) => void;
  onRowSummaryChange?: (summary: { query: string; filtered: number; total: number }) => void;
  selectable: boolean;
  selectionMode: 'single' | 'multiple';
  selectedRows: Set<string | number>;
  onSelectionChange?: (selectedRows: Set<string | number>) => void;
  onPageChange?: (page: number) => void;
  onRowsPerPageChange?: (rowsPerPage: number) => void;
  enableVirtualization: boolean;
  rowHeight: number;
  stopWheelPropagation: boolean;
  parentRef: RefObject<HTMLDivElement | null>;
};

export const useGenericDataGridView = <T extends RowRecord>({
  columns,
  rows,
  getRowId,
  page,
  rowsPerPage,
  sortColumn,
  sortDirection,
  onSort,
  filters,
  onFilterChange,
  searchValue,
  onSearchChange,
  onRowSummaryChange,
  selectable,
  selectionMode,
  selectedRows,
  onSelectionChange,
  onPageChange,
  onRowsPerPageChange,
  enableVirtualization,
  rowHeight,
  stopWheelPropagation,
  parentRef,
}: UseGenericDataGridViewArgs<T>) => {
  const [showFilters, setShowFilters] = useState(false);
  const [localSearchValue, setLocalSearchValue] = useState(searchValue);
  const resolvedSearchValue = onSearchChange ? searchValue : localSearchValue;

  useEffect(() => {
    if (!stopWheelPropagation) return;
    const container = parentRef.current;
    if (!container) return;

    const handleWheel = (event: WheelEvent) => {
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      const scrollable = scrollHeight > clientHeight + 1;
      if (!scrollable) return;
      const scrollTop = container.scrollTop;
      const atTop = scrollTop <= 0;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 1;
      const isEdgeScroll = (event.deltaY < 0 && atTop) || (event.deltaY > 0 && atBottom);
      if (isEdgeScroll) return;
      event.stopPropagation();
    };

    container.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => {
      container.removeEventListener('wheel', handleWheel, { capture: true });
    };
  }, [parentRef, stopWheelPropagation]);

  const filteredRows = useMemo(() => {
    let result = [...rows];
    const searchTerm = resolvedSearchValue;

    if (searchTerm) {
      result = result.filter((row) =>
        columns.some((col) => {
          if (col.hidden) return false;
          const value = getCellValue(row, col.id);
          if (value == null) return false;
          return String(value).toLowerCase().includes(searchTerm.toLowerCase());
        })
      );
    }

    Object.entries(filters).forEach(([columnId, filterValue]) => {
      if (!filterValue) return;
      const column = columns.find((col) => col.id === columnId);
      if (!column) return;

      result = result.filter((row) => {
        const value = getCellValue(row, columnId);
        if (column.filterPredicate) {
          return column.filterPredicate(value, filterValue);
        }
        if (value == null) return false;
        return String(value).toLowerCase().includes(filterValue.toLowerCase());
      });
    });

    return result;
  }, [columns, filters, resolvedSearchValue, rows]);

  useEffect(() => {
    if (!onRowSummaryChange) return;
    onRowSummaryChange({
      query: String(resolvedSearchValue ?? ''),
      filtered: filteredRows.length,
      total: rows.length,
    });
  }, [filteredRows.length, onRowSummaryChange, resolvedSearchValue, rows.length]);

  const displayRows = useMemo(() => {
    if (enableVirtualization) {
      return filteredRows;
    }
    const start = page * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [enableVirtualization, filteredRows, page, rowsPerPage]);

  const virtualizer = useVirtualizer({
    count: enableVirtualization ? displayRows.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => rowHeight, [rowHeight]),
    overscan: 6,
  });

  const virtualRows = enableVirtualization ? virtualizer.getVirtualItems() : [];
  const totalVirtualSize = enableVirtualization ? virtualizer.getTotalSize() : 0;
  const paddingTop = virtualRows.length > 0 ? (virtualRows[0]?.start ?? 0) : 0;
  const paddingBottom =
    virtualRows.length > 0 ? totalVirtualSize - (virtualRows[virtualRows.length - 1]?.end ?? 0) : 0;

  const handleChangePage = useCallback(
    (_event: unknown, newPage: number) => {
      onPageChange?.(newPage);
    },
    [onPageChange]
  );

  const handleChangeRowsPerPage = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const newRowsPerPage = parseInt(event.target.value, 10);
      onRowsPerPageChange?.(newRowsPerPage);
      onPageChange?.(0);
    },
    [onPageChange, onRowsPerPageChange]
  );

  const handleSort = useCallback(
    (columnId: string) => {
      if (!onSort) return;
      const newDirection = sortColumn === columnId && sortDirection === 'asc' ? 'desc' : 'asc';
      onSort(columnId, newDirection);
    },
    [onSort, sortColumn, sortDirection]
  );

  const handleSelectAll = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (!onSelectionChange) return;

      if (event.target.checked) {
        const startIndex = page * rowsPerPage;
        const allIds = new Set(displayRows.map((row, index) => getRowId(row, startIndex + index)));
        onSelectionChange(allIds);
        return;
      }

      onSelectionChange(new Set());
    },
    [displayRows, getRowId, onSelectionChange, page, rowsPerPage]
  );

  const handleSelectRow = useCallback(
    (row: T, absoluteIndex: number) => {
      if (!onSelectionChange) return;

      const rowId = getRowId(row, absoluteIndex);
      const newSelection = new Set(selectedRows);

      if (selectionMode === 'single') {
        newSelection.clear();
        newSelection.add(rowId);
      } else if (newSelection.has(rowId)) {
        newSelection.delete(rowId);
      } else {
        newSelection.add(rowId);
      }

      onSelectionChange(newSelection);
    },
    [getRowId, onSelectionChange, selectedRows, selectionMode]
  );

  const visibleColumns = useMemo(() => columns.filter((col) => !col.hidden), [columns]);
  const padColSpan = visibleColumns.length + (selectable ? 1 : 0);

  const toggleFilters = useCallback(() => {
    setShowFilters((prev) => !prev);
  }, []);

  const searchInputValue = onSearchChange ? searchValue : localSearchValue;
  const handleSearchInputChange = useCallback(
    (value: string) => {
      if (onSearchChange) {
        onSearchChange(value);
        return;
      }
      setLocalSearchValue(value);
    },
    [onSearchChange]
  );

  const handleFilterInputChange = useCallback(
    (columnId: string, value: string) => {
      if (!onFilterChange) return;
      onFilterChange({ ...filters, [columnId]: value });
    },
    [filters, onFilterChange]
  );

  return {
    displayRows,
    filteredRows,
    handleChangePage,
    handleChangeRowsPerPage,
    handleFilterInputChange,
    handleSearchInputChange,
    handleSelectAll,
    handleSelectRow,
    handleSort,
    padColSpan,
    paddingBottom,
    paddingTop,
    searchInputValue,
    showFilters,
    toggleFilters,
    visibleColumns,
    virtualRows,
  };
};
