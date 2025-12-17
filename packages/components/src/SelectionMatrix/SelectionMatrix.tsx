/**
 * Generic Selection Matrix Component
 * Reusable checkbox matrix for multi-dimensional selection
 */

import type React from 'react';
import { useCallback, useMemo, forwardRef } from 'react';
import {
  Box,
  Checkbox,
  Chip,
  Table,
  TableBody,
  TableContainer,
  TableHead,
  Paper,
  TableCell,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { TableVirtuoso, type ItemProps, type TableComponents } from 'react-virtuoso';

export interface SelectionMatrixColumn {
  id: string;
  label: string;
  description?: string;
  width?: number;
}

export interface SelectionMatrixRow<T = any> {
  id: string;
  label: string;
  subLabel?: string;
  data: T;
  disabled?: boolean;
  tooltip?: string;
}

export interface SelectionMatrixProps<T = any> {
  rows: SelectionMatrixRow<T>[];
  columns: SelectionMatrixColumn[];
  state: boolean[][];
  onChange: (rowIndex: number, colIndex: number, checked: boolean) => void;
  onSelectAll?: (colIndex: number, checked: boolean, enabledRowIndices: number[]) => void;
  onSelectRow?: (rowIndex: number, checked: boolean, enabledColumnIndices: number[]) => void;
  showRowSelection?: boolean;
  showColumnSelection?: boolean;
  showSelectionCount?: boolean;
  maxHeight?: number;
  stickyHeader?: boolean;
  dense?: boolean;
  rowHeaderLabel?: string;
  isCellEnabled?: (
    row: SelectionMatrixRow<T>,
    column: SelectionMatrixColumn,
    rowIndex: number,
    colIndex: number,
  ) => boolean;
  renderUnavailableCell?: (row: SelectionMatrixRow<T>, column: SelectionMatrixColumn) => React.ReactNode;
  getRowProps?: (
    row: SelectionMatrixRow<T>,
    rowIndex: number,
  ) => React.HTMLAttributes<HTMLTableRowElement>;
  /** Optional row height for virtualization */
  rowHeight?: number;
}

export function SelectionMatrix<T = any>({
                                           rows,
                                           columns,
                                           state,
                                           onChange,
                                           onSelectAll,
                                           onSelectRow,
                                           showRowSelection = false,
                                           showColumnSelection = true,
                                           showSelectionCount = true,
                                           maxHeight = 400,
                                           stickyHeader = true,
                                           dense = false,
                                           rowHeaderLabel = 'Region',
                                           isCellEnabled = () => true,
                                           renderUnavailableCell = () => (
                                             <Typography variant="caption" color="text.disabled">
                                               -
                                             </Typography>
                                           ),
                                           getRowProps,
                                           rowHeight = 48,
                                         }: SelectionMatrixProps<T>): React.ReactElement {
  // Calculate selection counts
  const columnCounts = useMemo(() => {
    return columns.map((column, colIndex) =>
      state.reduce((count, row, rowIndex) => {
        const rowDef = rows[rowIndex];
        if (!rowDef || !isCellEnabled(rowDef, column, rowIndex, colIndex)) return count;
        return count + (row[colIndex] ? 1 : 0);
      }, 0),
    );
  }, [columns, isCellEnabled, rows, state]);

  const rowCounts = useMemo(() => {
    return rows.map((row, rowIndex) =>
      state[rowIndex]?.reduce((count, cell, colIndex) => {
        const column = columns[colIndex];
        if (!column || !isCellEnabled(row, column, rowIndex, colIndex)) return count;
        return count + (cell ? 1 : 0);
      }, 0) || 0,
    );
  }, [columns, isCellEnabled, rows, state]);

  // Check if entire column is selected
  const isColumnSelected = useCallback((colIndex: number) => {
    let enabled = 0;
    const allSelected = rows.every((row, rowIndex) => {
      const column = columns[colIndex];
      if (!column) return false;
      if (!isCellEnabled(row, column, rowIndex, colIndex)) return true;
      enabled += 1;
      return Boolean(state[rowIndex]?.[colIndex]);
    });
    return enabled > 0 && allSelected;
  }, [columns, isCellEnabled, rows, state]);

  // Check if entire column is indeterminate
  const isColumnIndeterminate = useCallback((colIndex: number) => {
    let enabled = 0;
    let selected = 0;
    rows.forEach((row, rowIndex) => {
      const column = columns[colIndex];
      if (!column) return;
      if (!row || !isCellEnabled(row, column, rowIndex, colIndex)) return;
      enabled += 1;
      if (state[rowIndex]?.[colIndex]) selected += 1;
    });
    return enabled > 0 && selected > 0 && selected < enabled;
  }, [columns, isCellEnabled, rows, state]);

  // Check if entire row is selected
  const isRowSelected = useCallback((rowIndex: number) => {
    let enabled = 0;
    const allSelected = columns.every((column, colIndex) => {
      const row = rows[rowIndex];
      if (!row) return false;
      if (!isCellEnabled(row, column, rowIndex, colIndex)) return true;
      enabled += 1;
      return Boolean(state[rowIndex]?.[colIndex]);
    });
    return enabled > 0 && allSelected;
  }, [columns, isCellEnabled, rows, state]);

  // Check if entire row is indeterminate
  const isRowIndeterminate = useCallback((rowIndex: number) => {
    let enabled = 0;
    let selected = 0;
    const row = rows[rowIndex];
    columns.forEach((column, colIndex) => {
      if (!row || !isCellEnabled(row, column, rowIndex, colIndex)) return;
      enabled += 1;
      if (state[rowIndex]?.[colIndex]) selected += 1;
    });
    return enabled > 0 && selected > 0 && selected < enabled;
  }, [columns, isCellEnabled, rows, state]);

  // Handle column header checkbox click
  const handleColumnSelectAll = useCallback((colIndex: number) => {
    if (onSelectAll) {
      const isSelected = isColumnSelected(colIndex);
      const enabledRows = rows
        .map((row, rowIndex) => ({ row, rowIndex }))
        .filter(({ row }, rowIndex) => {
          const column = columns[colIndex];
          return column ? isCellEnabled(row, column, rowIndex, colIndex) : false;
        })
        .map(({ rowIndex }) => rowIndex);
      onSelectAll(colIndex, !isSelected, enabledRows);
    }
  }, [columns, isCellEnabled, isColumnSelected, onSelectAll, rows]);

  // Handle row checkbox click
  const handleRowSelectAll = useCallback((rowIndex: number) => {
    if (onSelectRow) {
      const isSelected = isRowSelected(rowIndex);
      const enabledColumns = columns
        .map((column, colIndex) => ({ column, colIndex }))
        .filter(({ column }, colIndex) => {
          const row = rows[rowIndex];
          return row && isCellEnabled(row, column, rowIndex, colIndex);
        })
        .map(({ colIndex }) => colIndex);
      onSelectRow(rowIndex, !isSelected, enabledColumns);
    }
  }, [columns, isCellEnabled, isRowSelected, onSelectRow, rows]);

  const renderHeader = () => (
    <TableRow>
      {showRowSelection && (
        <TableCell padding="checkbox" sx={{ width: 50 }} />
      )}
      <TableCell sx={{ minWidth: 200 }}>
        <Typography variant="subtitle2">{rowHeaderLabel}</Typography>
      </TableCell>
      {columns.map((column, colIndex) => (
        <TableCell
          key={column.id}
          align="center"
          sx={{ width: column.width || 120 }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {showColumnSelection && onSelectAll && (
              <Checkbox
                checked={isColumnSelected(colIndex)}
                indeterminate={isColumnIndeterminate(colIndex)}
                onChange={() => handleColumnSelectAll(colIndex)}
                disabled={
                  !rows.some((row, rowIndex) =>
                    isCellEnabled(row, column, rowIndex, colIndex),
                  )
                }
                size="small"
              />
            )}
            {column.description ? (
              <Tooltip title={column.description}>
                <Typography variant="caption" sx={{ cursor: 'help' }}>
                  {column.label}
                </Typography>
              </Tooltip>
            ) : (
              <Typography variant="caption">
                {column.label}
              </Typography>
            )}
            {showSelectionCount && (
              <Chip
                label={columnCounts[colIndex]}
                size="small"
                variant="outlined"
                sx={{ mt: 0.5, minWidth: 32, height: 20 }}
              />
            )}
          </Box>
        </TableCell>
      ))}
      {showSelectionCount && (
        <TableCell align="center" sx={{ width: 80 }}>
          <Typography variant="caption">Selected</Typography>
        </TableCell>
      )}
    </TableRow>
  );

  const renderRowContent = (rowIndex: number) => {
    const row = rows[rowIndex];
    if (!row) {
      return null;
    }
    return (
      <>
        {showRowSelection && (
          <TableCell padding="checkbox">
            <Checkbox
              checked={isRowSelected(rowIndex)}
              indeterminate={isRowIndeterminate(rowIndex)}
              onChange={() => handleRowSelectAll(rowIndex)}
              disabled={
                row.disabled ||
                !columns.some((column, colIndex) =>
                  isCellEnabled(row, column, rowIndex, colIndex),
                )
              }
              size="small"
            />
          </TableCell>
        )}
        <TableCell>
          <Box>
            {row.tooltip ? (
              <Tooltip title={row.tooltip}>
                <Typography variant="body2" sx={{ cursor: 'help' }}>
                  {row.label}
                </Typography>
              </Tooltip>
            ) : (
              <Typography variant="body2">
                {row.label}
              </Typography>
            )}
            {row.subLabel && (
              <Typography variant="caption" color="text.secondary">
                {row.subLabel}
              </Typography>
            )}
          </Box>
        </TableCell>
        {columns.map((column, colIndex) => (
          <TableCell key={column.id} align="center" padding="checkbox">
            {isCellEnabled(row, column, rowIndex, colIndex) ? (
              <Checkbox
                checked={state[rowIndex]?.[colIndex] || false}
                onChange={(e) => onChange(rowIndex, colIndex, e.target.checked)}
                disabled={row.disabled}
                size="small"
                inputProps={{
                  'aria-label': `${row.label} ${column.label}`,
                }}
              />
            ) : (
              renderUnavailableCell(row, column)
            )}
          </TableCell>
        ))}
        {showSelectionCount && (
          <TableCell align="center">
            <Chip
              label={rowCounts[rowIndex] ?? 0}
              size="small"
              color={(rowCounts[rowIndex] ?? 0) > 0 ? 'primary' : 'default'}
              sx={{ minWidth: 32, height: 20 }}
            />
          </TableCell>
        )}
      </>
    );
  };

  const TableRowComponent = forwardRef<HTMLTableRowElement, ItemProps<SelectionMatrixRow<T>>>(
    (rowProps, rowRef) => {
      const { item, style, ...rest } = rowProps;
      const extraProps = getRowProps?.(item, rowProps['data-index']) ?? {};
      return (
        <TableRow
          {...rest}
          {...extraProps}
          ref={rowRef}
          hover
          style={{
            ...style,
            ...(extraProps as { style?: React.CSSProperties }).style,
            opacity: item?.disabled ? 0.5 : 1,
          }}
          sx={{
            '&:hover': { bgcolor: 'action.hover' },
          }}
        />
      );
    },
  );

  const VirtuosoTableComponents: TableComponents<SelectionMatrixRow<T>> = {
    Scroller: forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
      ({ style, ...scrollerProps }, scrollerRef) => (
        <TableContainer
          component={Paper}
          {...scrollerProps}
          ref={scrollerRef}
          sx={{ maxHeight, height: maxHeight, ...style }}
        />
      ),
    ),
    Table: forwardRef<HTMLTableElement, React.TableHTMLAttributes<HTMLTableElement>>(
      (tableProps, tableRef) => (
        <Table
          {...tableProps}
          ref={tableRef}
          stickyHeader={stickyHeader}
          size={dense ? 'small' : 'medium'}
        />
      ),
    ),
    TableHead: forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
      (headProps, headRef) => <TableHead {...headProps} ref={headRef} />,
    ),
    TableBody: forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
      (bodyProps, bodyRef) => <TableBody {...bodyProps} ref={bodyRef} />,
    ),
    TableRow: TableRowComponent,
  };

  return (
    <TableVirtuoso
      data={rows}
      fixedHeaderContent={renderHeader}
      itemContent={(index) => renderRowContent(index)}
      components={VirtuosoTableComponents}
      style={{ height: maxHeight }}
      defaultItemHeight={rowHeight}
    />
  );
}
