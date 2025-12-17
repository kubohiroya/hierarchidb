/**
 * Generic Selection Matrix Component
 * Reusable checkbox matrix for multi-dimensional selection
 */

import type React from 'react';
import { useCallback, useMemo } from 'react';
import {
  Box,
  Checkbox,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';

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

  return (
    <TableContainer component={Paper} sx={{ maxHeight }}>
      <Table stickyHeader={stickyHeader} size={dense ? 'small' : 'medium'}>
        <TableHead>
          <TableRow>
            {/* Row selection column */}
            {showRowSelection && (
              <TableCell padding="checkbox" sx={{ width: 50 }}>
                {/* Empty header for row selection column */}
              </TableCell>
            )}

            {/* Row label column */}
            <TableCell sx={{ minWidth: 200 }}>
              <Typography variant="subtitle2">{rowHeaderLabel}</Typography>
            </TableCell>

            {/* Column headers with selection checkboxes */}
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

            {/* Count column */}
            {showSelectionCount && (
              <TableCell align="center" sx={{ width: 80 }}>
                <Typography variant="caption">Selected</Typography>
              </TableCell>
            )}
          </TableRow>
        </TableHead>

        <TableBody>
          {rows.map((row, rowIndex) => (
            <TableRow
              key={row.id}
              {...(getRowProps ? getRowProps(row, rowIndex) : {})}
              hover
              sx={{
                opacity: row.disabled ? 0.5 : 1,
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              {/* Row selection checkbox */}
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

              {/* Row label */}
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

              {/* Selection cells */}
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

              {/* Row count */}
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
