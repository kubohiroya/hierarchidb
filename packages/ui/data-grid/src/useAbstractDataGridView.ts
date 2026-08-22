import { useVirtualizer } from '@tanstack/react-virtual';
import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ColumnDefinition,
  DataChangeEvent,
  DataItem,
  DataProvider,
  FilterParams,
  QueryParams,
  QueryResult,
  SortParams,
} from './types/DataProvider.js';

type UseAbstractDataGridViewArgs<T extends DataItem> = {
  dataProvider: DataProvider<T>;
  initialColumns: ColumnDefinition<T>[];
  initialQuery: QueryParams;
  paginate: boolean;
  sortable: boolean;
  filterable: boolean;
  selectable: boolean;
  selectionMode: 'single' | 'multiple';
  exportable: boolean;
  realtime: boolean;
  rowHeight: number;
  virtual: boolean;
  onSelectionChange?: (selectedItems: T[]) => void;
  onExport?: (format: 'csv' | 'json' | 'excel') => Promise<void>;
  onError?: (error: Error) => void;
};

export const useAbstractDataGridView = <T extends DataItem>({
  dataProvider,
  initialColumns,
  initialQuery,
  paginate,
  sortable,
  filterable,
  selectable,
  selectionMode,
  exportable,
  realtime,
  rowHeight,
  virtual,
  onSelectionChange,
  onExport,
  onError,
}: UseAbstractDataGridViewArgs<T>) => {
  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(initialQuery.pagination?.page || 0);
  const [pageSize, setPageSize] = useState(initialQuery.pagination?.pageSize || 50);
  const [sort, setSort] = useState<SortParams[]>(initialQuery.sort || []);
  const [filters, setFilters] = useState<FilterParams[]>(initialQuery.filters || []);
  const [search, setSearch] = useState(initialQuery.search || '');
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [columns, setColumns] = useState(initialColumns);
  const [showFilters, setShowFilters] = useState(false);
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  const parentRef = useRef<HTMLDivElement>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => rowHeight, [rowHeight]),
    overscan: 5,
    enabled: virtual,
  });

  const queryParams = useMemo((): QueryParams => {
    const params: QueryParams = {};

    if (paginate) {
      params.pagination = { page, pageSize };
    }

    if (sort.length > 0) {
      params.sort = sort;
    }

    if (filters.length > 0) {
      params.filters = filters;
    }

    if (search) {
      params.search = search;
    }

    const visibleFields = columns
      .filter((col) => col.visible !== false)
      .map((col) => String(col.field));

    if (visibleFields.length > 0) {
      params.fields = visibleFields;
    }

    return params;
  }, [page, pageSize, sort, filters, search, columns, paginate]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result: QueryResult<T> = await dataProvider.query(queryParams);
      setData(result.data);
      setTotal(result.total);
    } catch (err) {
      const nextError = err instanceof Error ? err : new Error('Failed to fetch data');
      setError(nextError);
      onError?.(nextError);
    } finally {
      setLoading(false);
    }
  }, [dataProvider, onError, queryParams]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!realtime || !dataProvider.subscribe) return;

    const handleUpdate = (_event: DataChangeEvent<T>) => {
      fetchData();
    };

    unsubscribeRef.current = dataProvider.subscribe(handleUpdate);

    return () => {
      unsubscribeRef.current?.();
    };
  }, [realtime, dataProvider, fetchData]);

  const handlePageChange = useCallback((_: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  const handlePageSizeChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setPageSize(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  const handleSort = useCallback(
    (field: string) => {
      if (!sortable) return;

      const existingSort = sort.find((entry) => entry.field === field);
      let newSort: SortParams[];

      if (!existingSort) {
        newSort = [{ field, direction: 'asc' }];
      } else if (existingSort.direction === 'asc') {
        newSort = [{ field, direction: 'desc' }];
      } else {
        newSort = [];
      }

      setSort(newSort);
      setPage(0);
    },
    [sort, sortable]
  );

  const handleFilterChange = useCallback(
    (field: string, value: string) => {
      if (!filterable) return;

      const newFilters = filters.filter((entry) => entry.field !== field);
      if (value) {
        newFilters.push({
          field,
          operator: 'contains',
          value,
        });
      }

      setFilters(newFilters);
      setPage(0);
    },
    [filterable, filters]
  );

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(0);
  }, []);

  const handleSelectAll = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (event.target.checked) {
        setSelectedIds(new Set(data.map((item) => item.id)));
      } else {
        setSelectedIds(new Set());
      }

      onSelectionChange?.(event.target.checked ? data : []);
    },
    [data, onSelectionChange]
  );

  const handleSelectRow = useCallback(
    (item: T) => {
      if (!selectable) return;

      const newSelection = new Set(selectedIds);

      if (selectionMode === 'single') {
        newSelection.clear();
        newSelection.add(item.id);
      } else if (newSelection.has(item.id)) {
        newSelection.delete(item.id);
      } else {
        newSelection.add(item.id);
      }

      setSelectedIds(newSelection);
      onSelectionChange?.(data.filter((row) => newSelection.has(row.id)));
    },
    [data, onSelectionChange, selectable, selectedIds, selectionMode]
  );

  const handleExport = useCallback(
    async (format: 'csv' | 'json' | 'excel') => {
      if (!exportable) return;

      if (onExport) {
        await onExport(format);
        return;
      }

      if (!dataProvider.export) return;

      try {
        const blob = await dataProvider.export(format, queryParams);
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `export.${format}`;
        anchor.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        const nextError = err instanceof Error ? err : new Error('Export failed');
        setError(nextError);
        onError?.(nextError);
      }
    },
    [dataProvider, exportable, onError, onExport, queryParams]
  );

  const handleColumnToggle = useCallback((field: string) => {
    setColumns((prev) =>
      prev.map((col) => (String(col.field) === field ? { ...col, visible: !col.visible } : col))
    );
  }, []);

  const toggleFilters = useCallback(() => {
    setShowFilters((prev) => !prev);
  }, []);

  const toggleColumnSelector = useCallback(() => {
    setShowColumnSelector((prev) => !prev);
  }, []);

  const visibleColumns = useMemo(() => columns.filter((col) => col.visible !== false), [columns]);
  const currentSort = sort[0];

  return {
    columns,
    currentSort,
    data,
    error,
    fetchData,
    filters,
    handleColumnToggle,
    handleExport,
    handleFilterChange,
    handlePageChange,
    handlePageSizeChange,
    handleSearchChange,
    handleSelectAll,
    handleSelectRow,
    handleSort,
    loading,
    page,
    pageSize,
    parentRef,
    search,
    selectedIds,
    showColumnSelector,
    showFilters,
    toggleColumnSelector,
    toggleFilters,
    total,
    virtualizer,
    visibleColumns,
  };
};
