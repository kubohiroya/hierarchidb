/**
 * TreeTableHeader Component
 *
 * テーブルヘッダーを表示するコンポーネント
 */

import React from 'react';
import { TableHead, TableRow, TableCell } from '@mui/material';
import { flexRender } from '@tanstack/react-table';
import type { HeaderGroup } from '@tanstack/react-table';
import type { TreeNode } from '@hierarchidb/common-core';

interface TreeTableHeaderProps {
  headerGroups: HeaderGroup<TreeNode>[];
}

export const TreeTableHeader: React.FC<TreeTableHeaderProps> = ({ headerGroups }) => {
  return (
    <TableHead>
      {headerGroups.map((headerGroup) => (
        <TableRow key={headerGroup.id}>
          {headerGroup.headers.map((header) => (
            <TableCell
              key={header.id}
              style={{
                width: header.getSize(),
              }}
            >
              {header.isPlaceholder
                ? null
                : flexRender(header.column.columnDef.header, header.getContext())}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableHead>
  );
};
