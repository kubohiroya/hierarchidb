/**
 * TreeTableHeader
 * Renders the TreeTable header row with column resizing affordances.
 */

import { TableCell, TableRow, TableSortLabel } from '@mui/material';
import { flexRender } from '@tanstack/react-table';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { TreeNode } from '@hierarchidb/common-types';
import type { Header, Table as ReactTable } from '@tanstack/react-table';
import { ResizeHandle, StyledTableHead } from '../TreeTableStyles.js';

interface TreeTableHeaderProps {
  table: ReactTable<TreeNode>;
  columnWidths: Record<string, number>;
  resizingColumn: string | null;
  handleResizeStart: (leftColumnId: string, rightColumnId: string, event: ReactMouseEvent<HTMLDivElement>) => void;
}

export function TreeTableHeader({ table, columnWidths, resizingColumn, handleResizeStart }: TreeTableHeaderProps) {
  return (
    <StyledTableHead>
      {table.getHeaderGroups().map((headerGroup) => (
        <TableRow key={headerGroup.id}>
          {headerGroup.headers.map((header: Header<TreeNode,unknown>, index) => {
            const isSelectionColumn = header.column.id === 'selection';
            const canSort = header.column.getCanSort();
            const sortDirection = header.column.getIsSorted();
            const rightNeighbor = headerGroup.headers[index + 1];
            const rightId = rightNeighbor?.column.id ?? null;

            return (
              <TableCell
                key={header.id}
                sx={{
                  width: `${columnWidths[header.column.id]}px`,
                  minWidth: `${columnWidths[header.column.id]}px`,
                  maxWidth: `${columnWidths[header.column.id]}px`,
                  paddingLeft: '4px !important'
                }}
              >
                  {header.isPlaceholder ? null : (
                    <>
                      {isSelectionColumn ? (
                        flexRender(header.column.columnDef.header, header.getContext()) as React.ReactNode
                      ) : canSort ? (
                        <TableSortLabel
                          sx={{paddingLeft:'4px'}}
                          active={!!sortDirection}
                          direction={sortDirection === 'asc' ? 'asc' : 'desc'}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {typeof header.column.columnDef.header === 'string'
                            ? header.column.columnDef.header
                            : 'Column'}
                        </TableSortLabel>
                      ) : typeof header.column.columnDef.header === 'string' ? (
                        header.column.columnDef.header
                      ) : (
                        'Column'
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
