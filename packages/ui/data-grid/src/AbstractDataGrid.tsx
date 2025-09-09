/**
 * AbstractDataGrid Component
 *
 * A data grid component that works with abstract data providers,
 * completely decoupled from specific data types or storage implementations.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  Alert,
  Box,
  Checkbox,
  Chip,
  IconButton,
  InputAdornment,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Download,
  FilterList,
  KeyboardArrowDown,
  KeyboardArrowUp,
  Refresh,
  Search,
  ViewColumn,
} from '@mui/icons-material';
import { useVirtualizer } from '@tanstack/react-virtual';
import type {
  ColumnDefinition,
  DataChangeEvent,
  DataItem,
  DataProvider,
  FilterParams,
  QueryParams,
  QueryResult,
  SortParams,
} from './types/DataProvider';

export interface AbstractDataGridProps<T extends DataItem = DataItem> {
  /** Data provider instance */
  dataProvider: DataProvider<T>;
  /** Column definitions */
  columns: ColumnDefinition<T>[];
  /** Initial query parameters */
  initialQuery?: QueryParams;

  // Features
  /** Enable pagination */
  paginate?: boolean;
  /** Enable sorting */
  sortable?: boolean;
  /** Enable filtering */
  filterable?: boolean;
  /** Enable search */
  searchable?: boolean;
  /** Enable selection */
  selectable?: boolean;
  /** Selection mode */
  selectionMode?: 'single' | 'multiple';
  /** Enable export */
  exportable?: boolean;
  /** Enable refresh */
  refreshable?: boolean;
  /** Enable real-time updates */
  realtime?: boolean;
  /** Enable column visibility toggle */
  columnToggle?: boolean;

  // Virtualization
  /** Enable virtual scrolling for large datasets */
  virtual?: boolean;
  /** Row height for virtual scrolling */
  rowHeight?: number;
  /** Container height */
  height?: number | string;

  // Appearance
  /** Dense mode */
  dense?: boolean;
  /** Sticky header */
  stickyHeader?: boolean;
  /** Striped rows */
  striped?: boolean;
  /** Show grid lines */
  gridLines?: boolean;

  // Callbacks
  /** Row click handler */
  onRowClick?: (item: T) => void;
  /** Row double-click handler */
  onRowDoubleClick?: (item: T) => void;
  /** Selection change handler */
  onSelectionChange?: (selectedItems: T[]) => void;
  /** Export handler */
  onExport?: (format: 'csv' | 'json' | 'excel') => Promise<void>;
  /** Error handler */
  onError?: (error: Error) => void;

  // Customization
  /** Custom empty state */
  emptyMessage?: string;
  /** Custom error component */
  errorComponent?: (error: Error) => React.ReactNode;
  /** Custom loading component */
  loadingComponent?: React.ReactNode;
  /** Additional toolbar items */
  toolbarActions?: React.ReactNode;
}

