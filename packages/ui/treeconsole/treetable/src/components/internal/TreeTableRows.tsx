import type { Dispatch, SetStateAction, MouseEvent as ReactMouseEvent } from 'react';
import { useCallback } from 'react';
import { TableBody, TableCell, TableRow, Checkbox, Box } from '@mui/material';
import type { TreeNode, NodeId } from '@hierarchidb/common-type';
import { flexRender } from '@tanstack/react-table';
import type { Table as ReactTable } from '@tanstack/react-table';
import { NameCell, IndentSpace, StyledTableRow } from '../TreeTableStyles.js';
import { Link as RouterLink } from 'react-router-dom';

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
  controller: any;
  disableDragAndDrop: boolean;
  visualSelectionSet: Set<NodeId>;
  trashAction?: 'restore'|'empty';
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
}: TreeTableRowsProps) {
  const renderFallbackRow = useCallback((node: TreeNode) => {
    const inheritedSelection = hasSelectedAncestor(node.id as NodeId);
    const forcedSelectAll = selectAll;
    const visuallyChecked = forcedSelectAll || visualSelectionSet.has(node.id as NodeId);
    const disableCheckbox = forcedSelectAll || inheritedSelection || (!!pageNodeId && !selectAllHydrated);

    return (
      <StyledTableRow
        key={node.id}
        selected={visualSelectionSet.has(node.id as NodeId)}
        draggable={false}
        onClick={(e) => handleRowClick(node, e)}
      >
        <TableCell sx={{ width: `${columnWidths.selection}px`, minWidth: `${columnWidths.selection}px`, maxWidth: `${columnWidths.selection}px` }}>
          <Checkbox
            checked={visuallyChecked}
            disabled={disableCheckbox}
            onChange={(e) => {
              if (disableCheckbox) return;
              const targets = collectDescendantIds(node.id as NodeId);
              if (targets.length === 0) return;
              batchSelect(targets, e.target.checked);
            }}
            size="small"
            onClick={(e) => e.stopPropagation()}
          />
        </TableCell>
        <TableCell sx={{ width: `${columnWidths.name}px`, minWidth: `${columnWidths.name}px`, maxWidth: `${columnWidths.name}px` }}>
          <NameCell>
            <IndentSpace depth={Math.max(0, ((node.depth || 0) + depthOffset) - 1)} />
            <Box
              component={RouterLink}
              to={`/${['t', String(treeId || ''), String(node.id)].filter(Boolean).join('/')}`}
              sx={{ mr: 0.5, color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
            >
              {node.name}
            </Box>
          </NameCell>
        </TableCell>
        <TableCell sx={{ width: `${columnWidths.description}px`, minWidth: `${columnWidths.description}px`, maxWidth: `${columnWidths.description}px` }}>
          {node.description || '-'}
        </TableCell>
        <TableCell sx={{ width: `${columnWidths.createdAt}px`, minWidth: `${columnWidths.createdAt}px`, maxWidth: `${columnWidths.createdAt}px` }}>
          {(() => {
            const v = node.createdAt;
            if (!v) return '-';
            const d = new Date(v);
            return (
              <span title={d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}>
                {d.toLocaleDateString()}
              </span>
            );
          })()}
        </TableCell>
        <TableCell sx={{ width: `${columnWidths.updatedAt}px`, minWidth: `${columnWidths.updatedAt}px`, maxWidth: `${columnWidths.updatedAt}px` }}>
          {(() => {
            const v = node.updatedAt;
            if (!v) return '-';
            const d = new Date(v);
            return (
              <span title={d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}>
                {d.toLocaleDateString()}
              </span>
            );
          })()}
        </TableCell>
      </StyledTableRow>
    );
  }, [batchSelect, collectDescendantIds, columnWidths, depthOffset, handleRowClick, hasSelectedAncestor, pageNodeId, selectAll, selectAllHydrated, treeId, visualSelectionSet]);

  return (
    <TableBody>
      {(table.getRowModel().rows.length === 0 && visibleData.length === 0) && (
        <TableRow>
          <TableCell colSpan={columnsLength} align="center" sx={{ py: 6, color: 'text.secondary' }}>
            No data
          </TableCell>
        </TableRow>
      )}

      {table.getRowModel().rows.length === 0 && visibleData.length > 0 && (
        visibleData.map((node) => renderFallbackRow(node))
      )}

      {table.getRowModel().rows.map((row) => {
        const node = row.original;
    const isSelected = visualSelectionSet.has(node.id as NodeId) || selectAll;
    const isBlockedTarget = forbiddenTargets.has(row.original.id as NodeId);

        return (
          <StyledTableRow
            key={row.id}
            selected={isSelected}
            draggable={!disableDragAndDrop}
            onDragStart={(e) => {
              if (disableDragAndDrop) return;
              const src = row.original.id;
              e.dataTransfer?.setData('text/hdb-node', src);
              const forb = getDescendants(src as NodeId);
              setForbiddenTargets(forb);
              try {
                e.dataTransfer?.setData('application/hdb-node-descendants', JSON.stringify(Array.from(forb)));
              } catch {
                // ignore serialization errors but maintain drag state
              }
            }}
            onDragOver={(e) => {
              if (disableDragAndDrop) return;
              if (e.dataTransfer?.types?.includes('text/hdb-node')) {
                const targetId = row.original.id;
                const blocked = forbiddenTargets.has(targetId);
                if (!blocked) e.preventDefault();
                setHoverDropTargetId(targetId);
              }
            }}
            onDrop={(e) => {
              if (disableDragAndDrop) return;
              const sourceId = e.dataTransfer?.getData('text/hdb-node');
              const targetId = row.original.id;
              if (!sourceId || !targetId || sourceId === targetId) return;
              if (forbiddenTargets.has(targetId as NodeId)) return;
              controller?.onMoveNodes?.([sourceId], targetId);
              setHoverDropTargetId(null);
              setForbiddenTargets(new Set<NodeId>());
            }}
            onDragEnd={() => {
              if (disableDragAndDrop) return;
              setHoverDropTargetId(null);
              setForbiddenTargets(new Set<NodeId>());
            }}
            onDragLeave={() => {
              if (disableDragAndDrop) return;
              setHoverDropTargetId((id) => (id === row.original.id ? null : id));
            }}
            onClick={(e) => handleRowClick(node, e)}
            onDoubleClick={(e) => handleRowDoubleClick(node, e)}
            sx={{
              cursor:
                hoverDropTargetId === row.original.id && isBlockedTarget
                  ? 'not-allowed'
                  : 'pointer',
              outline:
                hoverDropTargetId === row.original.id
                  ? isBlockedTarget
                    ? '2px dashed rgba(211,47,47,0.7)'
                    : '2px dashed rgba(25,118,210,0.6)'
                  : 'none',
              outlineOffset: '-2px',
            }}
            aria-disabled={hoverDropTargetId === row.original.id && isBlockedTarget ? true : undefined}
            title={hoverDropTargetId === row.original.id && isBlockedTarget ? 'Cannot move to descendants' : undefined}
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
