import { Box, Checkbox, Chip, IconButton, TextField, Tooltip } from '@mui/material';
import {
  ChevronRight as ChevronRightIcon,
  DragIndicator as DragIndicatorIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import type { ColumnDef } from '@tanstack/react-table';
import type { TreeNode, NodeId } from '@hierarchidb/common-type';
import { rainbowColors } from '@hierarchidb/ui-core';
import { IndentSpace, NameCell } from '../TreeTableStyles.js';
import { extractTags, normalizeNodeKey } from '../../utils/treeTableHelpers.js';
import { buildTreeConsoleLinkHref } from '@hierarchidb/ui-treeconsole-breadcrumb';
import { Link as RouterLink } from 'react-router-dom';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

export interface ColumnBuilderParams {
  columnWidths: Record<string, number>;
  selectAll: boolean;
  allRowsSelected: boolean;
  someSelected: boolean;
  handleSelectAll: (checked: boolean) => void;
  pageNodeId?: string;
  selectAllHydrated: boolean;
  selectAllLabels: {
    select: string;
    clear: string;
  };
  hasSelectedAncestor: (nodeId: TreeNode['id']) => boolean;
  rowSelection: Record<string, boolean>;
  collectDescendantIds: (nodeId: NodeId) => string[];
  batchSelect: (ids: string[], checked: boolean) => void;
  depthOffset: number;
  nodesWithChildren: Set<string>;
  expandedRowIds: ReadonlySet<string>;
  editingNodeId: string | null;
  hideDragHandler: boolean;
  disableDragAndDrop: boolean;
  IconComponent: React.ComponentType<{ nodeType: string; size?: string; clickable?: boolean; color?: string; htmlColor?: string }>;
  iconInteractive?: boolean;
  rowClickAction: 'Select/Navigate' | 'Edit';
  selectionMode: 'single' | 'multiple' | 'none';
  controller: any;
  validateInline: (field: 'name' | 'description', value: string) => { ok: boolean; message?: string };
  handleStartEdit: (node: TreeNode, field?: 'name' | 'description') => void;
  editingField: 'name' | 'description' | null;
  editingValue: string;
  setEditingValue: (value: string) => void;
  editingError: string | null;
  setEditingError: (value: string | null) => void;
  setEditingNodeId: (value: string | null) => void;
  setEditingField: (value: 'name' | 'description' | null) => void;
  treeId?: string;
  setContextMenuState: React.Dispatch<React.SetStateAction<{ anchorEl: HTMLElement | null; node: TreeNode | null }>>;
  visualSelectionSet: Set<NodeId>;
  useTrashColumns: boolean;
  trashAction: 'restore' | 'empty';
}

export function createTreeTableColumns(params: ColumnBuilderParams): ColumnDef<TreeNode>[] {
  const {
    columnWidths,
    selectAll,
    allRowsSelected,
    someSelected,
    handleSelectAll,
    pageNodeId,
    selectAllHydrated,
    selectAllLabels,
    hasSelectedAncestor,
    rowSelection,
    collectDescendantIds,
    batchSelect,
    depthOffset,
    nodesWithChildren,
    expandedRowIds,
    editingNodeId,
    hideDragHandler,
    disableDragAndDrop,
    IconComponent,
    iconInteractive = true,
    rowClickAction,
    selectionMode,
    controller,
    validateInline,
    handleStartEdit,
    editingField,
    editingValue,
    setEditingValue,
    editingError,
    setEditingError,
    setEditingNodeId,
    setEditingField,
    treeId,
    setContextMenuState,
    visualSelectionSet,
    useTrashColumns,
    trashAction,
  } = params;

  const selectionColumn: ColumnDef<TreeNode> = {
    id: 'selection',
    header: () => (
      <Tooltip title={selectAll ? selectAllLabels.clear : selectAllLabels.select} placement="right">
        <Checkbox
          checked={selectAll ? true : allRowsSelected}
          indeterminate={!selectAll && someSelected}
          onChange={() => handleSelectAll(!selectAll)}
          disabled={!!pageNodeId && !selectAllHydrated}
          size="small"
        />
      </Tooltip>
    ),
    size: 50,
    cell: ({ row }) => {
      const inheritedSelection = hasSelectedAncestor(row.original.id as NodeId);
      const forcedSelectAll = selectAll;
      const visuallyChecked = forcedSelectAll || inheritedSelection || visualSelectionSet.has(row.original.id as NodeId);
      const disableCheckbox = forcedSelectAll || inheritedSelection || (!!pageNodeId && !selectAllHydrated);
      return (
        <Checkbox
          checked={visuallyChecked}
          disabled={disableCheckbox}
          onChange={(e) => {
            if (disableCheckbox) return;
            const targets = collectDescendantIds(row.original.id as NodeId);
            if (targets.length === 0) return;
            batchSelect(targets, e.target.checked);
          }}
          size="small"
          onClick={(e) => e.stopPropagation()}
        />
      );
    },
  };

  const nameColumn: ColumnDef<TreeNode> = {
    id: 'name',
    accessorKey: 'name',
    header: 'Name',
    size: columnWidths.name,
    enableSorting: true,
    cell: ({ row }) => {
      const node = row.original;
      const reportedDepth = typeof node.depth === 'number' ? node.depth : undefined;
      const depth = Math.max(0, ((reportedDepth ?? 1) + depthOffset) - 1);
      const nodeMetrics = node as TreeNode & {
        children?: readonly string[];
        childCount?: number;
        descendantCount?: number;
        isDraft?: boolean;
      };
      const derivedChildCount =
        typeof nodeMetrics.descendantCount === 'number'
          ? nodeMetrics.descendantCount
          : typeof nodeMetrics.childCount === 'number'
            ? nodeMetrics.childCount
            : undefined;
      const normalizedId = normalizeNodeKey(node.id);
      const hasChildren =
        node.hasChildren === true ||
        (normalizedId != null && nodesWithChildren.has(normalizedId)) ||
        (Array.isArray(nodeMetrics.children) && nodeMetrics.children.length > 0) ||
        (typeof derivedChildCount === 'number' && derivedChildCount > 0);
      const isExpanded = expandedRowIds.has(node.id);
      const isEditing = editingNodeId === node.id && editingField === 'name';
      const iconDepth = typeof reportedDepth === 'number' ? reportedDepth : depth + depthOffset;
      const iconColor = rainbowColors[Math.max(0, iconDepth) % rainbowColors.length];

      return (
        <NameCell>
          <IndentSpace depth={trashAction ? depth - 1 : depth} />

          {!hideDragHandler && !disableDragAndDrop && (
            <IconButton size="small" sx={{ padding: 0, cursor: 'grab' }} onClick={(e) => e.stopPropagation()}>
              <DragIndicatorIcon fontSize="small" />
            </IconButton>
          )}

          <Box sx={{ width: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {hasChildren ? (
              <IconButton
                size="small"
                sx={{
                  p: 0.25,
                  width: 24,
                  height: 24,
                  color: 'primary.main',
                  transition: 'color 120ms ease, background-color 120ms ease',
                  '&:hover': {
                    backgroundColor: 'rgba(25, 118, 210, 0.24)',
                    boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.24)',
                  },
                  '&:focus-visible': {
                    backgroundColor: 'rgba(25, 118, 210, 0.32)',
                    boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.32)',
                  },
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  controller?.onNodeExpand?.(node.id, !isExpanded);
                }}
              >
                {isExpanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
              </IconButton>
            ) : null}
          </Box>

          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              cursor: 'context-menu',
              borderRadius: 8,
              '&:hover .tree-node-icon-highlight': {
                backgroundColor: 'rgba(25, 118, 210, 0.18)',
                boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.24)',
              },
              '&:focus-visible .tree-node-icon-highlight': {
                backgroundColor: 'rgba(25, 118, 210, 0.22)',
                boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.32)',
                outline: 'none',
              },
            }}
            onClick={(e) => {
              e.stopPropagation();
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
              setContextMenuState({ anchorEl: e.currentTarget as HTMLElement, node });
            }}
            aria-label="Open menu"
            role="button"
          >
            <IconButton
              className="tree-node-icon-highlight"
              sx={{
                width: 28,
                height: 28,
                borderRadius: '33%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'transparent',
                color: 'inherit',
                transition: 'background-color 120ms ease, box-shadow 120ms ease',
              }}
            >
              <IconComponent
                nodeType={node.nodeType || 'folder'}
                size="small"
                clickable={iconInteractive}
                color="inherit"
                htmlColor={iconColor}
              />
            </IconButton>
          </Box>

          {isEditing ? (
            <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <TextField
                size="small"
                value={editingValue}
                onChange={(e) => {
                  setEditingValue(e.target.value);
                  if (editingError) setEditingError(null);
                }}
                onBlur={() => {
                  const nextValue = editingValue.trim();
                  if (nextValue === node.name) {
                    setEditingNodeId(null);
                    setEditingField(null);
                    setEditingError(null);
                    return;
                  }
                  const validation = validateInline('name', nextValue);
                  if (!validation.ok) {
                    setEditingError(validation.message || 'Invalid name');
                    return;
                  }
                  controller?.finishEdit?.(node.id, nextValue, 'name');
                  setEditingNodeId(null);
                  setEditingField(null);
                  setEditingError(null);
                }}
                onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
                  if (event.key === 'Enter') {
                    event.stopPropagation();
                    const nextValue = editingValue.trim();
                    if (nextValue === node.name) {
                      setEditingNodeId(null);
                      setEditingField(null);
                      setEditingError(null);
                      return;
                    }
                    const validation = validateInline('name', nextValue);
                    if (!validation.ok) {
                      setEditingError(validation.message || 'Invalid name');
                      return;
                    }
                    controller?.finishEdit?.(node.id, nextValue, 'name');
                    setEditingNodeId(null);
                    setEditingField(null);
                    setEditingError(null);
                  } else if (event.key === 'Escape') {
                    event.stopPropagation();
                    controller?.cancelEdit?.();
                    setEditingNodeId(null);
                    setEditingField(null);
                    setEditingError(null);
                  }
                }}
                autoFocus
                error={!!editingError}
                helperText={editingError || undefined}
                placeholder={!editingValue ? 'Press Enter to confirm / Esc to cancel' : undefined}
                sx={{ flex: 1 }}
              />
            </Box>
          ) : (() => {
            const linkHref = buildTreeConsoleLinkHref({
              treeId,
              nodeId: node.id,
              pageNodeId,
              holderType: (node as { holderType?: 'workingCopy' | 'trash' }).holderType,
              holderMetaParentId: (node as { holderMetaParentId?: NodeId }).holderMetaParentId,
              holderTargetId: (node as { holderTargetId?: NodeId }).holderTargetId,
              useTrashColumns,
              trashAction,
            });

            return (
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
                  component={RouterLink}
                  to={linkHref}
                  sx={{ mr: 0.5, color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                >
                  {node.name}
                </Box>
                {Boolean(node.isDraft) && (
                  <Chip
                    label="Draft"
                    size="small"
                    color="warning"
                    variant="outlined"
                    sx={{ height: 20 }}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
                {extractTags(node).map((tag, idx) => (
                  <Chip
                    key={`${node.id}:tag:${idx}`}
                    label={tag}
                    size="small"
                    variant="outlined"
                    sx={{ height: 20 }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ))}
              </Box>
            );
          })()}
        </NameCell>
      );
    },
  };

  const descriptionColumn: ColumnDef<TreeNode> = {
    id: 'description',
    accessorKey: 'description',
    header: 'Description',
    size: columnWidths.description,
    enableSorting: true,
    cell: ({ row }) => {
      const node: TreeNode = row.original;
      const isEditingDesc = editingNodeId === node.id && editingField === 'description';

      if (isEditingDesc) {
        return (
          <Box sx={{ position: 'relative', width: '100%' }}>
            <TextField
              size="small"
              fullWidth
              multiline
              minRows={2}
              value={editingValue}
              onChange={(event) => {
                setEditingValue(event.target.value);
                if (editingError) setEditingError(null);
              }}
              onBlur={() => {
                const nextValue = editingValue.trim();
                if ((node.description || '') === nextValue) {
                  setEditingNodeId(null);
                  setEditingField(null);
                  setEditingError(null);
                  return;
                }
                const validation = validateInline('description', nextValue);
                if (!validation.ok) {
                  setEditingError(validation.message || 'Invalid description');
                  return;
                }
                controller?.finishEdit?.(node.id, nextValue, 'description');
                setEditingNodeId(null);
                setEditingField(null);
                setEditingError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                  const nextValue = editingValue.trim();
                  const validation = validateInline('description', nextValue);
                  if (!validation.ok) {
                    setEditingError(validation.message || 'Invalid description');
                    return;
                  }
                  controller?.finishEdit?.(node.id, nextValue, 'description');
                  setEditingNodeId(null);
                  setEditingField(null);
                  setEditingError(null);
                } else if (event.key === 'Escape') {
                  controller?.cancelEdit?.();
                  setEditingNodeId(null);
                  setEditingField(null);
                  setEditingError(null);
                }
              }}
              autoFocus
              error={!!editingError}
              helperText={editingError || undefined}
              placeholder={!editingValue ? 'Ctrl+Enterで確定 / Escでキャンセル' : undefined}
            />
          </Box>
        );
      }

      if (!node.description) return '-';
      return (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            cursor: rowClickAction === 'Edit' ? 'pointer' : 'default',
          }}
          onClick={(event) => {
            if (rowClickAction !== 'Edit') return;
            event.stopPropagation();
            handleStartEdit(node, 'description');
          }}
        >
          <span>{node.description}</span>
        </Box>
      );
    },
  };

  const createdColumn: ColumnDef<TreeNode> = {
    id: 'createdAt',
    accessorKey: 'createdAt',
    header: 'Created',
    size: columnWidths.createdAt,
    enableSorting: true,
    cell: ({ row }) => {
      const value = row.original.createdAt as number | undefined;
      if (!value) return '-';
      const date = new Date(value);
      return date.toLocaleDateString();
    },
  };

  const updatedColumn: ColumnDef<TreeNode> = {
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
  };

  const columns: ColumnDef<TreeNode>[] = [selectionColumn, nameColumn, descriptionColumn, createdColumn, updatedColumn];

  if (useTrashColumns) {
    columns.push({
      id: 'deletedAt',
      header: 'Deleted At',
      size: 150,
      cell: ({ row }) => {
        const nodeWithDeletion = row.original as unknown as { deletedAt?: number };
        const value = nodeWithDeletion.deletedAt;
        return value ? new Date(value).toLocaleDateString() : '-';
      },
    });
  }

  return columns;
}
