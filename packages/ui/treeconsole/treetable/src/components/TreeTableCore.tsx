/**
  * TreeTableCore - TreeTableCore
   * Phase 1:
 * Phase 2: /
 * Phase 3:
 * Phase 4: &
 * Phase 5:
  */

import { MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import {
  Box,
  Checkbox,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  ChevronRight as ChevronRightIcon,
  DragIndicator as DragIndicatorIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import type { TreeTableCoreProps } from '../types';
import { NodeContextMenu, NodeTypeIcon } from '@hierarchidb/ui-treeconsole-breadcrumb';
import { TreeNode } from '@hierarchidb/common-type';

//  TreeTable.css
const StyledTableContainer = styled(Box)`
  width: 100%;
  height: 100%;
  overflow: auto;
  position: relative;

  /* Custom scrollbar styling - 元のデザインを再現 */

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

const StyledTable = styled(Table)`
  border-collapse: collapse;
  width: 100%;
  table-layout: fixed;
  min-width: 100%;
`;

const StyledTableHead = styled(TableHead)`
  position: sticky;
  top: 0;
  /* Keep above rows but below toolbars/menus */
  z-index: 1;
  background: ${({ theme }) => theme.palette.background.paper};

  & .MuiTableCell-root {
    font-weight: 600;
    border-bottom: 2px solid ${({ theme }) => theme.palette.divider};
    border-right: 1px solid ${({ theme }) => theme.palette.divider};
    padding: 8px 12px;
    user-select: none;
    position: relative;

    &:last-child {
      border-right: none;
    }
  }
`;

const ResizeHandle = styled('div')`
  position: absolute;
  right: -5px;
  top: 0;
  bottom: 0;
  width: 10px;
  cursor: col-resize;
  /* Below app menus/popovers; high enough for interaction over cells */
  z-index: 2;
  user-select: none;

  &:hover {
    background-color: rgba(25, 118, 210, 0.3);
  }

  &.resizing {
    background-color: rgba(25, 118, 210, 0.5);
  }
`;

const StyledTableRow = styled(TableRow)<{ selected?: boolean }>`
  &:hover {
    background-color: rgba(0, 0, 0, 0.04);
  }

  ${({ selected }) =>
    selected &&
    `
    background-color: rgba(25, 118, 210, 0.08) !important;
  `}
  & .MuiTableCell-root {
    padding: 8px 12px;
    border-right: 1px solid ${({ theme }) => theme.palette.divider};
    border-bottom: 1px solid ${({ theme }) => theme.palette.divider};
    transition: outline-color 120ms ease, background-color 120ms ease;

    &:last-child {
      border-right: none;
    }
  }
`;

const NameCell = styled(Box)`
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 24px;
`;

const IndentSpace = styled(Box)<{ depth: number }>`
  width: ${({ depth }) => depth * 20}px;
  flex-shrink: 0;
`;

/**
  * TreeTableCore
  */
export function TreeTableCore({
                                controller,
                                viewHeight,
                                viewWidth: _viewWidth,
                                useTrashColumns = false,
                                depthOffset = 0,
                                disableDragAndDrop = false,
                                hideDragHandler = false,
                                rowClickAction = 'Select',
                                selectionMode = 'multiple',
                                NodeTypeIcon: CustomNodeTypeIcon,
                                NodeContextMenu: CustomNodeContextMenu,
                                onRowClick,
                                onRowDoubleClick,
                                onRowContextMenu,
                                persistenceKey,
                              }: TreeTableCoreProps) {
  const IconComponent = CustomNodeTypeIcon || NodeTypeIcon;
  const ContextMenuComponent = CustomNodeContextMenu || NodeContextMenu;

  // State
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'name' | 'description' | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [editingError, setEditingError] = useState<string | null>(null);
  const [contextMenuState, setContextMenuState] = useState<{
    anchorEl: HTMLElement | null;
    node: TreeNode | null;
  }>({ anchorEl: null, node: null });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    selection: 50,
    name: 350,
    description: 400,
    createdAt: 150,
    updatedAt: 150,
  });
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [hoverDropTargetId, setHoverDropTargetId] = useState<string | null>(null);
  const [forbiddenTargets, setForbiddenTargets] = useState<Set<string>>(new Set());

  // Simple inline validator for name/description
  const validateInline = useCallback((field: 'name' | 'description', value: string): { ok: boolean; message?: string } => {
    const v = (value ?? '').trim();
    if (field === 'name') {
      if (!v) return { ok: false, message: 'Name is required' };
      if (v.length > 120) return { ok: false, message: 'Name is too long' };
    } else {
      if (v.length > 2000) return { ok: false, message: 'Description is too long' };
    }
    return { ok: true };
  }, []);

  // Persist/restore column widths per view (treeId/rootId/persistenceKey)
  const storageKey = useMemo(() => {
    const rootId = (controller as any)?.rootNodeId || '';
    const treeId = (controller as any)?.treeId || '';
    const key = persistenceKey || `${treeId}:${rootId}` || 'default';
    return `hdb:treetable:colwidths:v1:${key}`;
  }, [controller, persistenceKey]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
        // legacy keys fallback
        || localStorage.getItem(`TreeTableCore.columnWidths:tree:${(controller as any)?.rootNodeId || ''}`)
        || localStorage.getItem(`TreeTableCore.columnWidths:${(controller as any)?.rootNodeId || ''}`);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && typeof saved === 'object') {
          setColumnWidths((prev) => ({ ...prev, ...saved }));
        }
      }
    } catch {}
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(columnWidths));
    } catch {}
  }, [columnWidths, storageKey]);

  // Helper: compute descendants including self
  const getDescendants = useCallback((nodeId: string): Set<string> => {
    const descendants = new Set<string>();
    const stack = [nodeId];
    const byParent = new Map<string, string[]>();
    (controller?.data || []).forEach((n) => {
      if (!n?.parentId || !n?.id) return;
      const arr = byParent.get(n.parentId) || [];
      arr.push(n.id);
      byParent.set(n.parentId, arr);
    });
    while (stack.length > 0) {
      const cur = stack.pop()!;
      if (descendants.has(cur)) continue;
      descendants.add(cur);
      const children = byParent.get(cur) || [];
      for (const c of children) stack.push(c);
    }
    return descendants;
  }, [controller]);

  // Get data from controller
  const rawData = controller?.data || [];

  // Calculate depth for each node
  const data = useMemo(() => {
    const nodeMap = new Map<string, TreeNode>();
    const depthMap = new Map<string, number>();

    rawData.forEach((node) => nodeMap.set(node.id, node as TreeNode));

    function getDepth(nodeId: string): number {
      if (depthMap.has(nodeId)) return depthMap.get(nodeId)!;

      const node = nodeMap.get(nodeId);
      if (!node || !node.parentId) {
        depthMap.set(nodeId, 0);
        return 0;
      }

      const depth = getDepth(node.parentId) + 1;
      depthMap.set(nodeId, depth);
      return depth;
    }

    return rawData.map((node) => ({
      ...node,
      depth: getDepth(node.id),
    }));
  }, [rawData]);
  const rowSelection = controller?.rowSelection || {};
  const expandedRowIds = controller?.expandedRowIds || new Set();

  // Select all handling
  const allSelected = useMemo(() => {
    return data.length > 0 && data.every((node) => rowSelection[node.id]);
  }, [data, rowSelection]);

  const someSelected = useMemo(() => {
    return data.some((node) => rowSelection[node.id]) && !allSelected;
  }, [data, rowSelection, allSelected]);

  const handleSelectAll = (checked: boolean) => {
    if (!controller?.onNodeSelect) return;
    const nodeIds = checked ? data.map((node) => node.id) : [];
    controller.onNodeSelect(nodeIds, checked);
  };

  // Column definitions
  const columns = useMemo<ColumnDef<any>[]>(() => {
    const baseColumns: ColumnDef<TreeNode>[] = [
      {
        id: 'selection',
        header: () => (
          <Checkbox
            checked={allSelected}
            indeterminate={someSelected}
            onChange={(e) => handleSelectAll(e.target.checked)}
            size="small"
          />
        ),
        size: 50,
        cell: ({ row }) => (
          <Checkbox
            checked={rowSelection[row.original.id] || false}
            onChange={(e) => {
              controller?.onNodeSelect?.([row.original.id], e.target.checked);
            }}
            size="small"
            onClick={(e) => e.stopPropagation()}
          />
        ),
      },
      {
        id: 'name',
        header: 'Name',
        size: columnWidths.name,
        enableSorting: true,
        cell: ({ row }) => {
          const node = row.original;
          const depth = (node.depth || 0) + depthOffset;
          const hasChildren = node.hasChildren || false;
          const isExpanded = expandedRowIds.has(node.id);
          const isEditing = editingNodeId === node.id;

          return (
            <NameCell>
              <IndentSpace depth={depth} />

              {/* Drag handle */}
              {!hideDragHandler && !disableDragAndDrop && (
                <IconButton
                  size="small"
                  sx={{ padding: 0.25, cursor: 'grab' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <DragIndicatorIcon fontSize="small" />
                </IconButton>
              )}

              {/* Expand/Collapse button */}
              {hasChildren ? (
                <IconButton
                  size="small"
                  sx={{ padding: 0.25 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    controller?.onNodeExpand?.(node.id, !isExpanded);
                  }}
                >
                  {isExpanded ? (
                    <ExpandMoreIcon fontSize="small" />
                  ) : (
                    <ChevronRightIcon fontSize="small" />
                  )}
                </IconButton>
              ) : (
                <Box sx={{ width: 28 }} />
              )}

              {/* Node icon */}
              <IconComponent nodeType={node.nodeType || 'folder'} size="small" />

              {/* Node name (editable) */}
              {isEditing && editingField === 'name' ? (
                <TextField
                  size="small"
                  value={editingValue}
                  onChange={(e) => { setEditingValue(e.target.value); if (editingError) setEditingError(null); }}
                  onBlur={() => {
                    const next = editingValue.trim();
                    if (next === node.name) { setEditingNodeId(null); setEditingField(null); setEditingError(null); return; }
                    const vr = validateInline('name', next);
                    if (!vr.ok) { setEditingError(vr.message || 'Invalid name'); return; }
                    controller?.finishEdit?.(node.id, next, 'name');
                    setEditingNodeId(null); setEditingField(null); setEditingError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const next = editingValue.trim();
                      if (next === node.name) { setEditingNodeId(null); setEditingField(null); setEditingError(null); return; }
                      const vr = validateInline('name', next);
                      if (!vr.ok) { setEditingError(vr.message || 'Invalid name'); return; }
                      controller?.finishEdit?.(node.id, next, 'name');
                      setEditingNodeId(null); setEditingField(null); setEditingError(null);
                    } else if (e.key === 'Escape') {
                      controller?.cancelEdit?.();
                      setEditingNodeId(null); setEditingField(null); setEditingError(null);
                    }
                  }}
                  autoFocus
                  error={!!editingError}
                  helperText={editingError || ' '}
                  sx={{ flex: 1 }}
                />
              ) : (
                <Box
                  sx={{
                    flex: 1,
                    cursor: 'pointer',
                    '&:hover': { textDecoration: 'underline' },
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (rowClickAction === 'Edit') {
                      handleStartEdit(node, 'name');
                    } else if (rowClickAction === 'Navigate') {
                      controller?.onNodeClick?.(node.id, node);
                    }
                  }}
                >
                  {node.name}
                </Box>
              )}
            </NameCell>
          );
        },
      },
      {
        id: 'description',
        header: 'Description',
        size: columnWidths.description,
        enableSorting: true,
        cell: ({ row }) => {
          const node: any = row.original;
          const isEditingDesc = editingNodeId === node.id && editingField === 'description';
          if (isEditingDesc) {
            return (
              <TextField
                size="small"
                fullWidth
                value={editingValue}
                onChange={(e) => { setEditingValue(e.target.value); if (editingError) setEditingError(null); }}
                onBlur={() => {
                  const next = editingValue.trim();
                  if ((node.description || '') === next) { setEditingNodeId(null); setEditingField(null); setEditingError(null); return; }
                  const vr = validateInline('description', next);
                  if (!vr.ok) { setEditingError(vr.message || 'Invalid description'); return; }
                  controller?.finishEdit?.(node.id, next, 'description');
                  setEditingNodeId(null); setEditingField(null); setEditingError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const next = editingValue.trim();
                    if ((node.description || '') === next) { setEditingNodeId(null); setEditingField(null); setEditingError(null); return; }
                    const vr = validateInline('description', next);
                    if (!vr.ok) { setEditingError(vr.message || 'Invalid description'); return; }
                    controller?.finishEdit?.(node.id, next, 'description');
                    setEditingNodeId(null); setEditingField(null); setEditingError(null);
                  } else if (e.key === 'Escape') {
                    controller?.cancelEdit?.();
                    setEditingNodeId(null); setEditingField(null); setEditingError(null);
                  }
                }}
                error={!!editingError}
                helperText={editingError || ' '}
                autoFocus
              />
            );
          }
          return (
            <Box
              sx={{ cursor: rowClickAction === 'Edit' ? 'text' : 'default' }}
              onDoubleClick={() => handleStartEdit(node as any, 'description')}
              onClick={() => {
                if (rowClickAction === 'Edit') handleStartEdit(node as any, 'description');
              }}
            >
              {node.description || '-'}
            </Box>
          );
        },
      },
      {
        id: 'createdAt',
        header: 'Created',
        size: columnWidths.createdAt,
        enableSorting: true,
        cell: ({ row }) => {
          const value = row.original.createdAt;
          return value ? new Date(value).toLocaleDateString() : '-';
        },
      },
      {
        id: 'updatedAt',
        header: 'Updated',
        size: columnWidths.updatedAt,
        enableSorting: true,
        cell: ({ row }) => {
          const value = row.original.updatedAt;
          return value ? new Date(value).toLocaleDateString() : '-';
        },
      },
    ];

    // Add trash-specific columns if needed
    if (useTrashColumns) {
      baseColumns.push({
        id: 'deletedAt',
        header: 'Deleted At',
        size: 150,
        cell: ({ row }) => {
          const value = (row.original as any).createdAt as number | undefined;
          return value ? new Date(value).toLocaleDateString() : '-';
        },
      });
    }

    return baseColumns;
  }, [
    depthOffset,
    expandedRowIds,
    editingNodeId,
    editingValue,
    rowClickAction,
    hideDragHandler,
    disableDragAndDrop,
    useTrashColumns,
    controller,
    IconComponent,
    columnWidths,
    rowSelection,
    allSelected,
    someSelected,
  ]);

  // React Table instance
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection: selectionMode !== 'none',
    enableMultiRowSelection: selectionMode === 'multiple',
    state: {
      rowSelection,
      sorting,
    },
    onSortingChange: setSorting,
    onRowSelectionChange: (updater) => {
      if (typeof updater === 'function') {
        const newSelection = updater(rowSelection);
        const selectedIds = Object.keys(newSelection).filter((id) => newSelection[id]);
        controller?.onNodeSelect?.(selectedIds, true);
      }
    },
  });

  // Event handlers
  const handleStartEdit = (node: TreeNode, field: 'name' | 'description' = 'name') => {
    setEditingNodeId(node.id);
    setEditingField(field);
    const initial = field === 'name' ? node.name : ((node as any).description || '');
    setEditingValue(initial);
    controller?.startEdit?.(node.id);
  };

  const handleRowClick = (node: TreeNode, event: MouseEvent) => {
    if (rowClickAction === 'Select' && selectionMode !== 'none') {
      const newSelection = { ...rowSelection };
      if (event.ctrlKey || event.metaKey) {
        // Toggle selection
        newSelection[node.id] = !newSelection[node.id];
      } else {
        // Single selection
        Object.keys(newSelection).forEach((id) => {
          newSelection[id] = false;
        });
        newSelection[node.id] = true;
      }

      const selectedIds = Object.keys(newSelection).filter((id) => newSelection[id]);
      controller?.onNodeSelect?.(selectedIds, true);
    }

    onRowClick?.(node, event);
  };

  const handleRowDoubleClick = (node: TreeNode, event: MouseEvent) => {
    if (rowClickAction === 'Edit') {
      handleStartEdit(node);
    } else if (rowClickAction === 'Navigate') {
      controller?.onNodeClick?.(node.id, node);
    }

    onRowDoubleClick?.(node, event);
  };

  const handleRowContextMenu = (node: TreeNode, event: MouseEvent) => {
    event.preventDefault();
    setContextMenuState({
      anchorEl: event.currentTarget as HTMLElement,
      node,
    });

    onRowContextMenu?.(node, event);
  };

  const handleContextMenuClose = () => {
    setContextMenuState({ anchorEl: null, node: null });
  };

  // Column resize implementation
  const resizeRef = useRef<{
    startX: number;
    leftStart: number;
    rightStart: number;
    leftId: string;
    rightId: string;
  }>({ startX: 0, leftStart: 0, rightStart: 0, leftId: '', rightId: '' });

  const handleResizeStart = (leftColumnId: string, rightColumnId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const leftStart = columnWidths[leftColumnId] || 100;
    const rightStart = columnWidths[rightColumnId] || 100;
    resizeRef.current = { startX, leftStart, rightStart, leftId: leftColumnId, rightId: rightColumnId };
    setResizingColumn(leftColumnId);

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      const deltaX = e.clientX - startX;
      const MIN = 50;
      const { leftStart, rightStart, leftId, rightId } = resizeRef.current;
      // Clamp delta so neither side goes below MIN
      const maxPositive = rightStart - MIN; // moving handle right: left grows, right shrinks
      const maxNegative = leftStart - MIN;  // moving handle left: left shrinks, right grows
      const clamped = Math.max(-maxNegative, Math.min(deltaX, maxPositive));
      const leftNew = Math.max(MIN, leftStart + clamped);
      const rightNew = Math.max(MIN, rightStart - clamped);
      setColumnWidths((prev) => ({ ...prev, [leftId]: leftNew, [rightId]: rightNew }));
    };

    const handleMouseUp = () => {
      setResizingColumn(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Render
  return (
    <StyledTableContainer sx={{ height: viewHeight || '100%', width: '100%' }}>
      <StyledTable stickyHeader>
        <StyledTableHead>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const isSelectionColumn = header.column.id === 'selection';
                const canSort = header.column.getCanSort();
                const sortDirection = header.column.getIsSorted();

                return (
                  <TableCell
                    key={header.id}
                    sx={{
                      width: `${columnWidths[header.column.id]}px`,
                      minWidth: `${columnWidths[header.column.id]}px`,
                      maxWidth: `${columnWidths[header.column.id]}px`,
                    }}
                  >
                    {header.isPlaceholder ? null : (
                      <>
                        {isSelectionColumn ? (
                          (flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          ) as React.ReactNode)
                        ) : canSort ? (
                          <TableSortLabel
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
                        {!isSelectionColumn && header.column.id !== 'updatedAt' && (
                          <ResizeHandle
                            className={resizingColumn === header.column.id ? 'resizing' : ''}
                            onMouseDown={(e) => {
                              // Determine the immediate right neighbor column id within this header group
                              const headers = headerGroup.headers;
                              const idx = headers.findIndex((h) => h.id === header.id);
                              const rightNeighbor = headers[idx + 1];
                              const rightId = rightNeighbor?.column.id;
                              if (!rightId) return; // safety: shouldn't happen because last column has no handle
                              handleResizeStart(header.column.id, rightId, e);
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

        <TableBody>
          {table.getRowModel().rows.map((row) => {
            const node = row.original;
            const isSelected = rowSelection[node.id] || false;

            const isBlockedTarget = forbiddenTargets.has(row.original.id);
            return (
              <StyledTableRow
                key={row.id}
                selected={isSelected}
                draggable
                onDragStart={(e) => {
                  try {
                    const src = row.original.id;
                    e.dataTransfer?.setData('text/hdb-node', src);
                    const forb = getDescendants(src);
                    setForbiddenTargets(forb);
                    try {
                      e.dataTransfer?.setData('application/hdb-node-descendants', JSON.stringify(Array.from(forb)));
                    } catch {}
                  } catch {}
                }}
                onDragOver={(e) => {
                  if (e.dataTransfer?.types?.includes('text/hdb-node')) {
                    const targetId = row.original.id;
                    const blocked = forbiddenTargets.has(targetId);
                    if (!blocked) e.preventDefault();
                    try { setHoverDropTargetId(targetId); } catch {}
                  }
                }}
                onDrop={(e) => {
                  try {
                    const sourceId = e.dataTransfer?.getData('text/hdb-node');
                    const targetId = row.original.id;
                    if (!sourceId || !targetId || sourceId === targetId) return;
                    if (forbiddenTargets.has(targetId)) return;
                    controller?.onMoveNodes?.([sourceId], targetId);
                  } catch {}
                  try {
                    setHoverDropTargetId(null);
                    setForbiddenTargets(new Set());
                  } catch {}
                }}
                onDragEnd={() => { try { setHoverDropTargetId(null); setForbiddenTargets(new Set()); } catch {} }}
                onDragLeave={() => { try { setHoverDropTargetId((id) => (id === row.original.id ? null : id)); } catch {} }}
                onClick={(e) => handleRowClick(node, e)}
                onDoubleClick={(e) => handleRowDoubleClick(node, e)}
                onContextMenu={(e) => handleRowContextMenu(node, e)}
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
                title={hoverDropTargetId === row.original.id && isBlockedTarget ? '子孫に移動することはできません' : undefined}
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
      </StyledTable>

      {/* Context Menu */}
      <ContextMenuComponent
        anchorEl={contextMenuState.anchorEl}
        open={Boolean(contextMenuState.anchorEl)}
        onClose={handleContextMenuClose}
        nodeId={contextMenuState.node?.id || ''}
        nodeType={contextMenuState.node?.nodeType || 'folder'}
        nodeName={contextMenuState.node?.name}
        canCreate={true}
        canEdit={true}
        canRemove={true}
        canDuplicate={true}
        onCreate={(type: string) => {
          if (contextMenuState.node) {
            controller?.onCreate?.(contextMenuState.node.id, type);
          }
          handleContextMenuClose();
        }}
        onEdit={() => {
          if (contextMenuState.node) {
            handleStartEdit(contextMenuState.node);
          }
          handleContextMenuClose();
        }}
        onDuplicate={() => {
          if (contextMenuState.node) {
            controller?.onDuplicate?.(contextMenuState.node.id);
          }
          handleContextMenuClose();
        }}
        onRemove={() => {
          if (contextMenuState.node) {
            controller?.onRemove?.([contextMenuState.node.id]);
          }
          handleContextMenuClose();
        }}
        onOpen={() => {
          if (contextMenuState.node) {
            controller?.onNodeClick?.(contextMenuState.node.id, contextMenuState.node);
          }
          handleContextMenuClose();
        }}
        onOpenFolder={() => {
          if (contextMenuState.node) {
            controller?.onNodeClick?.(contextMenuState.node.id, contextMenuState.node);
          }
          handleContextMenuClose();
        }}
        onCheckReference={() => {
          console.log('Check reference:', contextMenuState.node?.id);
          handleContextMenuClose();
        }}
        onPreview={() => {
          console.log('PreviewStep:', contextMenuState.node?.id);
          handleContextMenuClose();
        }}
      />
    </StyledTableContainer>
  );
}
