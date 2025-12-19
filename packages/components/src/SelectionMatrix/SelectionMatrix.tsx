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
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
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
  maxHeight?: number | string;
  height?: number | string;
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
  /** Optional extra row metadata columns (e.g., region, country). */
  rowMetaColumns?: Array<{
    header: React.ReactNode;
    render: (row: SelectionMatrixRow<T>, rowIndex: number) => React.ReactNode;
    width?: number | string;
  }>;
  /** Hide selection count column/chips; counts remain available via tooltips. */
  showSelectionCount?: boolean;
  /** Optional callback for column header clicks (e.g., sorting). */
  onColumnHeaderClick?: (colIndex: number) => void;
  /** Optional callback for row meta header clicks (e.g., sorting). */
  onRowMetaHeaderClick?: (metaIndex: number) => void;
  /** Optional sort direction indicator per column (asc/desc/none). */
  getColumnSortDirection?: (colIndex: number) => 'asc' | 'desc' | 'none';
  /** Optional sort direction indicator per row meta column. */
  getRowMetaSortDirection?: (metaIndex: number) => 'asc' | 'desc' | 'none';
  /** Optional ref to Virtuoso for imperative actions like scrollToIndex. */
  virtuosoRef?: React.Ref<any>;
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
                                           showSelectionCount = false,
                                           maxHeight,
                                           height,
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
                                           rowMetaColumns,
                                           onColumnHeaderClick,
                                           onRowMetaHeaderClick,
                                           getColumnSortDirection,
                                           getRowMetaSortDirection,
                                           virtuosoRef,
                                         }: SelectionMatrixProps<T>): React.ReactElement {
  const containerStyle: React.CSSProperties = {};
  const resolvedHeight = height ?? (maxHeight ?? '100%');
  const resolvedRowHeight = dense
    ? Math.min(rowHeight ?? 40, 40)
    : rowHeight ?? 48;
  if (resolvedHeight !== undefined) {
    containerStyle.height = resolvedHeight;
    if (typeof resolvedHeight === 'string') {
      containerStyle.minHeight = 400;
    }
  }
  if (maxHeight !== undefined) {
    containerStyle.maxHeight = maxHeight;
  }

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

  const { allSelected, allIndeterminate } = useMemo(() => {
    let enabled = 0;
    let selected = 0;
    rows.forEach((row, rowIndex) => {
      columns.forEach((column, colIndex) => {
        if (!isCellEnabled(row, column, rowIndex, colIndex)) return;
        enabled += 1;
        if (state[rowIndex]?.[colIndex]) selected += 1;
      });
    });
    return {
      allSelected: enabled > 0 && selected === enabled,
      allIndeterminate: enabled > 0 && selected > 0 && selected < enabled,
    };
  }, [columns, isCellEnabled, rows, state]);

  const handleSelectAll = useCallback(() => {
    const targetChecked = !allSelected;
    if (onSelectAll) {
      columns.forEach((column, colIndex) => {
        const enabledRows = rows
          .map((row, rowIndex) => ({ row, rowIndex }))
          .filter(({ row }, rowIndex) => isCellEnabled(row, column, rowIndex, colIndex))
          .map(({ rowIndex }) => rowIndex);
        if (enabledRows.length > 0) {
          onSelectAll(colIndex, targetChecked, enabledRows);
        }
      });
      return;
    }
    if (onSelectRow) {
      rows.forEach((row, rowIndex) => {
        const enabledColumns = columns
          .map((column, colIndex) => ({ column, colIndex }))
          .filter(({ column }, colIndex) => isCellEnabled(row, column, rowIndex, colIndex))
          .map(({ colIndex }) => colIndex);
        if (enabledColumns.length > 0) {
          onSelectRow(rowIndex, targetChecked, enabledColumns);
        }
      });
    }
  }, [allSelected, columns, isCellEnabled, onSelectAll, onSelectRow, rows]);

  const renderHeader = () => (
    <TableRow>
      {showRowSelection && showColumnSelection && (onSelectAll || onSelectRow) && (
        <TableCell padding="checkbox" sx={{ width: 50, p: '4px' }}>
          <Checkbox
            checked={allSelected}
            indeterminate={allIndeterminate}
            onChange={handleSelectAll}
            size="small"
            inputProps={{ 'aria-label': 'Select all' }}
          />
        </TableCell>
      )}
      {showRowSelection && (
        <TableCell padding="checkbox" sx={{ width: 50 }} />
      )}
      {rowMetaColumns && rowMetaColumns.length > 0 ? (
        rowMetaColumns.map((meta, idx) => (
      <TableCell
        key={`meta-${idx}`}
        sx={{
          minWidth: 120,
          width: meta.width,
          cursor: onRowMetaHeaderClick ? 'pointer' : undefined,
          pl: '8px',
          pr: '8px',
          pt: '4px',
          pb: '4px',
        }}
        onClick={onRowMetaHeaderClick ? () => onRowMetaHeaderClick(idx) : undefined}
      >
        <Box display="flex" alignItems="center" gap={0.5}>
          <Typography variant="subtitle2">
            {meta.header}
          </Typography>
          {getRowMetaSortDirection && (() => {
            const dir = getRowMetaSortDirection(idx);
            if (dir === 'asc') return <ArrowUpwardIcon fontSize="inherit" sx={{ fontSize: 16 }} />;
            if (dir === 'desc') return <ArrowDownwardIcon fontSize="inherit" sx={{ fontSize: 16 }} />;
            return null;
          })()}
        </Box>
      </TableCell>
        ))
      ) : (
        <TableCell sx={{ minWidth: 200, p: '4px' }}>
          <Typography variant="subtitle2">{rowHeaderLabel}</Typography>
        </TableCell>
      )}
      {columns.map((column, colIndex) => (
        <TableCell
          key={column.id}
          align="center"
          sx={{ width: column.width || 120, pl: '8px', pr: '8px', pt: '4px', pb: '4px' }}
          onClick={onColumnHeaderClick ? () => onColumnHeaderClick(colIndex) : undefined}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: onColumnHeaderClick ? 'pointer' : 'default' }}>
            <Tooltip
              title={`${column.label}: ${columnCounts[colIndex]} selected`}
              disableInteractive
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
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                  {column.description ? (
                    <Typography variant="caption" sx={{ cursor: 'help' }}>
                      {column.label}
                    </Typography>
                  ) : (
                    <Typography variant="caption">
                      {column.label}
                    </Typography>
                  )}
                  {getColumnSortDirection && (() => {
                    const dir = getColumnSortDirection(colIndex);
                    if (dir === 'asc') return <ArrowUpwardIcon fontSize="inherit" sx={{ fontSize: 16 }} />;
                    if (dir === 'desc') return <ArrowDownwardIcon fontSize="inherit" sx={{ fontSize: 16 }} />;
                    return null;
                  })()}
                </Box>
                {showSelectionCount && (
                  <Chip
                    label={columnCounts[colIndex]}
                    size="small"
                    variant="outlined"
                    sx={{ mt: 0.5, minWidth: 32, height: 20 }}
                  />
                )}
              </Box>
            </Tooltip>
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
        {showRowSelection && showColumnSelection && (onSelectAll || onSelectRow) && (
          <TableCell padding="checkbox" />
        )}
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
        {rowMetaColumns && rowMetaColumns.length > 0 ? (
          rowMetaColumns.map((meta, metaIndex) => (
            <TableCell
              key={`meta-${row.id}-${metaIndex}`}
              title={`${row.label}: ${rowCounts[rowIndex] ?? 0} selected`}
            >
              {meta.render(row, rowIndex)}
            </TableCell>
          ))
        ) : (
          <TableCell title={`${row.label}: ${rowCounts[rowIndex] ?? 0} selected`}>
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
        )}
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
          sx={{ ...containerStyle, ...style }}
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
      style={containerStyle}
      defaultItemHeight={resolvedRowHeight}
      ref={virtuosoRef}
    />
  );
}
