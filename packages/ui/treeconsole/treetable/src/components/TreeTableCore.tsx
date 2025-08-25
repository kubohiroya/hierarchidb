/**
 * TreeTableCore - 元のTreeTableCoreの整理された再実装
 *
 * 技術的負債を解消しながら、元の機能を段階的に実装。
 * Phase 1: 基本的なテーブル表示
 * Phase 2: 展開/折りたたみ
 * Phase 3: 選択機能
 * Phase 4: ドラッグ&ドロップ
 * Phase 5: 仮想スクロール
 */

import { useMemo, useState, MouseEvent, useRef } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  ColumnDef,
  flexRender,
  SortingState,
} from '@tanstack/react-table';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  TextField,
  Checkbox,
  TableSortLabel,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  DragIndicator as DragIndicatorIcon,
} from '@mui/icons-material';
import type { TreeNodeWithDepth, TreeTableCoreProps } from '../types';
import { NodeContextMenu, NodeTypeIcon } from '@hierarchidb/ui-treeconsole-breadcrumb';

// スタイル定義（元のTreeTable.cssを再現）
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
  z-index: 10;
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
  right: -3px;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  z-index: 10;
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
 * TreeTableCore メインコンポーネント
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
}: TreeTableCoreProps) {
  // コンポーネントの選択
  const IconComponent = CustomNodeTypeIcon || NodeTypeIcon;
  const ContextMenuComponent = CustomNodeContextMenu || NodeContextMenu;

  // State
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [contextMenuState, setContextMenuState] = useState<{
    anchorEl: HTMLElement | null;
    node: TreeNodeWithDepth | null;
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

  // Get data from controller
  const rawData = controller?.data || [];

  // Calculate depth for each node
  const data = useMemo(() => {
    const nodeMap = new Map<string, TreeNodeWithDepth>();
    const depthMap = new Map<string, number>();

    rawData.forEach((node) => nodeMap.set(node.id, node));

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
    const nodeIds = checked ? data.map(node => node.id) : [];
    controller.onNodeSelect(nodeIds, checked);
  };

  // Column definitions
  const columns = useMemo<ColumnDef<TreeNodeWithDepth>[]>(() => {
    const baseColumns: ColumnDef<TreeNodeWithDepth>[] = [
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
              {isEditing ? (
                <TextField
                  size="small"
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  onBlur={() => {
                    controller?.finishEdit?.(node.id, editingValue);
                    setEditingNodeId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      controller?.finishEdit?.(node.id, editingValue);
                      setEditingNodeId(null);
                    } else if (e.key === 'Escape') {
                      controller?.cancelEdit?.();
                      setEditingNodeId(null);
                    }
                  }}
                  autoFocus
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
                      handleStartEdit(node);
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
        cell: ({ row }) => row.original.description || '-',
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
        cell: ({ row }) => row.original.removedAt || '-',
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
  const handleStartEdit = (node: TreeNodeWithDepth) => {
    setEditingNodeId(node.id);
    setEditingValue(node.name);
    controller?.startEdit?.(node.id);
  };

  const handleRowClick = (node: TreeNodeWithDepth, event: MouseEvent) => {
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

  const handleRowDoubleClick = (node: TreeNodeWithDepth, event: MouseEvent) => {
    if (rowClickAction === 'Edit') {
      handleStartEdit(node);
    } else if (rowClickAction === 'Navigate') {
      controller?.onNodeClick?.(node.id, node);
    }

    onRowDoubleClick?.(node, event);
  };

  const handleRowContextMenu = (node: TreeNodeWithDepth, event: MouseEvent) => {
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
  const resizeRef = useRef<{ startX: number; startWidth: number }>({ startX: 0, startWidth: 0 });

  const handleResizeStart = (columnId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const startX = e.clientX;
    const startWidth = columnWidths[columnId] || 100;
    resizeRef.current = { startX, startWidth };
    setResizingColumn(columnId);

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      const deltaX = e.clientX - startX;
      const newWidth = Math.max(50, startWidth + deltaX);
      setColumnWidths(prev => ({
        ...prev,
        [columnId]: newWidth,
      }));
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
                          flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          ) as React.ReactNode
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
                        ) : (
                          typeof header.column.columnDef.header === 'string'
                            ? header.column.columnDef.header
                            : 'Column'
                        )}
                        {!isSelectionColumn && header.column.id !== 'updatedAt' && (
                          <ResizeHandle
                            className={resizingColumn === header.column.id ? 'resizing' : ''}
                            onMouseDown={(e) => handleResizeStart(header.column.id, e)}
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

            return (
              <StyledTableRow
                key={row.id}
                selected={isSelected}
                onClick={(e) => handleRowClick(node, e)}
                onDoubleClick={(e) => handleRowDoubleClick(node, e)}
                onContextMenu={(e) => handleRowContextMenu(node, e)}
                sx={{ cursor: 'pointer' }}
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
        onCreate={(type) => {
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
