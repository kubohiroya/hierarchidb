import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getSortedRowModel,
  useReactTable,
  type Header,
  type ColumnDef,
  type ColumnSizingState,
  type GroupingState,
  type RowSelectionState,
  type SortingState,
  type Updater,
  type VisibilityState,
} from '@tanstack/react-table';
import type { GridColumn } from './GenericDataGrid.js';

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

const resolveUpdater = <T,>(updater: Updater<T>, prev: T): T => (
  typeof updater === 'function' ? (updater as (value: T) => T)(prev) : updater
);

const MIN_COLUMN_WIDTH = 60;

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

  const [internalSorting, setInternalSorting] = useState<GridSortingState>(sorting ?? []);
  const [internalGrouping, setInternalGrouping] = useState<GridGroupingState>(grouping ?? []);
  const [internalColumnVisibility, setInternalColumnVisibility] = useState<GridColumnVisibilityState>(columnVisibility ?? {});
  const [internalColumnSizing, setInternalColumnSizing] = useState<GridColumnSizingState>(columnSizing ?? {});
  const [internalSelectedRows, setInternalSelectedRows] = useState<Set<string | number>>(selectedRows ?? new Set());
  const [editingCell, setEditingCell] = useState<{ rowId: string | number; columnId: string; value: string } | null>(null);
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
  const normalizedSelectedRows = useMemo(() => (
    new Set(Array.from(resolvedSelectedRows).map(String))
  ), [resolvedSelectedRows]);
  const normalizedMatchedRows = useMemo(() => (
    matchedRows ? new Set(Array.from(matchedRows).map(String)) : undefined
  ), [matchedRows]);
  const normalizedHoveredRows = useMemo(() => (
    hoveredRows ? new Set(Array.from(hoveredRows).map(String)) : undefined
  ), [hoveredRows]);
  const normalizedDraggingRows = useMemo(() => (
    draggingRows ? new Set(Array.from(draggingRows).map(String)) : undefined
  ), [draggingRows]);
  const normalizedDropTargetRows = useMemo(() => (
    dropTargetRows ? new Set(Array.from(dropTargetRows).map(String)) : undefined
  ), [dropTargetRows]);

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

  const handleResizeStart = useCallback((
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
    columns: columnDefs,
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
          maxHeight: enableVirtualization ? maxHeight : undefined,
          overflow: 'auto',
        }}
      >
        <Table size="small" sx={{ tableLayout: 'fixed', width: 'max-content', minWidth: '100%' }}>
          <TableBody>
            {enableVirtualization && paddingTop > 0 ? (
              <TableRow>
                <TableCell colSpan={table.getAllLeafColumns().length} sx={{ height: paddingTop, padding: 0, border: 0 }} />
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
                  onMouseEnter={() => onRowHover?.(row.original, rowId)}
                  onMouseLeave={() => onRowLeave?.(row.original, rowId)}
                  onClick={() => onRowClick?.(row.original, rowId)}
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
                          onCellClick?.({ row: row.original, columnId });
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
                <TableCell colSpan={table.getAllLeafColumns().length} sx={{ height: paddingBottom, padding: 0, border: 0 }} />
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
