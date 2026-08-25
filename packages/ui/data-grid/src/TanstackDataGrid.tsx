import {
  Box,
  Checkbox,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  type ColumnDef,
  type ColumnSizingState,
  flexRender,
  type GroupingState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { GridColumn } from './GenericDataGrid.js';
import { useTanstackDataGridView } from './useTanstackDataGridView.js';

type RowRecord = { id?: string | number } & Record<PropertyKey, unknown>;

export type GridSortingState = SortingState;
export type GridGroupingState = GroupingState;
export type GridColumnSizingState = ColumnSizingState;
export type GridColumnVisibilityState = VisibilityState;

export type GridCellEditParams<T extends RowRecord> = {
  row: T;
  rowId: string | number;
  columnId: string;
  previousValue: unknown;
  value: string;
};

export type GridCellEditCommitResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
    };

export type GridCellEditPhase =
  | 'start'
  | 'dirty'
  | 'pending'
  | 'success'
  | 'failure'
  | 'cancel'
  | 'rollback';

export type GridCellEditState = {
  phase: 'editing' | 'dirty' | 'pending' | 'failure';
  error?: string;
};

export type GridCellEditStateChange<T extends RowRecord> = {
  row: T;
  rowId: string | number;
  columnId: string;
  phase: GridCellEditPhase;
  previousValue: unknown;
  value: string;
  error?: string;
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
  onCellEdit?: (
    params: GridCellEditParams<T>
  ) => void | GridCellEditCommitResult | Promise<void | GridCellEditCommitResult>;
  onCellEditStateChange?: (state: GridCellEditStateChange<T>) => void;
  loading?: boolean;
  error?: string;
  emptyComponent?: React.ReactNode;
};

