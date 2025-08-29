/**
 * GenericDataGrid Component
 * 
 * A completely generic, type-safe data grid component with no application-specific dependencies.
 * This component is purely UI-focused and knows nothing about HierarchiDB's data structures.
 */

import React, { useMemo, useState, useCallback, ReactNode } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  TextField,
  InputAdornment,
  Checkbox,
  LinearProgress,
} from '@mui/material';
import {
  KeyboardArrowUp,
  KeyboardArrowDown,
  Search,
  FilterList,
  Download,
  Refresh,
} from '@mui/icons-material';
import { useVirtualizer } from '@tanstack/react-virtual';

/**
 * Generic column definition
 * @template T The row data type
 */
export interface GridColumn<T = any> {
  /** Unique identifier for the column */
  id: keyof T | string;
  /** Display label */
  label: string;
  /** Column width */
  width?: number | string;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
  /** Custom value formatter */
  format?: (value: any, row: T) => ReactNode;
  /** Enable sorting for this column */
  sortable?: boolean;
  /** Enable filtering for this column */
  filterable?: boolean;
  /** Custom filter predicate */
  filterPredicate?: (value: any, filterValue: string) => boolean;
  /** Hide column */
  hidden?: boolean;
}

/**
 * Generic data grid props
 * @template T The row data type
 */
export interface GenericDataGridProps<T = any> {
  /** Column definitions */
  columns: GridColumn<T>[];
  /** Data rows */
  rows: T[];
  /** Total row count (for server-side pagination) */
  totalRows?: number;
  /** Loading state */
  loading?: boolean;
  /** Error message */
  error?: string;
  
  // Identification
  /** Function to get unique ID for each row */
  getRowId?: (row: T) => string | number;
  
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
  
  // Selection
  /** Enable row selection */
  selectable?: boolean;
  /** Selection mode */
  selectionMode?: 'single' | 'multiple';
  /** Selected row IDs */
  selectedRows?: Set<string | number>;
  /** Selection change handler */
  onSelectionChange?: (selectedRows: Set<string | number>) => void;
  
  // Actions
  /** Export handler */
  onExport?: () => void;
  /** Refresh handler */
  onRefresh?: () => void;
  /** Row click handler */
  onRowClick?: (row: T) => void;
  /** Row double-click handler */
  onRowDoubleClick?: (row: T) => void;
  
  // Virtualization
  /** Enable virtual scrolling */
  enableVirtualization?: boolean;
  /** Row height in pixels */
  rowHeight?: number;
  /** Container max height */
  maxHeight?: number | string;
  
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
  /** Custom empty state component */
  emptyComponent?: ReactNode;
  /** Custom loading component */
  loadingComponent?: ReactNode;
  /** Custom error component */
  errorComponent?: (error: string) => ReactNode;
  /** Custom toolbar component */
  toolbarComponent?: ReactNode;
}

/**
 * Generic data grid component
 */
export function GenericDataGrid<T = any>({
  columns,
  rows,
  totalRows,
  loading = false,
  error,
  getRowId = (row: any, index?: number) => row.id ?? index,
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
  selectable = false,
  selectionMode = 'multiple',
  selectedRows = new Set(),
  onSelectionChange,
  onExport,
  onRefresh,
  onRowClick,
  onRowDoubleClick,
  enableVirtualization = false,
  rowHeight = 52,
  maxHeight = 600,
  dense = false,
  stickyHeader = true,
  showGridLines = false,
  striped = false,
  hover = true,
  emptyComponent,
  loadingComponent,
  errorComponent,
  toolbarComponent,
}: GenericDataGridProps<T>) {
  const [showFilters, setShowFilters] = useState(false);
  const [localSearchValue, setLocalSearchValue] = useState(searchValue);
  
  // Virtual scrolling setup
  const parentRef = React.useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => rowHeight, [rowHeight]),
    overscan: 5,
  });
  
  // Filter rows based on search and filters
  const filteredRows = useMemo(() => {
    let result = [...rows];
    
    // Apply global search
    const searchTerm = onSearchChange ? searchValue : localSearchValue;
    if (searchTerm) {
      result = result.filter(row => {
        return columns.some(col => {
          if (col.hidden) return false;
          const value = (row as any)[col.id];
          if (value == null) return false;
          return String(value).toLowerCase().includes(searchTerm.toLowerCase());
        });
      });
    }
    
    // Apply column filters
    Object.entries(filters).forEach(([columnId, filterValue]) => {
      if (!filterValue) return;
      
      const column = columns.find(c => c.id === columnId);
      if (!column) return;
      
      result = result.filter(row => {
        const value = (row as any)[columnId];
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
      const allIds = new Set(displayRows.map((row, index) => getRowId(row, index)));
      onSelectionChange(allIds);
    } else {
      onSelectionChange(new Set());
    }
  };
  
  const handleSelectRow = (row: T, index: number) => {
    if (!onSelectionChange) return;
    
    const rowId = getRowId(row, index);
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
  
  const visibleColumns = useMemo(
    () => columns.filter(col => !col.hidden),
    [columns]
  );
  
  // Render error state
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
  
  // Render empty state
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
          <TextField
            size="small"
            placeholder="Search..."
            value={onSearchChange ? searchValue : localSearchValue}
            onChange={(e) => {
              if (onSearchChange) {
                onSearchChange(e.target.value);
              } else {
                setLocalSearchValue(e.target.value);
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            sx={{ flexGrow: 1, maxWidth: 400 }}
          />
          
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
          
          <Chip
            label={`${totalRows ?? filteredRows.length} rows`}
            size="small"
            color="primary"
          />
        </Box>
      )}
      
      {/* Loading indicator */}
      {loading && (loadingComponent || <LinearProgress />)}
      
      {/* Table */}
      <TableContainer 
        component={Paper} 
        sx={{ 
          maxHeight: enableVirtualization ? maxHeight : undefined,
          '& .MuiTableCell-root': showGridLines ? { border: '1px solid rgba(224, 224, 224, 1)' } : undefined,
        }}
        ref={enableVirtualization ? parentRef : undefined}
      >
        <Table stickyHeader={stickyHeader} size={dense ? 'small' : 'medium'}>
          <TableHead>
            <TableRow>
              {selectable && (
                <TableCell padding="checkbox">
                  {selectionMode === 'multiple' && (
                    <Checkbox
                      indeterminate={selectedRows.size > 0 && selectedRows.size < displayRows.length}
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
                          sortDirection === 'asc' ? <KeyboardArrowUp /> : <KeyboardArrowDown />
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
              const rowId = getRowId(row, index);
              const isSelected = selectedRows.has(rowId);
              
              return (
                <TableRow
                  key={rowId}
                  hover={hover}
                  selected={isSelected}
                  onClick={() => onRowClick?.(row)}
                  onDoubleClick={() => onRowDoubleClick?.(row)}
                  sx={{
                    backgroundColor: striped && index % 2 === 0 ? 'action.hover' : undefined,
                    cursor: onRowClick || onRowDoubleClick ? 'pointer' : undefined,
                  }}
                >
                  {selectable && (
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={isSelected}
                        onChange={() => handleSelectRow(row, index)}
                      />
                    </TableCell>
                  )}
                  {visibleColumns.map((column) => {
                    const value = (row as any)[column.id];
                    return (
                      <TableCell key={String(column.id)} align={column.align}>
                        {column.format ? column.format(value, row) : value}
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