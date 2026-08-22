import type { NodeId } from '@hierarchidb/core-types';
import { getTreeNodeDescription, getTreeNodeName, type TreeNode } from '@hierarchidb/tree-api';
import { Box, Checkbox, TableBody, TableCell, TableRow } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { Link as RouterLink } from '@tanstack/react-router';
import type { Table as ReactTable } from '@tanstack/react-table';
import { flexRender } from '@tanstack/react-table';
import type { Dispatch, MouseEvent as ReactMouseEvent, SetStateAction } from 'react';
import { IndentSpace, NameCell, StyledTableRow } from '~/components/TreeTableStyles';
import { getArchiveRowSx, useTreeTableRows } from './useTreeTableRows.js';

export { getArchiveRowSx } from './useTreeTableRows.js';

export interface TreeTableRowsProps {
  table: ReactTable<TreeNode>;
  visibleData: TreeNode[];
  columnWidths: Record<string, number>;
  columnsLength: number;
  selectAll: boolean;
  selectAllHydrated: boolean;
  hasSelectedAncestor: (nodeId: NodeId) => boolean;
  rowSelection: Record<string, boolean>;
  collectDescendantIds: (nodeId: NodeId) => string[];
  batchSelect: (ids: string[], checked: boolean) => void;
  depthOffset: number;
  treeId?: string;
  pageNodeId?: string;
  handleRowClick: (node: TreeNode, event: ReactMouseEvent<HTMLTableRowElement>) => void;
  handleRowDoubleClick: (node: TreeNode, event: ReactMouseEvent<HTMLTableRowElement>) => void;
  hoverDropTargetId: string | null;
  setHoverDropTargetId: Dispatch<SetStateAction<string | null>>;
  forbiddenTargets: Set<NodeId>;
  setForbiddenTargets: Dispatch<SetStateAction<Set<NodeId>>>;
  getDescendants: (nodeId: NodeId) => Set<NodeId>;
  controller:
    | { onMoveNodes?: (nodes: string[], target: string) => void | Promise<void> }
    | undefined;
  disableDragAndDrop: boolean;
  visualSelectionSet: Set<NodeId>;
  useArchiveColumns: boolean;
  archiveAction?: 'restore' | 'empty';
}

