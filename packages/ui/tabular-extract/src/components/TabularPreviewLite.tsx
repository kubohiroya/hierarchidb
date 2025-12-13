import React, { useMemo, useState, type ReactElement } from 'react';
import { Box, Menu, MenuItem, Typography } from '@mui/material';
import { GenericDataGrid } from '@hierarchidb/ui-data-grid';
import type { TabularFilterOperator } from '../types/index.js';

export interface TabularPreviewLiteProps {
  rows: Array<Record<string, unknown>>;
  columns?: string[];
  height?: number;
  onCreateFilter?: (rule: {
    column: string;
    operator: TabularFilterOperator;
    value: string | number | null;
  }) => void;
}

export const TabularPreviewLite: React.FC<TabularPreviewLiteProps> = ({
  rows,
  columns,
  height = 420,
  onCreateFilter,
}): ReactElement => {
  const [sort, setSort] = useState<{ column?: string; direction?: 'asc' | 'desc' }>({
    column: undefined,
    direction: 'asc',
  });
  const [menuState, setMenuState] = useState<{
    open: boolean;
    anchorPosition: { top: number; left: number } | null;
    column?: string;
    value?: unknown;
  }>({ open: false, anchorPosition: null });

  const detectedColumns = useMemo(() => {
    if (columns && columns.length) return columns;
    if (rows.length === 0) return [];
    return Object.keys(rows[0] ?? {});
  }, [columns, rows]);

  const numericCols = useMemo(() => {
    const set = new Set<string>();
    const sample = rows.slice(0, 50);
    detectedColumns.forEach((col) => {
      const allNumeric =
        sample.length > 0 && sample.every((r) => typeof r?.[col] === 'number' && Number.isFinite(r?.[col] as number));
      if (allNumeric) set.add(col);
    });
    return set;
  }, [detectedColumns, rows]);

  const gridColumns = useMemo(
    () =>
      detectedColumns.map((c) => ({
        id: c,
        label: c,
        sortable: true,
        align: numericCols.has(c) ? ('right' as const) : ('left' as const),
      })),
    [detectedColumns, numericCols]
  );

  const sortedRows = useMemo(() => {
    const { column, direction } = sort;
    if (!column || !direction) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a?.[column];
      const bv = b?.[column];
      if (av === bv) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return direction === 'asc' ? av - bv : bv - av;
      }
      return direction === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return copy;
  }, [rows, sort]);

  if (!rows.length) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          No data to preview.
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <GenericDataGrid
        columns={gridColumns}
        rows={sortedRows}
        maxHeight={height}
        rowHeight={42}
        stickyHeader
        hover
        striped
        enableVirtualization
        sortColumn={sort.column}
        sortDirection={sort.direction}
        onSort={(column, direction) => setSort({ column, direction })}
        onCellContextMenu={
          onCreateFilter
            ? ({ event, columnId, value }) => {
                event.preventDefault();
                setMenuState({
                  open: true,
                  anchorPosition: { top: event.clientY, left: event.clientX },
                  column: columnId,
                  value,
                });
              }
            : undefined
        }
      />
      <Menu
        open={menuState.open}
        onClose={() => setMenuState({ open: false, anchorPosition: null })}
        anchorReference="anchorPosition"
        anchorPosition={menuState.anchorPosition ?? undefined}
      >
        {['equals', 'not_equals', 'contains'].map((op) => (
          <MenuItem
            key={op}
            onClick={() => {
              if (onCreateFilter && menuState.column) {
                const normalizedValue =
                  menuState.value == null
                    ? null
                    : typeof menuState.value === 'object'
                      ? String(menuState.value)
                      : (menuState.value as string | number | null);
                onCreateFilter({
                  column: menuState.column,
                  operator: op as TabularFilterOperator,
                  value: normalizedValue,
                });
              }
              setMenuState({ open: false, anchorPosition: null });
            }}
          >
            {op === 'equals' && 'Equals'}
            {op === 'not_equals' && 'Not Equals'}
            {op === 'contains' && 'Contains'}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};
