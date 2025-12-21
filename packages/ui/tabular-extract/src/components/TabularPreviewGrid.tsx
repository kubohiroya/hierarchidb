import React, { useCallback, useMemo, useRef, useState, type ReactElement } from 'react';
import { Box, Menu, MenuItem, Typography } from '@mui/material';
import { GenericDataGrid } from '@hierarchidb/ui-grid';
import type { TabularFilterOperator } from '../types/index.js';
import { SearchField } from '@hierarchidb/ui-search-field';

export interface TabularPreviewGridProps {
  rows: Array<Record<string, unknown>>;
  columns?: string[];
  height?: number;
  /** Max rows to render; null/undefined means no cap (virtualization recommended) */
  rowLimit?: number | null;
  /** Initial visible rows to determine default height */
  initialVisibleRows?: number;
  minVisibleRows?: number;
  maxVisibleRows?: number;
  resizable?: boolean;
  totalRowCount?: number;
  filteredRowCount?: number;
  hasFilters?: boolean;
  headerCellSx?: Record<string, unknown>;
  onCreateFilter?: (rule: {
    column: string;
    operator: TabularFilterOperator;
    value: string | number | null;
  }) => void;
}

export const TabularPreviewGrid: React.FC<TabularPreviewGridProps> = ({
  rows,
  columns,
  height,
  rowLimit,
  initialVisibleRows,
  minVisibleRows,
  maxVisibleRows,
  resizable = false,
  totalRowCount,
  filteredRowCount,
  hasFilters,
  headerCellSx,
  onCreateFilter,
}): ReactElement => {
  const rowHeight = 42;
  const resolvedRowLimit = rowLimit ?? rows.length;
  const effectiveRows = useMemo(
    () => (resolvedRowLimit && resolvedRowLimit > 0 ? rows.slice(0, resolvedRowLimit) : rows),
    [resolvedRowLimit, rows],
  );
  const defaultVisibleRows = initialVisibleRows ?? Math.min(effectiveRows.length || 0, 10);
  const minRows = minVisibleRows ?? 5;
  const maxRows = maxVisibleRows ?? 50;
  const [sort, setSort] = useState<{ column?: string; direction?: 'asc' | 'desc' }>({
    column: undefined,
    direction: 'asc',
  });
  const [searchText, setSearchText] = useState('');
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
    const sample = effectiveRows.slice(0, 50);
    detectedColumns.forEach((col) => {
      const allNumeric =
        sample.length > 0 && sample.every((r) => typeof r?.[col] === 'number' && Number.isFinite(r?.[col] as number));
      if (allNumeric) set.add(col);
    });
    return set;
  }, [detectedColumns, effectiveRows]);

  const gridColumns = useMemo(
    () =>
      detectedColumns.map((c) => ({
        id: c,
        label: c,
        sortable: true,
        align: numericCols.has(c) ? ('right' as const) : ('left' as const),
      })),
    [detectedColumns, numericCols],
  );

  const sortedRows = useMemo(() => {
    const filtered = searchText
      ? effectiveRows.filter((row) =>
          Object.values(row ?? {}).some((v) =>
            String(v ?? '')
              .toLowerCase()
              .includes(searchText.toLowerCase()),
          ),
        )
      : effectiveRows;
    const { column, direction } = sort;
    if (!column || !direction) return filtered;
    const copy = [...filtered];
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
  }, [effectiveRows, searchText, sort]);

  const maxVisible = Math.max(minRows, Math.min(sortedRows.length || minRows, maxRows));
  const defaultHeight = height ?? 48 + rowHeight * Math.max(defaultVisibleRows, minRows);
  const [gridHeight, setGridHeight] = useState<number>(Math.min(defaultHeight, 48 + rowHeight * maxVisible));
  const resizingRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!resizable) return;
      e.preventDefault();
      resizingRef.current = { startY: e.clientY, startHeight: gridHeight };
      const handleMove = (ev: MouseEvent) => {
        const current = resizingRef.current;
        if (!current) return;
        const delta = ev.clientY - current.startY;
        const nextHeight = Math.max(
          48 + rowHeight * minRows,
          Math.min(48 + rowHeight * maxRows, current.startHeight + delta),
        );
        setGridHeight(nextHeight);
      };
      const handleUp = () => {
        resizingRef.current = null;
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    },
    [gridHeight, maxRows, minRows, resizable, resizingRef, rowHeight],
  );

  if (!effectiveRows.length) {
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
      <Box sx={{ mb: 1, display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 1.5 }}>
        <SearchField
          searchText={searchText}
          handleSearchTextChange={setSearchText}
          handleSearchCommit={() => undefined}
          placeholder="Search values"
          ariaLabel="Search tabular preview"
        />
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
          {[
            searchText ? `${sortedRows.length} Matched` : null,
            hasFilters ? `${filteredRowCount ?? effectiveRows.length} Filtered` : null,
            `${totalRowCount ?? effectiveRows.length} Rows`,
          ]
            .filter(Boolean)
            .join(' / ')}
        </Typography>
      </Box>
      <GenericDataGrid
        columns={gridColumns}
        rows={sortedRows}
        maxHeight={gridHeight}
        rowHeight={rowHeight}
        stickyHeader
        dense
        hover
        striped
        rowSx={({ index }) =>
          index % 2 === 0
            ? { backgroundColor: 'rgba(0,0,0,0.03)', '&:hover': { backgroundColor: 'action.hover' } }
            : undefined
        }
        rowStyle={
          onCreateFilter
            ? () => ({
                cursor: 'pointer',
              })
            : undefined
        }
        enableVirtualization
        sortColumn={sort.column}
        sortDirection={sort.direction}
        onSort={(column, direction) => setSort({ column, direction })}
        onCellClick={
          onCreateFilter
            ? ({ event, columnId, value }) => {
                setMenuState({
                  open: true,
                  anchorPosition: { top: event.clientY, left: event.clientX },
                  column: columnId,
                  value,
                });
              }
            : undefined
        }
        headerCellSx={headerCellSx}
        toolbarComponent={<></>}
      />
      {resizable && (
        <Box
          role="presentation"
          sx={{
            position: 'relative',
            width: '100%',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              right: 4,
              bottom: -6,
              width: 14,
              height: 14,
              borderRight: '2px solid',
              borderBottom: '2px solid',
              borderColor: 'divider',
              cursor: 'nwse-resize',
            }}
            onMouseDown={handleResizeStart}
          />
        </Box>
      )}
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