type EditingCell<T extends RowRecord> = {
  rowId: string | number;
  columnId: string;
  value: string;
  previousValue: unknown;
  row: T;
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

const toCellKey = (rowId: string | number, columnId: string): string =>
  `${String(rowId)}\u0000${columnId}`;

const isFailedEditResult = (
  result: void | GridCellEditCommitResult
): result is Extract<GridCellEditCommitResult, { ok: false }> =>
  typeof result === 'object' && result !== null && result.ok === false;

export function TanstackDataGrid<T extends RowRecord>(
  props: TanstackDataGridProps<T>
): React.ReactElement {
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
    onCellEditStateChange,
    loading,
    error,
    emptyComponent,
  } = props;

  const [editingCell, setEditingCell] = useState<EditingCell<T> | null>(null);
  const editingCellRef = useRef<EditingCell<T> | null>(null);
  const [cellEditStates, setCellEditStates] = useState<Record<string, GridCellEditState>>({});
  const closedEditCellRef = useRef<string | null>(null);

  const hasPendingEdit = useMemo(
    () => Object.values(cellEditStates).some((state) => state.phase === 'pending'),
    [cellEditStates]
  );

  const emitCellEditStateChange = useCallback(
    (state: GridCellEditStateChange<T>) => {
      onCellEditStateChange?.(state);
    },
    [onCellEditStateChange]
  );

  const clearCellEditState = useCallback((cellKey: string) => {
    setCellEditStates((prev) => {
      if (!Object.hasOwn(prev, cellKey)) return prev;
      const { [cellKey]: _removed, ...next } = prev;
      return next;
    });
  }, []);

  const beginCellEdit = useCallback(
    (row: T, rowId: string | number, columnId: string, value: unknown) => {
      if (editingCell || hasPendingEdit) return;
      const initialValue = value == null ? '' : String(value);
      const cellKey = toCellKey(rowId, columnId);
      closedEditCellRef.current = null;
      const nextEditingCell: EditingCell<T> = {
        rowId,
        columnId,
        value: initialValue,
        previousValue: value,
        row,
      };
      editingCellRef.current = nextEditingCell;
      setEditingCell(nextEditingCell);
      setCellEditStates((prev) => ({
        ...prev,
        [cellKey]: { phase: 'editing' },
      }));
      emitCellEditStateChange({
        row,
        rowId,
        columnId,
        phase: 'start',
        previousValue: value,
        value: initialValue,
      });
    },
    [editingCell, emitCellEditStateChange, hasPendingEdit]
  );

  const updateEditingCellValue = useCallback(
    (value: string) => {
      setEditingCell((prev) => {
        if (!prev) return prev;
        const cellKey = toCellKey(prev.rowId, prev.columnId);
        const nextPhase = value === String(prev.previousValue ?? '') ? 'editing' : 'dirty';
        setCellEditStates((states) => ({
          ...states,
          [cellKey]: { phase: nextPhase },
        }));
        emitCellEditStateChange({
          row: prev.row,
          rowId: prev.rowId,
          columnId: prev.columnId,
          phase: 'dirty',
          previousValue: prev.previousValue,
          value,
        });
        const next = { ...prev, value };
        editingCellRef.current = next;
        return next;
      });
    },
    [emitCellEditStateChange]
  );

  const cancelCellEdit = useCallback(() => {
    const current = editingCellRef.current;
    if (!current) return;
    const cellKey = toCellKey(current.rowId, current.columnId);
    closedEditCellRef.current = cellKey;
    emitCellEditStateChange({
      row: current.row,
      rowId: current.rowId,
      columnId: current.columnId,
      phase: 'cancel',
      previousValue: current.previousValue,
      value: current.value,
    });
    editingCellRef.current = null;
    clearCellEditState(cellKey);
    setEditingCell(null);
  }, [clearCellEditState, emitCellEditStateChange]);

  const commitCellEdit = useCallback(async () => {
    const current = editingCellRef.current;
    if (!current || !onCellEdit) return;
    const cellKey = toCellKey(current.rowId, current.columnId);
    if (closedEditCellRef.current === cellKey) {
      closedEditCellRef.current = null;
      return;
    }
    closedEditCellRef.current = cellKey;
    editingCellRef.current = null;
    setEditingCell(null);
    setCellEditStates((prev) => ({
      ...prev,
      [cellKey]: { phase: 'pending' },
    }));
    emitCellEditStateChange({
      row: current.row,
      rowId: current.rowId,
      columnId: current.columnId,
      phase: 'pending',
      previousValue: current.previousValue,
      value: current.value,
    });

    const result = await onCellEdit({
      row: current.row,
      rowId: current.rowId,
      columnId: current.columnId,
      previousValue: current.previousValue,
      value: current.value,
    });

    if (isFailedEditResult(result)) {
      setCellEditStates((prev) => ({
        ...prev,
        [cellKey]: { phase: 'failure', error: result.error },
      }));
      emitCellEditStateChange({
        row: current.row,
        rowId: current.rowId,
        columnId: current.columnId,
        phase: 'failure',
        previousValue: current.previousValue,
        value: current.value,
        error: result.error,
      });
      emitCellEditStateChange({
        row: current.row,
        rowId: current.rowId,
        columnId: current.columnId,
        phase: 'rollback',
        previousValue: current.previousValue,
        value: String(current.previousValue ?? ''),
        error: result.error,
      });
      return;
    }

    emitCellEditStateChange({
      row: current.row,
      rowId: current.rowId,
      columnId: current.columnId,
      phase: 'success',
      previousValue: current.previousValue,
      value: current.value,
    });
    clearCellEditState(cellKey);
  }, [clearCellEditState, emitCellEditStateChange, onCellEdit]);

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
          const cellKey = toCellKey(info.row.id, id);
          const editState = cellEditStates[cellKey];
          if (column.editable && onCellEdit) {
            if (isEditing) {
              return (
                <input
                  value={editingCell?.value ?? ''}
                  onChange={(event) => {
                    updateEditingCellValue(event.target.value);
                  }}
                  onBlur={() => {
                    void commitCellEdit();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      cancelCellEdit();
                      return;
                    }
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    void commitCellEdit();
                  }}
                  autoFocus
                  style={{
                    width: '100%',
                    minWidth: 96,
                    height: 30,
                    boxSizing: 'border-box',
                    border: `1px solid ${theme.palette.primary.main}`,
                    borderRadius: 4,
                    padding: '0 8px',
                    font: 'inherit',
                    color: 'inherit',
                    backgroundColor: theme.palette.background.paper,
                    outline: 'none',
                  }}
                />
              );
            }
            return (
              <Box
                onDoubleClick={() => {
                  beginCellEdit(row, info.row.id, id, value);
                }}
                data-edit-state={editState?.phase}
                title={editState?.error}
                sx={{
                  cursor: hasPendingEdit ? 'default' : 'text',
                  color: editState?.phase === 'failure' ? 'error.main' : undefined,
                  fontStyle: editState?.phase === 'dirty' ? 'italic' : undefined,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                {editState?.phase === 'pending' ? <CircularProgress size={12} /> : null}
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
      header: ({ table }) =>
        selectionMode === 'multiple' ? (
          <Checkbox
            size="small"
            indeterminate={table.getIsSomeRowsSelected()}
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
          />
        ) : null,
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
  }, [
    beginCellEdit,
    cancelCellEdit,
    cellEditStates,
    columns,
    commitCellEdit,
    editingCell,
    hasPendingEdit,
    onCellEdit,
    selectable,
    selectionMode,
    theme.palette.background.paper,
    theme.palette.primary.main,
    updateEditingCellValue,
  ]);

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
    getRowId:
      (getRowId as ((row: RowRecord, index?: number) => string | number) | undefined) ??
      toDefaultRowId,
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
                  const meta = header.column.columnDef.meta as
                    | { align?: 'left' | 'center' | 'right' }
                    | undefined;
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
                                sx={{
                                  color: sortState === 'asc' ? 'text.primary' : 'text.disabled',
                                }}
                              >
                                ▲
                              </Box>
                              <Box
                                component="span"
                                sx={{
                                  color: sortState === 'desc' ? 'text.primary' : 'text.disabled',
                                }}
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
                <TableCell
                  colSpan={leafColumnCount}
                  sx={{ height: paddingTop, padding: 0, border: 0 }}
                />
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
                    const groupToggleColor = isAdminLevelGroup
                      ? theme.palette.primary.main
                      : 'inherit';
                    const groupedLabel = isGrouped
                      ? `${cell.getValue() ?? ''} (${row.subRows.length})`
                      : null;
                    return (
                      <TableCell
                        key={cell.id}
                        align={
                          (
                            cell.column.columnDef.meta as
                              | { align?: 'left' | 'center' | 'right' }
                              | undefined
                          )?.align ?? 'left'
                        }
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
                <TableCell
                  colSpan={leafColumnCount}
                  sx={{ height: paddingBottom, padding: 0, border: 0 }}
                />
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
