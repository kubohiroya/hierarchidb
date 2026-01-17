/**
 * GenericDataGrid Component
 *
 * A completely generic, type-safe data grid component with no application-specific dependencies.
 * This component is purely UI-focused and knows nothing about HierarchiDB's data structures.
 */

import React, { useEffect, useMemo, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import {
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
import { Download, FilterList, KeyboardArrowDown, KeyboardArrowUp, Refresh, Search } from '@mui/icons-material';
import type { SxProps, Theme } from '@mui/material/styles';

/**
 * Generic column definition
 * @template T The row data type
 */
type RowRecord = { id?: string | number } & Record<PropertyKey, unknown>;

const getCellValue = <T extends RowRecord>(row: T, columnId: GridColumn<T>['id']): unknown => {
  const propertyKey = columnId as PropertyKey;
  return  Object.hasOwn(row, propertyKey) ? row[propertyKey] : undefined;
};

const toDefaultRowId = <T extends RowRecord>(row: T, index?: number): string | number => {
  const candidate = row.id;
  if (typeof candidate === 'string' || typeof candidate === 'number') {
    return candidate;
  }
  return index ?? 0;
};

const renderDefaultCell = (value: unknown): ReactNode => {
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

export interface GridColumn<T extends RowRecord = RowRecord> {
  /** Unique identifier for the column */
  id: keyof T | string;
  /** Display label */
  label: string;
  /** Column width */
  width?: number | string;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
  /** Custom value formatter */
  format?: (value: unknown, row: T) => ReactNode;
  /** Enable sorting for this column */
  sortable?: boolean;
  /** Enable filtering for this column */
  filterable?: boolean;
  /** Custom filter predicate */
  filterPredicate?: (value: unknown, filterValue: string) => boolean;
  /** Hide column */
  hidden?: boolean;
}

/**
 * Generic data grid props
 * @template T The row data type
 */
export interface GenericDataGridProps<T extends RowRecord = RowRecord> {
  /** Column definitions */
  columns: GridColumn<T>[];
  /** Data rows */
  rows: T[];
  /** Total row count (for server-side pagination) */
  totalRows?: number;
  /** Loading atoms */
  loading?: boolean;
  /** Error message */
  error?: string;

  // Identification
  /** Function to get unique ID for each row */
  getRowId?: (row: T, index?: number) => string | number;

  // Pagination
  /** Current page (0-indexed) */
  page?: number;
  /** Rows per page */
  rowsPerPage?: number;
  /** Available page size options */
  rowsPerPageOptions?: number[];
  /** Page change handler */
  onPageChange?: (page: number) => void;
  /** Rows per page change handler */
  onRowsPerPageChange?: (rowsPerPage: number) => void;

  // Sorting
  /** Current sort column */
  sortColumn?: string;
  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
  /** Sort handler */
  onSort?: (column: string, direction: 'asc' | 'desc') => void;

  // Filtering
  /** Current filters */
  filters?: Record<string, string>;
  /** Filter change handler */
  onFilterChange?: (filters: Record<string, string>) => void;
  /** Global search value */
  searchValue?: string;
  /** Search change handler */
  onSearchChange?: (value: string) => void;
  /** Whether to show the built-in search field */
  showSearch?: boolean;

  // Selection
  /** Enable row selection */
  selectable?: boolean;
  /** Selection mode */
  selectionMode?: 'single' | 'multiple';
  /** Selected row IDs */
  selectedRows?: Set<string | number>;
  /** Selection change handler */
  onSelectionChange?: (selectedRows: Set<string | number>) => void;

  // Row visual atoms sets (controlled)
  /** Disabled rows (dimmed, non-interactive) */
  disabledRows?: Set<string | number>;
  /** Matched rows (e.g., search hits) */
  matchedRows?: Set<string | number>;
  /** Hovered rows (mouse focus). If omitted, hover style uses browser :hover only. */
  hoveredRows?: Set<string | number>;
  /** Rows currently being dragged */
  draggingRows?: Set<string | number>;
  /** Rows marked as drop targets */
  dropTargetRows?: Set<string | number>;

  // Row visual customization
  /** Compute per-row inline style from row atoms */
  rowStyle?: (state: RowState<T>) => CSSProperties | undefined;
  /** Compute per-row css class from row atoms */
  rowClassName?: (state: RowState<T>) => string | undefined;
  /** Compute per-row MUI sx from row atoms */
  rowSx?: (state: RowState<T>) => SxProps<Theme> | undefined;
  /** Optional sx override for header cells */
  headerCellSx?: SxProps<Theme>;

  // Actions
  /** Export handler */
  onExport?: () => void;
  /** Refresh handler */
  onRefresh?: () => void;
  /** Row click handler */
  onRowClick?: (row: T) => void;
  /** Row double-click handler */
  onRowDoubleClick?: (row: T) => void;

  /** Row hover handlers (for cross-view sync etc.) */
  onRowHover?: (row: T, rowId: string | number) => void;
  onRowLeave?: (row: T, rowId: string | number) => void;

  /** Cell context menu handler */
  onCellContextMenu?: (params: {
    event: React.MouseEvent;
    row: T;
    rowId: string | number;
    columnId: string;
    value: unknown;
  }) => void;
  /** Cell click handler */
  onCellClick?: (params: {
    event: React.MouseEvent;
    row: T;
    rowId: string | number;
    columnId: string;
    value: unknown;
  }) => void;

  // Virtualization
  /** Enable virtual scrolling */
  enableVirtualization?: boolean;
  /** Row height in pixels */
  rowHeight?: number;
  /** Container max height */
  maxHeight?: number | string;
  /** Optional sx override for the table container */
  tableContainerSx?: SxProps<Theme>;
  /** Stop wheel events from bubbling to parent scroll containers */
  stopWheelPropagation?: boolean;

  // Appearance
  /** Dense padding */
  dense?: boolean;
  /** Sticky header */
  stickyHeader?: boolean;
  /** Show grid lines */
  showGridLines?: boolean;
  /** Stripe rows */
  striped?: boolean;
  /** Row hover effect */
  hover?: boolean;

  // Customization
  /** Custom empty atoms component */
  emptyComponent?: ReactNode;
  /** Custom loading component */
  loadingComponent?: ReactNode;
  /** Custom error component */
  errorComponent?: (error: string) => ReactNode;
  /** Custom toolbar component */
  toolbarComponent?: ReactNode;
}

export interface RowState<T extends RowRecord = RowRecord> {
  row: T;
  rowId: string | number;
  index: number;
  selected: boolean;
  disabled: boolean;
  matched: boolean;
  hovered: boolean;
  dragging: boolean;
  dropTarget: boolean;
}

/**
 * Generic data grid component
 */
export function GenericDataGrid<T extends RowRecord = RowRecord>({
                                           columns,
                                           rows,
                                           totalRows,
                                           loading = false,
                                           error,
                                           getRowId = toDefaultRowId,
                                           page = 0,
                                           rowsPerPage = 50,
                                           rowsPerPageOptions = [25, 50, 100, 250],
                                           onPageChange,
                                           onRowsPerPageChange,
                                           sortColumn,
                                           sortDirection = 'asc',
                                           onSort,
                                           filters = {},
                                           onFilterChange,
                                           searchValue = '',
                                           onSearchChange,
                                           showSearch = true,
                                           selectable = false,
                                           selectionMode = 'multiple',
                                           selectedRows = new Set(),
                                           onSelectionChange,
                                           onExport,
                                           onRefresh,
                                           onRowClick,
                                           onRowDoubleClick,
                                           onRowHover,
                                           onRowLeave,
                                           onCellContextMenu,
                                           onCellClick,
                                           enableVirtualization = false,
                                           maxHeight = 600,
                                           tableContainerSx,
                                           stopWheelPropagation = false,
                                           dense = false,
                                           stickyHeader = true,
                                           showGridLines = false,
                                           striped = false,
                                           hover = true,
                                           disabledRows,
                                           matchedRows,
                                           hoveredRows,
                                           draggingRows,
                                           dropTargetRows,
                                           rowStyle,
                                           rowClassName,
                                           rowSx,
                                           emptyComponent,
                                           loadingComponent,
                                          errorComponent,
                                          toolbarComponent,
                                          headerCellSx,
                                        }: GenericDataGridProps<T>): ReactElement {
  const [showFilters, setShowFilters] = useState(false);
  const controlId = React.useId();
  const [localSearchValue, setLocalSearchValue] = useState(searchValue);

  // Virtual scrolling setup
  const parentRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!stopWheelPropagation) return;
    const container = parentRef.current;
    if (!container) return;
    const handleWheel = (event: WheelEvent) => {
      event.stopPropagation();
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      const scrollable = scrollHeight > clientHeight + 1;
      if (!scrollable) {
        event.preventDefault();
        return;
      }
      const scrollTop = container.scrollTop;
      const atTop = scrollTop <= 0;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 1;
      if ((event.deltaY < 0 && atTop) || (event.deltaY > 0 && atBottom)) {
        event.preventDefault();
      }
    };
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [stopWheelPropagation]);
  /*
  const _virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => rowHeight, [rowHeight]),
    overscan: 5,
  });
   */

  // Filter rows based on search and filters
  const filteredRows = useMemo(() => {
    let result = [...rows];

    // Apply global search
    const searchTerm = onSearchChange ? searchValue : localSearchValue;
    if (searchTerm) {
      result = result.filter((row) => {
        return columns.some((col) => {
          if (col.hidden) return false;
          const value = getCellValue(row, col.id);
          if (value == null) return false;
          return String(value).toLowerCase().includes(searchTerm.toLowerCase());
        });
      });
    }

    // Apply column filters
    Object.entries(filters).forEach(([columnId, filterValue]) => {
      if (!filterValue) return;

      const column = columns.find((c) => c.id === columnId);
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
  }, [rows, searchValue, localSearchValue, onSearchChange, filters, columns]);

  // Handle pagination
  const displayRows = useMemo(() => {
    if (enableVirtualization) {
      return filteredRows;
    }
    const start = page * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [filteredRows, page, rowsPerPage, enableVirtualization]);

  const handleChangePage = (_event: unknown, newPage: number) => {
    onPageChange?.(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    onRowsPerPageChange?.(newRowsPerPage);
    onPageChange?.(0);
  };

  const handleSort = (columnId: string) => {
    if (!onSort) return;
    const newDirection = sortColumn === columnId && sortDirection === 'asc' ? 'desc' : 'asc';
    onSort(columnId, newDirection);
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!onSelectionChange) return;

    if (event.target.checked) {
      const startIndex = page * rowsPerPage;
      const allIds = new Set(
        displayRows.map((row, index) => getRowId(row, startIndex + index)),
      );
      onSelectionChange(allIds);
    } else {
      onSelectionChange(new Set());
    }
  };

  const handleSelectRow = (row: T, absoluteIndex: number) => {
    if (!onSelectionChange) return;

    const rowId = getRowId(row, absoluteIndex);
    const newSelection = new Set(selectedRows);

    if (selectionMode === 'single') {
      newSelection.clear();
      newSelection.add(rowId);
    } else {
      if (newSelection.has(rowId)) {
        newSelection.delete(rowId);
      } else {
        newSelection.add(rowId);
      }
    }

    onSelectionChange(newSelection);
  };

  const visibleColumns = useMemo(() => columns.filter((col) => !col.hidden), [columns]);

  // Render error atoms
  if (error) {
    if (errorComponent) {
      return <>{errorComponent(error)}</>;
    }
    return (
      <Box p={3} textAlign="center">
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  // Render empty atoms
  if (!loading && rows.length === 0) {
    if (emptyComponent) {
      return <>{emptyComponent}</>;
    }
    return (
      <Box p={3} textAlign="center">
        <Typography color="text.secondary">No data available</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Toolbar */}
      {toolbarComponent || (
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          {showSearch ? (
            <TextField
              size="small"
              placeholder="Search..."
              id={`${controlId}-search`}
              name="search"
              value={onSearchChange ? searchValue : localSearchValue}
              onChange={(e) => {
                if (onSearchChange) {
                  onSearchChange(e.target.value);
                } else {
                  setLocalSearchValue(e.target.value);
                }
              }}
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
          ) : null}

          <Tooltip title="Toggle Filters">
            <IconButton onClick={() => setShowFilters(!showFilters)}>
              <FilterList />
            </IconButton>
          </Tooltip>

          {onRefresh && (
            <Tooltip title="Refresh">
              <IconButton onClick={onRefresh}>
                <Refresh />
              </IconButton>
            </Tooltip>
          )}

          {onExport && (
            <Tooltip title="Export Data">
              <IconButton onClick={onExport}>
                <Download />
              </IconButton>
            </Tooltip>
          )}

          <Chip label={`${totalRows ?? filteredRows.length} rows`} size="small" color="primary" />
        </Box>
      )}

      {/* Loading indicator */}
      {loading && (loadingComponent || <LinearProgress />)}

      {/* Table */}
      <TableContainer
        component={Paper}
        sx={{
          maxHeight: enableVirtualization ? maxHeight : undefined,
          '& .MuiTableCell-root': showGridLines
            ? { border: '1px solid rgba(224, 224, 224, 1)' }
            : undefined,
          overscrollBehavior: stopWheelPropagation ? 'contain' : undefined,
          ...tableContainerSx,
        }}
        ref={parentRef}
      >
        <Table stickyHeader={stickyHeader} size={dense ? 'small' : 'medium'}>
          <TableHead>
            <TableRow>
              {selectable && (
                <TableCell padding="checkbox">
                  {selectionMode === 'multiple' && (
                    <Checkbox
                      indeterminate={
                        selectedRows.size > 0 && selectedRows.size < displayRows.length
                      }
                      checked={displayRows.length > 0 && selectedRows.size === displayRows.length}
                      onChange={handleSelectAll}
                    />
                  )}
                </TableCell>
              )}
              {visibleColumns.map((column) => (
                <TableCell
                  key={String(column.id)}
                  align={column.align || 'left'}
                  width={column.width}
                  sx={{
                    fontWeight: 'bold',
                    backgroundColor: stickyHeader ? 'background.paper' : undefined,
                    py: 0.5,
                    px: 1,
                    ...headerCellSx,
                  }}
                >
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="subtitle2">{column.label}</Typography>
                    {column.sortable && onSort && (
                      <IconButton
                        size="small"
                        onClick={() => handleSort(String(column.id))}
                        sx={{ ml: 'auto' }}
                      >
                        {sortColumn === column.id ? (
                          sortDirection === 'asc' ? (
                            <KeyboardArrowUp />
                          ) : (
                            <KeyboardArrowDown />
                          )
                        ) : (
                          <KeyboardArrowUp sx={{ opacity: 0.3 }} />
                        )}
                      </IconButton>
                    )}
                  </Box>
                </TableCell>
              ))}
            </TableRow>
            {showFilters && (
              <TableRow>
                {selectable && <TableCell />}
                {visibleColumns.map((column) => (
                  <TableCell key={`filter-${String(column.id)}`}>
                    {column.filterable && onFilterChange && (
                      <TextField
                        size="small"
                        fullWidth
                        placeholder={`Filter ${column.label}`}
                        id={`${controlId}-filter-${String(column.id)}`}
                        name={`filter-${String(column.id)}`}
                        value={filters[String(column.id)] || ''}
                        onChange={(e) => {
                          const newFilters = { ...filters, [String(column.id)]: e.target.value };
                          onFilterChange(newFilters);
                        }}
                      />
                    )}
                  </TableCell>
                ))}
              </TableRow>
            )}
          </TableHead>
          <TableBody>
            {displayRows.map((row, index) => {
              const globalRowIndex = page * rowsPerPage + index;
              const rowId = getRowId(row, globalRowIndex);
              const state: RowState<T> = {
                row,
                rowId,
                index,
                selected: selectedRows.has(rowId),
                disabled: !!disabledRows?.has(rowId),
                matched: !!matchedRows?.has(rowId),
                hovered: !!hoveredRows?.has(rowId),
                dragging: !!draggingRows?.has(rowId),
                dropTarget: !!dropTargetRows?.has(rowId),
              };

              const layeredSx: SxProps<Theme>[] = [];
              if (striped && index % 2 === 0) layeredSx.push({ backgroundColor: 'action.hover' });
              if (state.matched) layeredSx.push({ boxShadow: 'inset 3px 0 0 0 rgba(25, 118, 210, 0.9)' });
              if (state.selected) layeredSx.push({ backgroundColor: 'primary.light', '&:hover': { backgroundColor: 'primary.light' } });
              if (state.hovered) layeredSx.push({ outline: '1px solid rgba(0,0,0,0.15)' });
              if (state.dragging) layeredSx.push({ opacity: 0.7 });
              if (state.dropTarget) layeredSx.push({ outline: '2px dashed rgba(25,118,210,0.8)' });
              if (state.disabled) layeredSx.push({ opacity: 0.5, pointerEvents: 'none', filter: 'grayscale(0.2)' });
              if (rowSx) {
                const sx = rowSx(state);
                if (sx) {
                  if (Array.isArray(sx)) {
                    layeredSx.push(...(sx as SxProps<Theme>[]));
                  } else {
                    layeredSx.push(sx);
                  }
                }
              }

              const rowInlineStyle = rowStyle?.(state);
              const sxParts: SxProps<Theme>[] = [];
              if (onRowClick || onRowDoubleClick) {
                sxParts.push({ cursor: 'pointer' });
              }
              if (layeredSx.length > 0) {
                sxParts.push(...layeredSx);
              }
              const sxValue: SxProps<Theme> | undefined = sxParts.length > 0
                ? (sxParts as unknown as SxProps<Theme>)
                : undefined;

              return (
                <TableRow
                  key={rowId}
                  hover={hover}
                  selected={state.selected}
                  onClick={() => !state.disabled && onRowClick?.(row)}
                  onDoubleClick={() => !state.disabled && onRowDoubleClick?.(row)}
                  onMouseEnter={() => !state.disabled && onRowHover?.(row, rowId)}
                  onMouseLeave={() => !state.disabled && onRowLeave?.(row, rowId)}
                  className={rowClassName?.(state)}
                  sx={sxValue}
                  style={rowInlineStyle}
                >
                  {selectable && (
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={state.selected}
                        disabled={state.disabled}
                        onChange={() => handleSelectRow(row, globalRowIndex)}
                      />
                    </TableCell>
                  )}
                  {visibleColumns.map((column) => {
                    const value = getCellValue(row, column.id);
                    const cellContent = column.format ? column.format(value, row) : renderDefaultCell(value);
                    return (
                      <TableCell
                        key={String(column.id)}
                        align={column.align}
                        sx={onCellClick || onCellContextMenu ? { cursor: 'pointer' } : undefined}
                        onClick={(e) => {
                          if (!onCellClick) return;
                          onCellClick({
                            event: e,
                            row,
                            rowId,
                            columnId: String(column.id),
                            value,
                          });
                        }}
                        onContextMenu={(e) => {
                          if (!onCellContextMenu) return;
                          e.preventDefault();
                          onCellContextMenu({
                            event: e,
                            row,
                            rowId,
                            columnId: String(column.id),
                            value,
                          });
                        }}
                      >
                        {cellContent}
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
      {!enableVirtualization && onPageChange && (
        <TablePagination
          component="div"
          count={totalRows ?? filteredRows.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={rowsPerPageOptions}
        />
      )}
    </Box>
  );
}