export function AbstractDataGrid<T extends DataItem = DataItem>({
                                                                  dataProvider,
                                                                  columns: initialColumns,
                                                                  initialQuery = {},
                                                                  paginate = true,
                                                                  sortable = true,
                                                                  filterable = true,
                                                                  searchable = true,
                                                                  selectable = false,
                                                                  selectionMode = 'multiple',
                                                                  exportable = false,
                                                                  refreshable = true,
                                                                  realtime = false,
                                                                  columnToggle = false,
                                                                  virtual = false,
                                                                  rowHeight = 52,
                                                                  height = 600,
                                                                  dense = false,
                                                                  stickyHeader = true,
                                                                  striped = false,
                                                                  gridLines = false,
                                                                  onRowClick,
                                                                  onRowDoubleClick,
                                                                  onSelectionChange,
                                                                  onExport,
                                                                  onError,
                                                                  emptyMessage = 'No data available',
                                                                  errorComponent,
                                                                  loadingComponent,
                                                                  toolbarActions,
                                                                }: AbstractDataGridProps<T>): ReactElement {
  // State
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

  // Refs
  const parentRef = useRef<HTMLDivElement>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Virtual scrolling
  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => rowHeight, [rowHeight]),
    overscan: 5,
    enabled: virtual,
  });

  // Build query parameters
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

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result: QueryResult<T> = await dataProvider.query(queryParams);
      setData(result.data);
      setTotal(result.total);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch data');
      setError(error);
      onError?.(error);
    } finally {
      setLoading(false);
    }
  }, [dataProvider, queryParams, onError]);

  // Fetch data on query change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!realtime || !dataProvider.subscribe) return;

    const handleUpdate = (_event: DataChangeEvent<T>) => {
      // Simple implementation - refetch data
      // Could be optimized to update locally
      fetchData();
    };

    unsubscribeRef.current = dataProvider.subscribe(handleUpdate);

    return () => {
      unsubscribeRef.current?.();
    };
  }, [realtime, dataProvider, fetchData]);

  // Selected items
  /*
  const selectedItems = useMemo(() => {
    return data.filter(item => selectedIds.has(item.id));
  }, [data, selectedIds]);
   */

  // Handlers
  const handlePageChange = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handlePageSizeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPageSize(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSort = (field: string) => {
    if (!sortable) return;

    const existingSort = sort.find((s) => s.field === field);
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
  };

  const handleFilterChange = (field: string, value: string) => {
    if (!filterable) return;

    const newFilters = filters.filter((f) => f.field !== field);
    if (value) {
      newFilters.push({
        field,
        operator: 'contains',
        value,
      });
    }

    setFilters(newFilters);
    setPage(0);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(0);
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(new Set(data.map((item) => item.id)));
    } else {
      setSelectedIds(new Set());
    }

    onSelectionChange?.(event.target.checked ? data : []);
  };

  const handleSelectRow = (item: T) => {
    if (!selectable) return;

    const newSelection = new Set(selectedIds);

    if (selectionMode === 'single') {
      newSelection.clear();
      newSelection.add(item.id);
    } else {
      if (newSelection.has(item.id)) {
        newSelection.delete(item.id);
      } else {
        newSelection.add(item.id);
      }
    }

    setSelectedIds(newSelection);

    const selected = data.filter((d) => newSelection.has(d.id));
    onSelectionChange?.(selected);
  };

  const handleExport = async (format: 'csv' | 'json' | 'excel') => {
    if (!exportable) return;

    if (onExport) {
      await onExport(format);
    } else if (dataProvider.export) {
      try {
        const blob = await dataProvider.export(format, queryParams);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `export.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Export failed');
        setError(error);
        onError?.(error);
      }
    }
  };

  const handleColumnToggle = (field: string) => {
    setColumns((prev) =>
      prev.map((col) => (String(col.field) === field ? { ...col, visible: !col.visible } : col)),
    );
  };

  // Visible columns
  const visibleColumns = useMemo(() => columns.filter((col) => col.visible !== false), [columns]);

  // Current sort state
  const currentSort = sort[0];

  // Render error state
  if (error && !loading) {
    if (errorComponent) {
      return <>{errorComponent(error)}</>;
    }
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error.message}
      </Alert>
    );
  }

  // Render empty state
  if (!loading && data.length === 0) {
    return (
      <Box p={3} textAlign="center">
        <Typography color="text.secondary">{emptyMessage}</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Toolbar */}
      <Box display="flex" alignItems="center" gap={2} mb={2} flexWrap="wrap">
        {searchable && (
          <TextField
            size="small"
            placeholder="Search..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            sx={{ flexGrow: 1, maxWidth: 400 }}
          />
        )}

        {filterable && (
          <Tooltip title="Toggle Filters">
            <IconButton onClick={() => setShowFilters(!showFilters)}>
              <FilterList />
            </IconButton>
          </Tooltip>
        )}

        {columnToggle && (
          <Tooltip title="Column Visibility">
            <IconButton onClick={() => setShowColumnSelector(!showColumnSelector)}>
              <ViewColumn />
            </IconButton>
          </Tooltip>
        )}

        {refreshable && (
          <Tooltip title="Refresh">
            <IconButton onClick={fetchData} disabled={loading}>
              <Refresh />
            </IconButton>
          </Tooltip>
        )}

        {exportable && (
          <Tooltip title="Export">
            <IconButton onClick={() => handleExport('csv')}>
              <Download />
            </IconButton>
          </Tooltip>
        )}

        {toolbarActions}

        <Chip label={`${total} items`} size="small" color="primary" />
      </Box>

      {/* Column selector */}
      {showColumnSelector && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Visible Columns
          </Typography>
          <Box display="flex" flexWrap="wrap" gap={1}>
            {columns.map((col) => (
              <Chip
                key={String(col.field)}
                label={col.header}
                onClick={() => handleColumnToggle(String(col.field))}
                color={col.visible !== false ? 'primary' : 'default'}
                variant={col.visible !== false ? 'filled' : 'outlined'}
                size="small"
              />
            ))}
          </Box>
        </Paper>
      )}

      {/* Loading indicator */}
      {loading && (loadingComponent || <LinearProgress />)}

      {/* Table */}
      <TableContainer
        component={Paper}
        sx={{
          height: virtual ? height : undefined,
          maxHeight: !virtual ? height : undefined,
          '& .MuiTableCell-root': gridLines
            ? {
              border: '1px solid',
              borderColor: 'divider',
            }
            : undefined,
        }}
        ref={virtual ? parentRef : undefined}
      >
        <Table stickyHeader={stickyHeader} size={dense ? 'small' : 'medium'}>
          <TableHead>
            <TableRow>
              {selectable && (
                <TableCell padding="checkbox" width={48}>
                  {selectionMode === 'multiple' && (
                    <Checkbox
                      indeterminate={selectedIds.size > 0 && selectedIds.size < data.length}
                      checked={data.length > 0 && selectedIds.size === data.length}
                      onChange={handleSelectAll}
                    />
                  )}
                </TableCell>
              )}
              {visibleColumns.map((column) => (
                <TableCell
                  key={String(column.field)}
                  align={column.align}
                  width={column.width}
                  sx={{
                    fontWeight: 'bold',
                    cursor: column.sortable && sortable ? 'pointer' : undefined,
                  }}
                  onClick={() => column.sortable && handleSort(String(column.field))}
                >
                  <Box display="flex" alignItems="center" gap={1}>
                    {column.header}
                    {column.sortable && sortable && (
                      <>
                        {currentSort?.field === String(column.field) ? (
                          currentSort.direction === 'asc' ? (
                            <KeyboardArrowUp fontSize="small" />
                          ) : (
                            <KeyboardArrowDown fontSize="small" />
                          )
                        ) : (
                          <Box width={20} />
                        )}
                      </>
                    )}
                  </Box>
                </TableCell>
              ))}
            </TableRow>
            {showFilters && filterable && (
              <TableRow>
                {selectable && <TableCell />}
                {visibleColumns.map((column) => (
                  <TableCell key={`filter-${String(column.field)}`}>
                    {column.filterable && (
                      <TextField
                        size="small"
                        fullWidth
                        placeholder={`Filter ${column.header}`}
                        value={filters.find((f) => f.field === String(column.field))?.value || ''}
                        onChange={(e) => handleFilterChange(String(column.field), e.target.value)}
                      />
                    )}
                  </TableCell>
                ))}
              </TableRow>
            )}
          </TableHead>
          <TableBody>
            {(virtual
                ? virtualizer.getVirtualItems()
                : data.map((_item, index) => ({ index }))
            ).map((virtualRow) => {
              const item = data[virtualRow.index];
              if (!item) return null;

              const isSelected = selectedIds.has(item.id);

              return (
                <TableRow
                  key={item.id}
                  hover
                  selected={isSelected}
                  onClick={() => onRowClick?.(item)}
                  onDoubleClick={() => onRowDoubleClick?.(item)}
                  sx={{
                    cursor: onRowClick || onRowDoubleClick ? 'pointer' : undefined,
                    backgroundColor:
                      striped && virtualRow.index % 2 === 0 ? 'action.hover' : undefined,
                    ...(virtual && {
                      height: rowHeight,
                      transform: `translateY(${virtualRow.index}px)`,
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                    }),
                  }}
                >
                  {selectable && (
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={isSelected}
                        onChange={() => handleSelectRow(item)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>
                  )}
                  {visibleColumns.map((column) => {
                    const value = (item as any)[column.field];
                    const formatted = column.formatter ? column.formatter(value, item) : value;

                    return (
                      <TableCell key={String(column.field)} align={column.align}>
                        {formatted}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {paginate && !virtual && (
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={handlePageChange}
          rowsPerPage={pageSize}
          onRowsPerPageChange={handlePageSizeChange}
          rowsPerPageOptions={[25, 50, 100, 250]}
        />
      )}
    </Box>
  );
}
