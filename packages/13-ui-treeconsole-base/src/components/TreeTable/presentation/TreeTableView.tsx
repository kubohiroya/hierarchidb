/**
 * TreeTableView - 純粋な表示コンポーネント
 *
 * 表示の責務のみに専念
 * すべての状態とアクションはpropsで受け取る
 */

import React from 'react';
import { Box } from '@mui/material';
import {
  useReactTable,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
} from '@tanstack/react-table';
import { styled } from '@mui/material/styles';
import { TreeTableHeader } from './TreeTableHeader';
import { TreeTableBody } from './TreeTableBody';
import type { TreeNode } from '@hierarchidb/00-core';
import type {
  ColumnDef,
  RowSelectionState,
  ExpandedState,
  SortingState,
} from '@tanstack/react-table';

// スタイル定義
const TableContainer = styled(Box)`
  width: 100%;
  height: 100%;
  overflow: auto;
  position: relative;
  background: ${({ theme }) => theme.palette.background.paper};
  
  /* スクロールバースタイル */
  &::-webkit-scrollbar {
    width: 12px;
    height: 12px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.05);
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 6px;
    
    &:hover {
      background: rgba(0, 0, 0, 0.3);
    }
  }
`;

const TableWrapper = styled('div')`
  display: table;
  width: 100%;
  border-collapse: collapse;
`;

// Props型定義
export interface TreeTableViewProps {
  // Data
  data: TreeNode[];
  columns: ColumnDef<TreeNode>[];

  // State
  rowSelection: RowSelectionState;
  expanded: ExpandedState;
  sorting: SortingState;

  // Dimensions
  viewHeight: number;
  viewWidth: number;

  // Features
  enableSorting?: boolean;
  enableSelection?: boolean;
  enableExpanding?: boolean;
  enableDragAndDrop?: boolean;

  // Callbacks (すべて表示層からのイベント通知)
  onRowClick?: (nodeId: string) => void;
  onRowDoubleClick?: (nodeId: string) => void;
  onRowSelectionChange?: (nodeId: string) => void;
  onExpandedChange?: (nodeId: string) => void;
  onSortingChange?: (columnId: string, direction: 'asc' | 'desc') => void;
  onDragStart?: (nodeId: string) => void;
  onDragOver?: (nodeId: string) => void;
  onDragEnd?: () => void;
  onDrop?: (targetNodeId: string) => void;
}

/**
 * TreeTableView
 *
 * 純粋な表示コンポーネント
 * - 状態管理なし
 * - ビジネスロジックなし
 * - 表示とイベント通知のみ
 */
export const TreeTableView = React.memo(function TreeTableView({
  data,
  columns,
  rowSelection,
  expanded,
  sorting,
  viewHeight,
  viewWidth,
  enableSorting = true,
  enableSelection = true,
  enableExpanding = true,
  // _enableDragAndDrop = false,
  onRowClick,
  // _onRowDoubleClick,
  // _onRowSelectionChange,
  // _onExpandedChange,
  // _onSortingChange,
  // _onDragStart,
  // _onDragOver,
  // _onDragEnd,
  // _onDrop,
}: TreeTableViewProps) {
  // Create TanStack table instance
  const table = useReactTable({
    data,
    columns,
    state: {
      rowSelection,
      expanded,
      sorting,
    },
    // TanStack Table expects updater functions, not our custom callbacks
    // We'll handle the actual callbacks in the row click handlers
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableSorting,
    enableRowSelection: enableSelection,
    enableExpanding,
  });

  return (
    <TableContainer
      sx={{
        height: viewHeight,
        width: viewWidth,
      }}
    >
      <TableWrapper>
        <TreeTableHeader headerGroups={table.getHeaderGroups()} />
        <TreeTableBody rows={table.getRowModel().rows} onRowClick={onRowClick} />
      </TableWrapper>
    </TableContainer>
  );
});