export function TreeTableRows({
  table,
  visibleData,
  columnWidths,
  columnsLength,
  selectAll,
  selectAllHydrated,
  hasSelectedAncestor,
  collectDescendantIds,
  batchSelect,
  depthOffset,
  treeId,
  pageNodeId,
  handleRowClick,
  handleRowDoubleClick,
  hoverDropTargetId,
  setHoverDropTargetId,
  forbiddenTargets,
  setForbiddenTargets,
  getDescendants,
  controller,
  disableDragAndDrop,
  visualSelectionSet,
  useArchiveColumns,
}: TreeTableRowsProps) {
  const {
    getFallbackRowState,
    handleFallbackCheckboxChange,
    getRowRenderState,
    createRowDragHandlers,
    formatDateValue,
  } = useTreeTableRows({
    selectAll,
    selectAllHydrated,
    hasSelectedAncestor,
    collectDescendantIds,
    batchSelect,
    depthOffset,
    pageNodeId,
    hoverDropTargetId,
    setHoverDropTargetId,
    forbiddenTargets,
    setForbiddenTargets,
    getDescendants,
    controller,
    disableDragAndDrop,
    visualSelectionSet,
    useArchiveColumns,
  });

  const renderFallbackRow = (node: TreeNode) => {
    const fallbackState = getFallbackRowState(node.id as NodeId, node.depth);
    const createdAt = formatDateValue(node.createdAt);
    const updatedAt = formatDateValue(node.updatedAt);

    return (
      <StyledTableRow
        key={node.id}
        selected={visualSelectionSet.has(node.id as NodeId)}
        draggable={false}
        onClick={(e) => handleRowClick(node, e)}
        sx={useArchiveColumns ? (theme: Theme) => getArchiveRowSx(theme) : undefined}
      >
        <TableCell
          sx={{
            width: `${columnWidths.selection}px`,
            minWidth: `${columnWidths.selection}px`,
            maxWidth: `${columnWidths.selection}px`,
          }}
        >
          <Checkbox
            checked={fallbackState.visuallyChecked}
            disabled={fallbackState.disableCheckbox}
            onChange={(e) => {
              handleFallbackCheckboxChange(
                node.id as NodeId,
                e.target.checked,
                fallbackState.disableCheckbox
              );
            }}
            size="small"
            onClick={(e) => e.stopPropagation()}
          />
        </TableCell>
        <TableCell
          sx={{
            width: `${columnWidths.name}px`,
            minWidth: `${columnWidths.name}px`,
            maxWidth: `${columnWidths.name}px, paddingLeft: '4px'`,
          }}
        >
          <NameCell>
            <IndentSpace depth={fallbackState.indentDepth} />
            <Box
              component={RouterLink}
              to={`/${['t', String(treeId || ''), String(node.id)].filter(Boolean).join('/')}`}
              sx={{
                mr: 0.5,
                color: 'primary.main',
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              {getTreeNodeName(node)}
            </Box>
          </NameCell>
        </TableCell>
        <TableCell
          sx={{
            width: `${columnWidths.description}px`,
            minWidth: `${columnWidths.description}px`,
            maxWidth: `${columnWidths.description}px`,
            paddingLeft: '4px',
          }}
        >
          {getTreeNodeDescription(node) || '-'}
        </TableCell>
        <TableCell
          sx={{
            width: `${columnWidths.createdAt}px`,
            minWidth: `${columnWidths.createdAt}px`,
            maxWidth: `${columnWidths.createdAt}px`,
          }}
        >
          {createdAt ? <span title={createdAt.timeLabel}>{createdAt.dateLabel}</span> : '-'}
        </TableCell>
        <TableCell
          sx={{
            width: `${columnWidths.updatedAt}px`,
            minWidth: `${columnWidths.updatedAt}px`,
            maxWidth: `${columnWidths.updatedAt}px`,
            paddingLeft: '4px',
          }}
        >
          {updatedAt ? <span title={updatedAt.timeLabel}>{updatedAt.dateLabel}</span> : '-'}
        </TableCell>
      </StyledTableRow>
    );
  };

  return (
    <TableBody>
      {table.getRowModel().rows.length === 0 && visibleData.length === 0 && (
        <TableRow>
          <TableCell colSpan={columnsLength} align="center" sx={{ py: 6, color: 'text.secondary' }}>
            No data
          </TableCell>
        </TableRow>
      )}

      {table.getRowModel().rows.length === 0 &&
        visibleData.length > 0 &&
        visibleData.map((node) => renderFallbackRow(node))}

      {table.getRowModel().rows.map((row) => {
        const node = row.original;
        const rowRenderState = getRowRenderState(row.original.id);
        const dragHandlers = createRowDragHandlers(row.original.id);

        return (
          <StyledTableRow
            key={row.id}
            selected={rowRenderState.isSelected}
            draggable={!disableDragAndDrop}
            onDragStart={dragHandlers.onDragStart}
            onDragOver={dragHandlers.onDragOver}
            onDrop={dragHandlers.onDrop}
            onDragEnd={dragHandlers.onDragEnd}
            onDragLeave={dragHandlers.onDragLeave}
            onClick={(e) => handleRowClick(node, e)}
            onDoubleClick={(e) => handleRowDoubleClick(node, e)}
            sx={rowRenderState.appliedRowSx}
            aria-disabled={rowRenderState.ariaDisabled}
            title={rowRenderState.title}
          >
            {row.getVisibleCells().map((cell) => (
              <TableCell
                key={cell.id}
                sx={{
                  width: `${columnWidths[cell.column.id]}px`,
                  minWidth: `${columnWidths[cell.column.id]}px`,
                  maxWidth: `${columnWidths[cell.column.id]}px`,
                }}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext()) as React.ReactNode}
              </TableCell>
            ))}
          </StyledTableRow>
        );
      })}
    </TableBody>
  );
}
