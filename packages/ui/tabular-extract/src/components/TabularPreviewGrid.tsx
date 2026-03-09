import React, { type ReactElement } from 'react';
import { Box, Menu, MenuItem, Typography } from '@mui/material';
import { GenericDataGrid } from '@hierarchidb/ui-grid';
import type { TabularFilterOperator } from '../types/index';
import { TreeTableSearchInput as SearchField } from '@hierarchidb/components';
import { useTabularPreviewGrid } from './useTabularPreviewGrid.js';

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
  const view = useTabularPreviewGrid({
    rows,
    columns,
    height,
    rowLimit,
    initialVisibleRows,
    minVisibleRows,
    maxVisibleRows,
    resizable,
    onCreateFilter,
  });

  if (!view.effectiveRows.length) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          No data to preview.
        </Typography>
      </Box>
    );
  }

  const formatCount = (value: number): string => new Intl.NumberFormat('en-US').format(value);

  return (
    <>
      <Box sx={{ mb: 1, display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 1.5 }}>
        <SearchField
          searchText={view.searchText}
          handleSearchTextChange={view.setSearchText}
          handleSearchCommit={() => undefined}
          placeholder="Search values"
          ariaLabel="Search tabular preview"
        />
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
          {[
            view.searchText ? `${formatCount(view.sortedRows.length)} Matched` : null,
            hasFilters ? `${formatCount(filteredRowCount ?? view.effectiveRows.length)} Filtered` : null,
            `${formatCount(totalRowCount ?? view.effectiveRows.length)} Rows`,
          ]
            .filter(Boolean)
            .join(' / ')}
        </Typography>
      </Box>
      <GenericDataGrid
        columns={view.gridColumns}
        rows={view.sortedRows}
        maxHeight={view.gridHeight}
        rowHeight={view.rowHeight}
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
        sortColumn={view.sort.column}
        sortDirection={view.sort.direction}
        onSort={(column, direction) => view.setSort({ column, direction })}
        onCellClick={
          onCreateFilter
            ? ({ event, columnId, value }) => view.openFilterMenu(event, columnId, value)
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
            onMouseDown={view.handleResizeStart}
          />
        </Box>
      )}
      <Menu
        open={view.menuState.open}
        onClose={view.closeFilterMenu}
        anchorReference="anchorPosition"
        anchorPosition={view.menuState.anchorPosition ?? undefined}
      >
        {['equals', 'not_equals', 'contains'].map((op) => (
          <MenuItem
            key={op}
            onClick={() => view.createFilterFromMenu(op as TabularFilterOperator)}
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
