/**
 * AbstractDataGrid Component
 *
 * A data grid component that works with abstract data providers,
 * completely decoupled from specific data types or storage implementations.
 */

import {
  Download,
  FilterList,
  KeyboardArrowDown,
  KeyboardArrowUp,
  Refresh,
  Search,
  ViewColumn,
} from '@mui/icons-material';
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
import { alpha } from '@mui/material/styles';
import React, { type ReactElement } from 'react';
import type {
  ColumnDefinition,
  DataItem,
  DataProvider,
  QueryParams,
} from './types/DataProvider.js';
import { useAbstractDataGridControlId } from './useAbstractDataGridControlId.js';
import { useAbstractDataGridView } from './useAbstractDataGridView.js';

const getItemValue = <T extends DataItem>(
  item: T,
  field: ColumnDefinition<T>['field']
): unknown => {
  const key = typeof field === 'string' ? field : String(field);
  const record = item as Record<string, unknown>;
  return Object.hasOwn(record, key) ? record[key] : undefined;
};

const renderDefaultValue = (value: unknown): React.ReactNode => {
  if (React.isValidElement(value)) {
    return value;
  }
  if (value == null) {
    return '';
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[object]';
    }
  }
  return String(value);
};

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
  /** Custom empty atoms */
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
  const controlId = useAbstractDataGridControlId();
  const {
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
  } = useAbstractDataGridView<T>({
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
  });

  // Render error atoms
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

  // Render empty atoms
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
            id={`${controlId}-search`}
            name="search"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            InputProps={{
              inputProps: { 'aria-label': 'Search', id: `${controlId}-search`, name: 'search' },
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
            <IconButton onClick={toggleFilters}>
              <FilterList />
            </IconButton>
          </Tooltip>
        )}

        {columnToggle && (
          <Tooltip title="Column Visibility">
            <IconButton onClick={toggleColumnSelector}>
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
                        id={`${controlId}-filter-${String(column.field)}`}
                        name={`filter-${String(column.field)}`}
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
            ).map((virtualRow: { index: number }) => {
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
                      striped && virtualRow.index % 2 === 0
                        ? (theme) => alpha(theme.palette.text.primary, 0.03)
                        : undefined,
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
                    const value = getItemValue(item, column.field);
                    const formatted = column.formatter
                      ? column.formatter(value, item)
                      : renderDefaultValue(value);

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
