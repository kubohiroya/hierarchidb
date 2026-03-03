import React, { useMemo, useState } from 'react';
import {
  Box,
  Checkbox,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  flexRender,
  type ColumnSizingState,
  type ColumnDef,
  type GroupingState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import type { GridColumn } from './GenericDataGrid.js';
import { useTanstackDataGridView } from './useTanstackDataGridView.js';

type RowRecord = { id?: string | number } & Record<PropertyKey, unknown>;

export type GridSortingState = SortingState;
export type GridGroupingState = GroupingState;
export type GridColumnSizingState = ColumnSizingState;
export type GridColumnVisibilityState = VisibilityState;

export type GridCellEditParams<T extends RowRecord> = {
  row: T;
  columnId: string;
  value: string;
};

export type GridCellClickParams<T extends RowRecord> = {
  row: T;
  columnId: string;
};

export type GridRowState = {
  selected: boolean;
  matched: boolean;
  hovered: boolean;
  dragging: boolean;
  dropTarget: boolean;
};

export type TanstackDataGridProps<T extends RowRecord> = {
  columns: GridColumn<T>[];
  rows: T[];
  getRowId?: (row: T, index?: number) => string | number;
  maxHeight?: number | string;
  rowHeight?: number;
  enableVirtualization?: boolean;
  selectable?: boolean;
  selectionMode?: 'single' | 'multiple';
  selectedRows?: Set<string | number>;
  onSelectionChange?: (selected: Set<string | number>) => void;
  matchedRows?: Set<string | number>;
  hoveredRows?: Set<string | number>;
  draggingRows?: Set<string | number>;
  dropTargetRows?: Set<string | number>;
  rowSx?: (state: GridRowState) => Record<string, unknown> | undefined;
  onRowHover?: (row: T, rowId: string | number) => void;
  onRowLeave?: (row: T, rowId: string | number) => void;
  onRowClick?: (row: T, rowId: string | number) => void;
  onCellClick?: (params: GridCellClickParams<T>) => void;
  sorting?: GridSortingState;
  onSortingChange?: (sorting: GridSortingState) => void;
  grouping?: GridGroupingState;
  onGroupingChange?: (grouping: GridGroupingState) => void;
  columnVisibility?: GridColumnVisibilityState;
  onColumnVisibilityChange?: (visibility: GridColumnVisibilityState) => void;
  columnSizing?: GridColumnSizingState;
  onColumnSizingChange?: (sizing: GridColumnSizingState) => void;
  globalFilter?: string;
  onGlobalFilterChange?: (value: string) => void;
  onCellEdit?: (params: GridCellEditParams<T>) => void;
  loading?: boolean;
  error?: string;
  emptyComponent?: React.ReactNode;
};

const getCellValue = <T extends RowRecord>(row: T, columnId: GridColumn<T>['id']): unknown => {
  const propertyKey = columnId as PropertyKey;
  return Object.hasOwn(row, propertyKey) ? row[propertyKey] : undefined;
};

const toDefaultRowId = <T extends RowRecord>(row: T, index?: number): string | number => {
  const candidate = row.id;
  if (typeof candidate === 'string' || typeof candidate === 'number') {
    return candidate;
  }
  return index ?? 0;
};

const renderDefaultCell = (value: unknown): React.ReactNode => {
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

export function TanstackDataGrid<T extends RowRecord>(props: TanstackDataGridProps<T>): React.ReactElement {
  const theme = useTheme();
  const {
    columns,
    rows,
    getRowId,
    maxHeight,
    rowHeight = 36,
    enableVirtualization = false,
    selectable = false,
    selectionMode = 'multiple',
    selectedRows,
    onSelectionChange,
    matchedRows,
    hoveredRows,
    draggingRows,
    dropTargetRows,
    rowSx,
    onRowHover,
    onRowLeave,
    onRowClick,
    onCellClick,
    sorting,
    onSortingChange,
    grouping,
    onGroupingChange,
    columnVisibility,
    onColumnVisibilityChange,
    columnSizing,
    onColumnSizingChange,
    globalFilter,
    onGlobalFilterChange,
    onCellEdit,
    loading,
    error,
    emptyComponent,
  } = props;

  const [editingCell, setEditingCell] = useState<{ rowId: string | number; columnId: string; value: string } | null>(null);
  const columnDefs = useMemo<ColumnDef<T>[]>(() => {
    const baseColumns = columns.map((column): ColumnDef<T> => {
      const id = String(column.id);
      return {
        id,
        accessorFn: (row) => getCellValue(row, column.id),
        header: column.label,
        enableSorting: Boolean(column.sortable),
        enableGrouping: Boolean(column.groupingValue),
        getGroupingValue: column.groupingValue
          ? (row) => column.groupingValue?.(row) ?? null
          : undefined,
        size: typeof column.width === 'number' ? column.width : undefined,
        cell: (info) => {
          const row = info.row.original;
          const value = info.getValue();
          const isEditing = editingCell?.rowId === info.row.id && editingCell?.columnId === id;
          if (column.editable && onCellEdit) {
            if (isEditing) {
              return (
                <TextField
                  value={editingCell?.value ?? ''}
                  size="small"
                  onChange={(event) => {
                    setEditingCell((prev) => prev ? { ...prev, value: event.target.value } : prev);
                  }}
                  onBlur={() => {
                    if (!editingCell) return;
                    onCellEdit({
                      row,
                      columnId: id,
                      value: editingCell.value,
                    });
                    setEditingCell(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    onCellEdit({
                      row,
                      columnId: id,
                      value: editingCell?.value ?? '',
                    });
                    setEditingCell(null);
                  }}
                />
              );
            }
            return (
              <Box
                onDoubleClick={() => {
                  setEditingCell({
                    rowId: info.row.id,
                    columnId: id,
                    value: value == null ? '' : String(value),
                  });
                }}
                sx={{ cursor: 'text' }}
              >
                {column.format ? column.format(value, row) : renderDefaultCell(value)}
              </Box>
            );
          }
          return column.format ? column.format(value, row) : renderDefaultCell(value);
        },
        meta: {
          align: column.align ?? 'left',
          width: column.width,
        },
      };
    });

    if (!selectable) return baseColumns;
    const selectionColumn: ColumnDef<T> = {
      id: '__select',
      header: ({ table }) => (
        selectionMode === 'multiple' ? (
          <Checkbox
            size="small"
            indeterminate={table.getIsSomeRowsSelected()}
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
          />
        ) : null
      ),
      cell: ({ row }) => (
        <Checkbox
          size="small"
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          indeterminate={row.getIsSomeSelected()}
          onChange={row.getToggleSelectedHandler()}
        />
      ),
      enableSorting: false,
      enableResizing: false,
      size: 48,
    };
    return [selectionColumn, ...baseColumns];
  }, [columns, editingCell, onCellEdit, selectable, selectionMode]);

  const {
    bodyContainerRef,
    handleResizeStart,
    headerContainerRef,
    leafColumnCount,
    measureRowElement,
    normalizedDraggingRows,
    normalizedDropTargetRows,
    normalizedHoveredRows,
    normalizedMatchedRows,
    normalizedSelectedRows,
    rowModel,
    table,
    virtualRows,
    paddingTop,
    paddingBottom,
  } = useTanstackDataGridView({
    columns: columnDefs as ColumnDef<RowRecord>[],
    rows: rows as RowRecord[],
    getRowId: (getRowId as ((row: RowRecord, index?: number) => string | number) | undefined) ?? toDefaultRowId,
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
  });

  if (loading) {
    return (
      <Box p={2}>
        <Typography variant="body2" color="text.secondary">
          Loading...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={2}>
        <Typography variant="body2" color="error">
          {error}
        </Typography>
      </Box>
    );
  }

  if (rows.length === 0 && emptyComponent) {
    return <>{emptyComponent}</>;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Box ref={headerContainerRef} sx={{ overflow: 'hidden' }}>
        <Table size="small" sx={{ tableLayout: 'fixed', width: 'max-content', minWidth: '100%' }}>
          <TableHead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header, headerIndex) => {
                      const meta = header.column.columnDef.meta as { align?: 'left' | 'center' | 'right' } | undefined;
                      const canSort = header.column.getCanSort();
                      const sortState = header.column.getIsSorted();
                      const isSelectionColumn = header.column.id === '__select';
                      const rightNeighbor = headerGroup.headers[headerIndex + 1];
                      return (
                        <TableCell
                          key={header.id}
                          align={meta?.align ?? 'left'}
                          padding={isSelectionColumn ? 'checkbox' : 'normal'}
                          sx={{
                            position: 'relative',
                            width: header.getSize(),
                            maxWidth: header.getSize(),
                            fontWeight: 'bold',
                            py: 0.5,
                            px: isSelectionColumn ? 0.5 : 1,
                            whiteSpace: 'nowrap',
                            overflow: isSelectionColumn ? 'visible' : 'hidden',
                            textOverflow: isSelectionColumn ? 'clip' : 'ellipsis',
                          }}
                        >
                          {header.isPlaceholder ? null : (
                            <Box
                              display="flex"
                              alignItems="center"
                              justifyContent={isSelectionColumn ? 'center' : 'flex-start'}
                              gap={1}
                              sx={{ cursor: canSort ? 'pointer' : 'default', userSelect: 'none' }}
                              onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort ? (
                            <Box
                              component="span"
                              sx={{
                                display: 'inline-flex',
                                flexDirection: 'column',
                                lineHeight: 1,
                                fontSize: 10,
                              }}
                            >
                              <Box
                                component="span"
                                sx={{ color: sortState === 'asc' ? 'text.primary' : 'text.disabled' }}
                              >
                                ▲
                              </Box>
                              <Box
                                component="span"
                                sx={{ color: sortState === 'desc' ? 'text.primary' : 'text.disabled' }}
                              >
                                ▼
                              </Box>
                            </Box>
                          ) : null}
                        </Box>
                      )}
                      {header.column.getCanResize() && rightNeighbor ? (
                        <Box
                          onMouseDown={(event) => {
                            handleResizeStart(header, rightNeighbor, event);
                          }}
                          sx={{
                            position: 'absolute',
                            right: 0,
                            top: 0,
                            height: '100%',
                            width: 6,
                            cursor: 'col-resize',
                            userSelect: 'none',
                          }}
                        />
                      ) : null}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableHead>
        </Table>
      </Box>
      <TableContainer
        component={Paper}
        ref={bodyContainerRef}
        sx={{
          flex: 1,
          minHeight: 0,
          height: enableVirtualization ? (maxHeight ?? '100%') : undefined,
          maxHeight: enableVirtualization ? maxHeight : undefined,
          overflow: 'auto',
        }}
      >
        <Table size="small" sx={{ tableLayout: 'fixed', width: 'max-content', minWidth: '100%' }}>
          <TableBody>
            {enableVirtualization && paddingTop > 0 ? (
              <TableRow>
                <TableCell colSpan={leafColumnCount} sx={{ height: paddingTop, padding: 0, border: 0 }} />
              </TableRow>
            ) : null}
            {virtualRows.map((virtualRow) => {
              const row = rowModel[virtualRow.index];
              if (!row) return null;
              const rowId = row.id;
              const state: GridRowState = {
                selected: normalizedSelectedRows.has(rowId),
                matched: normalizedMatchedRows?.has(rowId) ?? false,
                hovered: normalizedHoveredRows?.has(rowId) ?? false,
                dragging: normalizedDraggingRows?.has(rowId) ?? false,
                dropTarget: normalizedDropTargetRows?.has(rowId) ?? false,
              };
              const sx = rowSx?.(state);
              return (
                <TableRow
                  key={row.id}
                  hover
                  sx={sx}
                  ref={measureRowElement}
                  data-index={enableVirtualization ? virtualRow.index : undefined}
                  onMouseEnter={() => onRowHover?.(row.original as T, rowId)}
                  onMouseLeave={() => onRowLeave?.(row.original as T, rowId)}
                  onClick={() => onRowClick?.(row.original as T, rowId)}
                >
                  {row.getVisibleCells().map((cell) => {
                    const isSelectionColumn = cell.column.id === '__select';
                    const isGrouped = cell.getIsGrouped();
                    const isAggregated = cell.getIsAggregated();
                    const isPlaceholder = cell.getIsPlaceholder();
                    const isAdminLevelGroup = isGrouped && cell.column.id === 'adminLevel';
                    const groupToggleColor = isAdminLevelGroup ? theme.palette.primary.main : 'inherit';
                    const groupedLabel = isGrouped
                      ? `${cell.getValue() ?? ''} (${row.subRows.length})`
                      : null;
                    return (
                      <TableCell
                        key={cell.id}
                        align={(cell.column.columnDef.meta as { align?: 'left' | 'center' | 'right' } | undefined)?.align ?? 'left'}
                        padding={isSelectionColumn ? 'checkbox' : 'normal'}
                        sx={{
                          width: cell.column.getSize(),
                          maxWidth: cell.column.getSize(),
                          py: 0.5,
                          px: isSelectionColumn ? 0.5 : 1,
                          whiteSpace: 'nowrap',
                          overflow: isSelectionColumn ? 'visible' : 'hidden',
                          textOverflow: isSelectionColumn ? 'clip' : 'ellipsis',
                        }}
                        onClick={(event) => {
                          event.stopPropagation();
                          const columnId = String(cell.column.id);
                          onCellClick?.({ row: row.original as T, columnId });
                        }}
                      >
                        {isGrouped ? (
                          <Box display="flex" alignItems="center" gap={1}>
                            <Box
                              component="button"
                              type="button"
                              onClick={row.getToggleExpandedHandler()}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                padding: 0,
                                color: groupToggleColor,
                              }}
                            >
                              {row.getIsExpanded() ? '▼' : '▶'}
                            </Box>
                            <span>{groupedLabel}</span>
                          </Box>
                        ) : isAggregated ? (
                          flexRender(cell.column.columnDef.cell, cell.getContext())
                        ) : isPlaceholder ? null : (
                          flexRender(cell.column.columnDef.cell, cell.getContext())
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
            {enableVirtualization && paddingBottom > 0 ? (
              <TableRow>
                <TableCell colSpan={leafColumnCount} sx={{ height: paddingBottom, padding: 0, border: 0 }} />
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
