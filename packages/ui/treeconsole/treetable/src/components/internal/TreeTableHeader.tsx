/**
 * TreeTableHeader
 * Renders the TreeTable header row with column resizing affordances.
 */

import type { TreeNode } from '@hierarchidb/tree-api';
import { Box, TableCell, TableRow, TableSortLabel } from '@mui/material';
import type { Header, Table as ReactTable } from '@tanstack/react-table';
import { flexRender } from '@tanstack/react-table';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { ResizeHandle, StyledTableHead } from '~/components/TreeTableStyles';

interface TreeTableHeaderProps {
  table: ReactTable<TreeNode>;
  columnWidths: Record<string, number>;
  resizingColumn: string | null;
  handleResizeStart: (
    leftColumnId: string,
    rightColumnId: string,
    event: ReactMouseEvent<HTMLDivElement>
  ) => void;
}

export function TreeTableHeader({
  table,
  columnWidths,
  resizingColumn,
  handleResizeStart,
}: TreeTableHeaderProps) {
  return (
    <StyledTableHead>
      {table.getHeaderGroups().map((headerGroup) => (
        <TableRow key={headerGroup.id}>
          {headerGroup.headers.map((header: Header<TreeNode, unknown>, index) => {
            const isSelectionColumn = header.column.id === 'selection';
            const canSort = header.column.getCanSort();
            const sortDirection = header.column.getIsSorted();
            const rightNeighbor = headerGroup.headers[index + 1];
            const rightId = rightNeighbor?.column.id ?? null;
            const renderedHeader = flexRender(
              header.column.columnDef.header,
              header.getContext()
            ) as React.ReactNode;
            const isNameColumn = header.column.id === 'name';
            const headerNode = isNameColumn ? (
              <Box sx={{ marginLeft: '56px' }}>{renderedHeader}</Box>
            ) : (
              renderedHeader
            );

            return (
              <TableCell
                key={header.id}
                sx={{
                  width: `${columnWidths[header.column.id]}px`,
                  minWidth: `${columnWidths[header.column.id]}px`,
                  maxWidth: `${columnWidths[header.column.id]}px`,
                  paddingLeft: '4px !important',
                }}
              >
                {header.isPlaceholder ? null : (
                  <>
                    {isSelectionColumn ? (
                      renderedHeader
                    ) : canSort ? (
                      <TableSortLabel
                        sx={{ paddingLeft: '4px' }}
                        active={!!sortDirection}
                        direction={sortDirection === 'asc' ? 'asc' : 'desc'}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {headerNode}
                      </TableSortLabel>
                    ) : (
                      headerNode
                    )}
                    {!isSelectionColumn && rightId && (
                      <ResizeHandle
                        className={resizingColumn === header.column.id ? 'resizing' : ''}
                        onMouseDown={(event) => {
                          handleResizeStart(header.column.id, rightId, event);
                        }}
                      />
                    )}
                  </>
                )}
              </TableCell>
            );
          })}
        </TableRow>
      ))}
    </StyledTableHead>
  );
}
