/**
 * TreeTableBody Component
 *
 * テーブルボディを表示するコンポーネント
 */

import React from 'react';
import { TableBody, TableRow, TableCell } from '@mui/material';
import { flexRender } from '@tanstack/react-table';
import type { Row } from '@tanstack/react-table';
import type { TreeNode } from '@hierarchidb/common-core';

interface TreeTableBodyProps {
  rows: Row<TreeNode>[];
  onRowClick?: (nodeId: string) => void;
}

export const TreeTableBody: React.FC<TreeTableBodyProps> = ({ rows, onRowClick }) => {
  return (
    <TableBody>
      {rows.map((row) => (
        <TableRow
          key={row.id}
          onClick={() => onRowClick?.(row.original.id)}
          sx={{
            cursor: onRowClick ? 'pointer' : 'default',
            '&:hover': {
              backgroundColor: 'action.hover',
            },
          }}
        >
          {row.getVisibleCells().map((cell) => (
            <TableCell key={cell.id}>
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  );
};
