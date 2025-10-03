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
  onSelectAll?: (colIndex: number, checked: boolean) => void;
  onSelectRow?: (rowIndex: number, checked: boolean) => void;
  showRowSelection?: boolean;
  showColumnSelection?: boolean;
  showSelectionCount?: boolean;
  maxHeight?: number;
  stickyHeader?: boolean;
  dense?: boolean;
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
                                         }: SelectionMatrixProps<T>): React.ReactElement {
  // Calculate selection counts
  const columnCounts = useMemo(() => {
    return columns.map((_, colIndex) =>
      state.reduce((count, row) => count + (row[colIndex] ? 1 : 0), 0),
    );
  }, [columns, state]);

  const rowCounts = useMemo(() => {
    return rows.map((_, rowIndex) =>
      state[rowIndex]?.reduce((count, cell) => count + (cell ? 1 : 0), 0) || 0,
    );
  }, [rows, state]);

  // Check if entire column is selected
  const isColumnSelected = useCallback((colIndex: number) => {
    return state.every(row => row[colIndex]);
  }, [state]);

  // Check if entire column is indeterminate
  const isColumnIndeterminate = useCallback((colIndex: number) => {
    const selected = state.filter(row => row[colIndex]).length;
    return selected > 0 && selected < state.length;
  }, [state]);

  // Check if entire row is selected
  const isRowSelected = useCallback((rowIndex: number) => {
    return state[rowIndex]?.every(cell => cell) || false;
  }, [state]);

  // Check if entire row is indeterminate
  const isRowIndeterminate = useCallback((rowIndex: number) => {
    const row = state[rowIndex];
    if (!row) return false;
    const selected = row.filter(cell => cell).length;
    return selected > 0 && selected < row.length;
  }, [state]);

  // Handle column header checkbox click
  const handleColumnSelectAll = useCallback((colIndex: number) => {
    if (onSelectAll) {
      const isSelected = isColumnSelected(colIndex);
      onSelectAll(colIndex, !isSelected);
    }
  }, [isColumnSelected, onSelectAll]);

  // Handle row checkbox click
  const handleRowSelectAll = useCallback((rowIndex: number) => {
    if (onSelectRow) {
      const isSelected = isRowSelected(rowIndex);
      onSelectRow(rowIndex, !isSelected);
    }
  }, [isRowSelected, onSelectRow]);

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
              <Typography variant="subtitle2">Region</Typography>
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
                    disabled={row.disabled}
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
                  <Checkbox
                    checked={state[rowIndex]?.[colIndex] || false}
                    onChange={(e) => onChange(rowIndex, colIndex, e.target.checked)}
                    disabled={row.disabled}
                    size="small"
                  />
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
