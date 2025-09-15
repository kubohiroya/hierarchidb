/**
  * TreeTableCore - TreeTableCore
   * Phase 1:
 * Phase 2: /
 * Phase 3:
 * Phase 4: &
 * Phase 5:
  */

import { MouseEvent, useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
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
import { Box, Button, Checkbox, Chip, IconButton, Table, TableBody, TableCell, TableHead, TableRow, TableSortLabel, TextField, Tooltip } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { styled } from '@mui/material/styles';
import {
  ChevronRight as ChevronRightIcon,
  DragIndicator as DragIndicatorIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import type { TreeTableCoreProps } from '../types';
import { NodeContextMenu, NodeTypeIcon } from '@hierarchidb/ui-treeconsole-breadcrumb';
import { rainbowColors } from '@hierarchidb/ui-core';
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
  /* Add a top border line for clear separation from elements above */
  border-top: 1px solid ${({ theme }) => theme.palette.divider};

  & .MuiTableCell-root {
    font-weight: 600;
    border-bottom: 3px solid ${({ theme }) => theme.palette.divider};
    border-right: 2px solid ${({ theme }) => theme.palette.divider};
    padding: 4px 6px;
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
    padding: 4px 6px;
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
  padding-left: 8px;
`;

const IndentSpace = styled(Box)<{ depth: number }>`
  width: ${({ depth }) => depth * 8}px;
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
                                rowClickAction = 'Select/Navigate',
                                selectionMode = 'multiple',
                                NodeTypeIcon: CustomNodeTypeIcon,
                                NodeContextMenu: CustomNodeContextMenu,
                                onRowClick,
                                onRowDoubleClick,
                                onRowContextMenu: _onRowContextMenu,
                                pageNodeId,
                                treeId,
                              }: TreeTableCoreProps): ReactElement {
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
    // 6px (left) + 37px (inner) + 6px (right) = 49px total
    selection: 49,
    name: 350,
    description: 400,
    createdAt: 150,
    updatedAt: 150,
  });
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [hoverDropTargetId, setHoverDropTargetId] = useState<string | null>(null);
  const [forbiddenTargets, setForbiddenTargets] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement | null>(null);

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

  // Persist/restore column widths in Dexie using pageNodeId as the primary key
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!pageNodeId) return;
      const saved = await (await import('../state/column-widths-db')).getColumnWidths(pageNodeId);
      if (!cancelled && saved && typeof saved === 'object') {
        setColumnWidths((prev) => ({ ...prev, ...saved }));
      }
    })();
    return () => { cancelled = true; };
  }, [pageNodeId]);

  useEffect(() => {
    (async () => {
      if (!pageNodeId) return;
      await (await import('../state/column-widths-db')).saveColumnWidths(pageNodeId, columnWidths);
    })();
  }, [columnWidths, pageNodeId]);

  // Keep first data column ('name') fixed on container resize: adjust only other columns proportionally
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let ro: ResizeObserver | null = null;
    let raf = 0;
    const MIN = 50;

    const onResize = (width: number) => {
      // Fixed columns: 'selection' and 'name'
      const fixedKeys = new Set(['selection', 'name']);
      const fixedSum = Object.entries(columnWidths)
        .filter(([k]) => fixedKeys.has(k))
        .reduce((s, [, v]) => s + (v || 0), 0);

      // Adjustable columns
      const adjustable = Object.entries(columnWidths).filter(([k]) => !fixedKeys.has(k));
      if (adjustable.length === 0) return;

      const currentAdjustableSum = adjustable.reduce((s, [, v]) => s + (v || 0), 0);
      const targetAdjustableSum = Math.max(MIN * adjustable.length, width - fixedSum);
      if (targetAdjustableSum <= 0 || currentAdjustableSum <= 0) return;

      // If the change is trivial (<1px total), skip to avoid thrashing
      if (Math.abs(targetAdjustableSum - currentAdjustableSum) < 1) return;

      const scale = targetAdjustableSum / currentAdjustableSum;
      const next: Record<string, number> = { ...columnWidths };

      // Scale each adjustable column, clamp to MIN, track residual to keep exact sum
      adjustable.forEach(([key], idx) => {
        const cur = columnWidths[key] || MIN;
        // naive scale
        let val = Math.max(MIN, Math.round(cur * scale));
        // on last column, absorb residual to match target sum exactly
        if (idx === adjustable.length - 1) {
          const sumSoFar = adjustable.slice(0, -1).reduce((s, [k]) => s + (next[k] || 0), 0);
          val = Math.max(MIN, targetAdjustableSum - sumSoFar);
        }
        next[key] = val;
      });

      setColumnWidths((prev) => {
        // Avoid unnecessary state updates
        const same = Object.keys(next).every((k) => next[k] === prev[k]);
        return same ? prev : next;
      });
    };

    const measure = () => {
      try {
        const rect = el.getBoundingClientRect();
        onResize(Math.floor(rect.width));
      } catch {}
    };

    // Use ResizeObserver when available
    try {
      ro = new ResizeObserver(() => {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(measure);
      });
      ro.observe(el);
    } catch {
      // Fallback to window resize
      const onWin = () => {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(measure);
      };
      window.addEventListener('resize', onWin);
      return () => {
        window.removeEventListener('resize', onWin);
      };
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      try { ro && ro.disconnect(); } catch {}
    };
  }, [columnWidths, containerRef]);

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

    const rootId = (controller as any)?.rootNodeId as string | undefined;

    function getDepth(nodeId: string): number {
      if (depthMap.has(nodeId)) return depthMap.get(nodeId)!;

      const node = nodeMap.get(nodeId);
      if (!node) {
        depthMap.set(nodeId, 0);
        return 0;
      }
      // If parentId is missing, treat as direct child of the current root (depth 1),
      // unless the node itself is the root.
      if (!node.parentId) {
        const d = rootId && node.id !== rootId ? 1 : 0;
        depthMap.set(nodeId, d);
        return d;
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
  // Derive which nodes have at least one child when hasChildren is not provided
  const nodesWithChildren = useMemo(() => {
    const set = new Set<string>();
    for (const n of rawData) {
      const pid = (n as any).parentId as string | undefined;
      if (pid) set.add(pid);
    }
    return set;
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

  // Batch selection into a single frame
  const pendingSelectionRef = useRef<{ ids: string[]; checked: boolean } | null>(null);
  const rafRef = useRef<number | null>(null);
  const flushBatchedSelect = () => {
    try {
      const payload = pendingSelectionRef.current;
      rafRef.current = null;
      if (!payload || !controller?.onNodeSelect) return;
      controller.onNodeSelect(payload.ids, payload.checked);
    } finally {
      pendingSelectionRef.current = null;
    }
  };
  const batchSelect = (ids: string[], checked: boolean) => {
    pendingSelectionRef.current = { ids, checked };
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(flushBatchedSelect);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (!controller?.onNodeSelect) return;
    const nodeIds = data.map((node) => node.id);
    batchSelect(nodeIds, checked);
  };

  // Column definitions
  const columns = useMemo<ColumnDef<any>[]>(() => {
    const baseColumns: ColumnDef<TreeNode>[] = [
      {
        id: 'selection',
        header: () => (
          <Tooltip title={allSelected ? 'すべて解除' : 'すべて選択'} placement="bottom">
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected}
              onChange={() => handleSelectAll(!allSelected)}
              size="small"
            />
          </Tooltip>
        ),
        size: 50,
        cell: ({ row }) => (
          <Checkbox
            checked={rowSelection[row.original.id] || false}
            onChange={(e) => {
              batchSelect([row.original.id], e.target.checked);
            }}
            size="small"
            onClick={(e) => e.stopPropagation()}
          />
        ),
      },
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Name',
        size: columnWidths.name,
        enableSorting: true,
        cell: ({ row }) => {
          const node = row.original;
          // Shift visual indentation one level left
          const depth = Math.max(0, ((node.depth || 0) + depthOffset) - 1);
          const hasChildren = node.hasChildren === true || nodesWithChildren.has(node.id);
          const isExpanded = expandedRowIds.has(node.id);
          const isEditing = editingNodeId === node.id;
          const iconDepth = depth;
          const iconColor = rainbowColors[iconDepth % rainbowColors.length];

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

              {/* Expand/Collapse button with fixed width to keep horizontal alignment */}
              <Box sx={{ width: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {hasChildren ? (
                  <IconButton
                    size="small"
                    sx={{ p: 0.25, width: 24, height: 24 }}
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
                ) : null}
              </Box>

              {/* Node icon (left-click to open context menu) */}
              <Box
                onClick={(e) => {
                  e.stopPropagation();
                  // Ctrl/Cmd+Click on the icon should toggle selection in Select/Navigate mode (no menu)
                  if (rowClickAction === 'Select/Navigate' && selectionMode !== 'none' && (e.ctrlKey || e.metaKey)) {
                    const prevSelection = { ...rowSelection };
                    const nextSelection = { ...rowSelection };
                    nextSelection[node.id] = !nextSelection[node.id];
                    const prevIds = Object.keys(prevSelection).filter((id) => prevSelection[id]);
                    const nextIds = Object.keys(nextSelection).filter((id) => nextSelection[id]);
                    const toDeselect = prevIds.filter((id) => !nextSelection[id]);
                    const toSelect = nextIds.filter((id) => !prevSelection[id]);
                    if (toDeselect.length) controller?.onNodeSelect?.(toDeselect, false);
                    if (toSelect.length) controller?.onNodeSelect?.(toSelect, true);
                    return;
                  }
                  // Otherwise, open the context menu via left-click on the icon
                  setContextMenuState({ anchorEl: e.currentTarget as HTMLElement, node });
                }}
                sx={{ display: 'inline-flex', alignItems: 'center' }}
                aria-label="Open menu"
                role="button"
              >
                <IconComponent nodeType={node.nodeType || 'folder'} size="small" clickable color="inherit" htmlColor={iconColor} />
              </Box>

              {/* Node name (editable) */}
              {isEditing && editingField === 'name' ? (
                <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', flex: 1 }}>
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
                        e.stopPropagation();
                        const next = editingValue.trim();
                        if (next === node.name) { setEditingNodeId(null); setEditingField(null); setEditingError(null); return; }
                        const vr = validateInline('name', next);
                        if (!vr.ok) { setEditingError(vr.message || 'Invalid name'); return; }
                        controller?.finishEdit?.(node.id, next, 'name');
                        setEditingNodeId(null); setEditingField(null); setEditingError(null);
                      } else if (e.key === 'Escape') {
                        e.stopPropagation();
                        controller?.cancelEdit?.();
                        setEditingNodeId(null); setEditingField(null); setEditingError(null);
                      }
                    }}
                    autoFocus
                    error={!!editingError}
                    placeholder={!editingValue ? 'Enterで確定 / Escでキャンセル' : undefined}
                    helperText={editingError || undefined}
                    sx={{ flex: 1 }}
                  />
                </Box>
              ) : (
                <Box
                  sx={{
                    flex: 1,
                    cursor: 'pointer',
                    '&:hover': { textDecoration: 'underline' },
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    flexWrap: 'wrap',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (rowClickAction === 'Edit') {
                      handleStartEdit(node, 'name');
                    }
                  }}
                >
                  <Box
                    component={RouterLink as any}
                    to={`/${['t', String(treeId || '') , String(node.id)].filter(Boolean).join('/')}`}
                    sx={{ mr: 0.5, color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                  >
                    {node.name}
                  </Box>
                  {Boolean((node as any)?.isDraft) && (
                    <Chip label="draft" size="small" color="warning" variant="outlined" sx={{ height: 20 }} onClick={(e) => e.stopPropagation()} />
                  )}
                  {Array.isArray((node as any)?.tags) && (node as any).tags.map((t: string, idx: number) => (
                    <Chip key={`${node.id}:tag:${idx}`} label={t} size="small" variant="outlined" sx={{ height: 20 }} onClick={(e) => e.stopPropagation()} />
                  ))}
                </Box>
              )}
            </NameCell>
          );
        },
      },
      {
        id: 'description',
        accessorKey: 'description',
        header: 'Description',
        size: columnWidths.description,
        enableSorting: true,
        cell: ({ row }) => {
          const node: any = row.original;
          const isEditingDesc = editingNodeId === node.id && editingField === 'description';
          if (isEditingDesc) {
            return (
              <Box sx={{ position: 'relative', width: '100%' }}>
                <TextField
                  size="small"
                  fullWidth
                  multiline
                  minRows={3}
                  maxRows={12}
                  value={editingValue}
                  onChange={(e) => { setEditingValue(e.target.value); if (editingError) setEditingError(null); }}
                  onBlur={() => {
                    // Do not auto-save on blur for multiline; rely on OK or Ctrl+Enter
                  }}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                      e.stopPropagation();
                      const next = editingValue.trim();
                      if ((node.description || '') === next) { setEditingNodeId(null); setEditingField(null); setEditingError(null); return; }
                      const vr = validateInline('description', next);
                      if (!vr.ok) { setEditingError(vr.message || 'Invalid description'); return; }
                      controller?.finishEdit?.(node.id, next, 'description');
                      setEditingNodeId(null); setEditingField(null); setEditingError(null);
                    } else if (e.key === 'Escape') {
                      e.stopPropagation();
                      controller?.cancelEdit?.();
                      setEditingNodeId(null); setEditingField(null); setEditingError(null);
                    }
                  }}
                  error={!!editingError}
                  placeholder={!editingValue ? 'Enterで改行 / Ctrl+Enterで保存 / Escでキャンセル' : undefined}
                  helperText={editingError || undefined}
                  autoFocus
                />
                <Box sx={{ position: 'absolute', right: 4, bottom: 4, display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => {
                      const next = editingValue.trim();
                      if ((node.description || '') === next) { setEditingNodeId(null); setEditingField(null); setEditingError(null); return; }
                      const vr = validateInline('description', next);
                      if (!vr.ok) { setEditingError(vr.message || 'Invalid description'); return; }
                      controller?.finishEdit?.(node.id, next, 'description');
                      setEditingNodeId(null); setEditingField(null); setEditingError(null);
                    }}
                  >
                    OK
                  </Button>
                </Box>
              </Box>
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
        accessorKey: 'createdAt',
        header: 'Created',
        size: columnWidths.createdAt,
        enableSorting: true,
        cell: ({ row }) => {
          const value = row.original.createdAt;
          if (!value) return '-';
          const d = new Date(value);
          const date = d.toLocaleDateString();
          const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          return <span title={time}>{date}</span>;
        },
      },
      {
        id: 'updatedAt',
        accessorKey: 'updatedAt',
        header: 'Updated',
        size: columnWidths.updatedAt,
        enableSorting: true,
        cell: ({ row }) => {
          const value = row.original.updatedAt;
          if (!value) return '-';
          const d = new Date(value);
          const date = d.toLocaleDateString();
          const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          return <span title={time}>{date}</span>;
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

  // Compute visible rows. To avoid false negatives (No data) in edge cases,
  // start with a permissive rule: show all provided rows. Collapsing behavior
  // will only hide descendants once expansion state is wired with a proper
  // parent chain that includes the current root.
  const visibleData = useMemo(() => data, [data]);

  // React Table instance
  const table = useReactTable({
    data: visibleData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (row) => String((row as any).id ?? ''),
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
    try {
      const target = (event.target as unknown as HTMLElement) || null;
      if (target && (target as any).closest && (target as any).closest('a[href]')) {
        return; // let native navigation happen
      }
    } catch {}
    if (rowClickAction === 'Select/Navigate' && selectionMode !== 'none') {
      const prevSelection = { ...rowSelection };
      const nextSelection = { ...rowSelection };

      if (event.ctrlKey || event.metaKey) {
        // Toggle only the clicked row
        nextSelection[node.id] = !nextSelection[node.id];
      } else {
        // Single select
        Object.keys(nextSelection).forEach((id) => {
          nextSelection[id] = false;
        });
        nextSelection[node.id] = true;
      }

      const prevIds = Object.keys(prevSelection).filter((id) => prevSelection[id]);
      const nextIds = Object.keys(nextSelection).filter((id) => nextSelection[id]);

      const toDeselect = prevIds.filter((id) => !nextSelection[id]);
      const toSelect = nextIds.filter((id) => !prevSelection[id]);

      if (toDeselect.length) controller?.onNodeSelect?.(toDeselect, false);
      if (toSelect.length) controller?.onNodeSelect?.(toSelect, true);
    }

    onRowClick?.(node, event);
  };

  const handleRowDoubleClick = (node: TreeNode, event: MouseEvent) => {
    try {
      const target = (event.target as unknown as HTMLElement) || null;
      if (target && (target as any).closest && (target as any).closest('a[href]')) {
        return;
      }
    } catch {}
    if (rowClickAction === 'Edit') {
      handleStartEdit(node);
    }

    onRowDoubleClick?.(node, event);
  };

  // Right-click context menus are disabled app-wide; do not register handlers.

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

    // Align drag delta to the visual column boundary (center of the 10px handle),
    // so horizontal mouse movement in pixels === exact column width delta.
    const handleRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const startX = handleRect.left + handleRect.width / 2;
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
    <StyledTableContainer ref={containerRef} sx={{ height: viewHeight || '100%', width: '100%' }}>
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
                        {/* Disable resize handle for the first data column ('name') to keep it fixed */}
                        {!isSelectionColumn && header.column.id !== 'updatedAt' && header.column.id !== 'name' && (
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
          {(table.getRowModel().rows.length === 0 && visibleData.length === 0) && (
            <TableRow>
              <TableCell colSpan={columns.length} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                No data
              </TableCell>
            </TableRow>
          )}

          {/* Fallback: if react-table produced 0 rows while we do have data, render simple rows */}
          {table.getRowModel().rows.length === 0 && visibleData.length > 0 && (
            visibleData.map((node) => (
              <StyledTableRow key={(node as any).id} selected={!!rowSelection[(node as any).id]} draggable={false}
                onClick={(e) => handleRowClick(node as any, e as unknown as MouseEvent)}
              >
                <TableCell sx={{ width: `${columnWidths.selection}px`, minWidth: `${columnWidths.selection}px`, maxWidth: `${columnWidths.selection}px` }}>
                  <Checkbox
                    checked={rowSelection[(node as any).id] || false}
                    onChange={(e) => batchSelect([(node as any).id], e.target.checked)}
                    size="small"
                    onClick={(e) => e.stopPropagation()}
                  />
                </TableCell>
                <TableCell sx={{ width: `${columnWidths.name}px`, minWidth: `${columnWidths.name}px`, maxWidth: `${columnWidths.name}px` }}>
                  <NameCell>
                    <IndentSpace depth={Math.max(0, (((node as any).depth || 0) + depthOffset) - 1)} />
                    <Box component={RouterLink as any} to={`/${['t', String(treeId || ''), String((node as any).id)].filter(Boolean).join('/')}`}
                      sx={{ mr: 0.5, color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                      {(node as any).name}
                    </Box>
                  </NameCell>
                </TableCell>
                <TableCell sx={{ width: `${columnWidths.description}px`, minWidth: `${columnWidths.description}px`, maxWidth: `${columnWidths.description}px` }}>
                  {(node as any).description || '-'}
                </TableCell>
                <TableCell sx={{ width: `${columnWidths.createdAt}px`, minWidth: `${columnWidths.createdAt}px`, maxWidth: `${columnWidths.createdAt}px` }}>
                  {(() => { const v = (node as any).createdAt; if (!v) return '-'; const d=new Date(v); return <span title={d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})}>{d.toLocaleDateString()}</span>; })()}
                </TableCell>
                <TableCell sx={{ width: `${columnWidths.updatedAt}px`, minWidth: `${columnWidths.updatedAt}px`, maxWidth: `${columnWidths.updatedAt}px` }}>
                  {(() => { const v = (node as any).updatedAt; if (!v) return '-'; const d=new Date(v); return <span title={d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})}>{d.toLocaleDateString()}</span>; })()}
                </TableCell>
              </StyledTableRow>
            ))
          )}
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
                    } catch {
                      throw new Error('Failed to set data transfer');
                    }
                  } catch {
                    throw new Error('Failed to set data transfer');
                  }
                }}
                onDragOver={(e) => {
                  if (e.dataTransfer?.types?.includes('text/hdb-node')) {
                    const targetId = row.original.id;
                    const blocked = forbiddenTargets.has(targetId);
                    if (!blocked) e.preventDefault();
                    try { setHoverDropTargetId(targetId); } catch {
                      throw new Error('Failed to set hover drop target');
                    }
                  }
                }}
                onDrop={(e) => {
                  try {
                    const sourceId = e.dataTransfer?.getData('text/hdb-node');
                    const targetId = row.original.id;
                    if (!sourceId || !targetId || sourceId === targetId) return;
                    if (forbiddenTargets.has(targetId)) return;
                    controller?.onMoveNodes?.([sourceId], targetId);
                  } catch {
                    throw new Error('Failed to move nodes');
                  }
                  try {
                    setHoverDropTargetId(null);
                    setForbiddenTargets(new Set());
                  } catch {
                    throw new Error('Failed to set hover drop target');
                  }
                }}
                onDragEnd={() => { try { setHoverDropTargetId(null); setForbiddenTargets(new Set()); } catch {
                  throw new Error('Failed to set hover drop target');
                } }}
                onDragLeave={() => { try { setHoverDropTargetId((id) => (id === row.original.id ? null : id)); } catch {
                  throw new Error('Failed to set hover drop target');
                } }}
                onClick={(e) => handleRowClick(node, e)}
                onDoubleClick={(e) => handleRowDoubleClick(node, e)}
                // Right-click disabled by policy
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

      {/* Context Menu (opened via left-click icon; no right-click handlers registered) */}
      {(() => {
        const n = contextMenuState.node as any;
        const isRoot = !!n && (n.depth === 0);
        return (
      <ContextMenuComponent
        anchorEl={contextMenuState.anchorEl}
        open={Boolean(contextMenuState.anchorEl)}
        onClose={handleContextMenuClose}
        nodeId={contextMenuState.node?.id || ''}
        nodeType={contextMenuState.node?.nodeType || 'folder'}
        treeId={treeId}
        nodeName={contextMenuState.node?.name}
        canCreate={true}
        canEdit={!isRoot}
        canRemove={!isRoot}
        canDuplicate={!isRoot}
        onCreate={(type: string) => {
          if (contextMenuState.node) {
            controller?.onCreate?.(contextMenuState.node.id, type);
          }
          handleContextMenuClose();
        }}
        onEdit={() => {
          const n = contextMenuState.node;
          if (n) {
            if ((n as any).depth === 0) { handleContextMenuClose(); return; }
            // Prefer explicit onEdit hook for navigation to Edit dialog; fallback to onNodeClick
            if (controller?.onEdit) controller.onEdit(n.id, n as any);
            else controller?.onNodeClick?.(n.id, n as any);
          }
          handleContextMenuClose();
        }}
        onDuplicate={() => {
          if (contextMenuState.node) {
            if ((contextMenuState.node as any).depth === 0) { handleContextMenuClose(); return; }
            controller?.onDuplicate?.(contextMenuState.node.id);
          }
          handleContextMenuClose();
        }}
        onRemove={() => {
          if (contextMenuState.node) {
            if ((contextMenuState.node as any).depth === 0) { handleContextMenuClose(); return; }
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
      />);
      })()}
    </StyledTableContainer>
  );
}
