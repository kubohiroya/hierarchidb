import { Box, Checkbox, Chip, IconButton, TextField, Tooltip } from '@mui/material';
import {
  ChevronRight as ChevronRightIcon,
  DragIndicator as DragIndicatorIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import type { ColumnDef } from '@tanstack/react-table';
import type { TreeNode, NodeId } from '@hierarchidb/common-types';
import { rainbowColors } from '@hierarchidb/ui-theme';
import { IndentSpace, NameCell } from '../TreeTableStyles.js';
import { extractTags, normalizeNodeKey } from '../../utils/treeTableHelpers.js';
import type { TreeNodeInUI } from '../../types.js';
import {
  buildTreeConsoleLinkHref,
  getPluginIconColor,
  isFolderNodeType,
} from '@hierarchidb/ui-treeconsole-breadcrumb';
import { Link as RouterLink } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import type { ComponentType, KeyboardEvent as ReactKeyboardEvent } from 'react';

type NodeTypeIconLikeProps = {
  nodeType: string;
  size?: string;
  clickable?: boolean;
  color?: 'inherit' | 'primary' | 'secondary' | 'action' | 'disabled' | 'error';
  htmlColor?: string;
};

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
  IconComponent: ComponentType<NodeTypeIconLikeProps>;
  iconInteractive?: boolean;
  rowClickAction: 'Select/Navigate' | 'Edit';
  selectionMode: 'single' | 'multiple' | 'none';
  controller: any;
  validateInline: (field: 'name' | 'description', value: string) => { ok: boolean; message?: string };
  handleStartEdit: (node: TreeNodeInUI, field?: 'name' | 'description') => void;
  editingField: 'name' | 'description' | null;
  editingValue: string;
  editingError: string | null;
  setEditingError: (value: string | null) => void;
  setEditingNodeId: (value: string | null) => void;
  setEditingField: (value: 'name' | 'description' | null) => void;
  treeId?: string;
  setContextMenuState: React.Dispatch<React.SetStateAction<{
    anchorEl: HTMLElement | null;
    anchorPosition: { left: number; top: number } | null;
    node: TreeNodeInUI | TreeNode | null;
  }>>;
  visualSelectionSet: Set<NodeId>;
  useTrashColumns: boolean;
  trashAction: 'restore' | 'empty';
  formatTimestamp: (value?: number) => string;
  trashRemovedHeader?: string;
  columnLabels: {
    name: string;
    description: string;
    created: string;
    updated: string;
    removed: string;
  };
  draftChipLabels: {
    self: string;
    descendant: string;
  };
  draftFlags: {
    hasDraft: Set<NodeId>;
    hasDescendantDraft: (nodeId: NodeId) => boolean;
  };
  validationMessages: {
    invalidName: string;
    invalidDescription: string;
  };
  placeholders: {
    nameEdit: string;
    descriptionEdit: string;
  };
  emptyValue: string;
}

const SparkleAnimation: React.FC<{ showSparkle: boolean; duration?: number }> = ({
  showSparkle,
  duration = 5000,
}) => {
  const [isVisible, setIsVisible] = useState(showSparkle);

  useEffect(() => {
    if (!showSparkle) {
      setIsVisible(false);
      return;
    }

    setIsVisible(true);
    const timer = window.setTimeout(() => setIsVisible(false), duration);
    return () => window.clearTimeout(timer);
  }, [showSparkle, duration]);

  if (!isVisible) return null;

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        animation: 'sparkle 1s infinite alternate',
        '@keyframes sparkle': {
          '0%': { opacity: 1, transform: 'scale(1)' },
          '50%': { opacity: 0.7, transform: 'scale(1.2)' },
          '100%': { opacity: 1, transform: 'scale(1)' },
        },
      }}
    >
      ✨
    </Box>
  );
};

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
    editingError,
    setEditingError,
    setEditingNodeId,
    setEditingField,
    treeId,
    setContextMenuState,
    visualSelectionSet,
    useTrashColumns,
    trashAction,
    formatTimestamp,
    trashRemovedHeader,
    columnLabels,
    validationMessages,
    placeholders,
    emptyValue,
  } = params;

  const selectionColumn: ColumnDef<TreeNode> = {
    id: 'selection',
    header: () => (
      <Tooltip title={selectAll ? selectAllLabels.clear : selectAllLabels.select} placement="right">
        <Checkbox
          id={`row-selection-all`}
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
          id={`row-selection-${row.original.id}`}
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
    header: columnLabels.name,
    size: columnWidths.name,
    enableSorting: true,
    cell: ({ row }) => {
      const node = row.original;
      const reportedDepth = typeof node.depth === 'number' ? node.depth : undefined;
      const baseDepth = Math.max(0, ((reportedDepth ?? 1) + depthOffset) - 1);
      const depth = useTrashColumns ? Math.max(0, baseDepth - 1) : baseDepth;
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
      const absoluteDepth = typeof (node as TreeNodeInUI).absoluteDepth === 'number'
        ? ((node as TreeNodeInUI).absoluteDepth as number)
        : reportedDepth;
      const iconDepth = typeof absoluteDepth === 'number' ? Math.max(0, absoluteDepth) : baseDepth;
      const nodeType = node.nodeType || 'folder';
      const baseIconColor = rainbowColors[Math.max(0, Math.round(iconDepth)) % rainbowColors.length];
      const manifestIconColor = getPluginIconColor(nodeType);
      const iconColor = isFolderNodeType(nodeType) ? baseIconColor : (manifestIconColor ?? baseIconColor);
      const updatedAtValue = typeof node.updatedAt === 'number' ? node.updatedAt : undefined;
      const showSparkle = typeof updatedAtValue === 'number' ? Date.now() - updatedAtValue <= 5000 : false;

      return (
        <NameCell>

          {!hideDragHandler && !disableDragAndDrop && (
            <IconButton size="small" sx={{ padding: 0, cursor: 'grab' }} onClick={(e) => e.stopPropagation()}>
              <DragIndicatorIcon fontSize="small" />
            </IconButton>
          )}

          <IndentSpace depth={depth} />

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
              const target = e.currentTarget as HTMLElement;
              const rect = target.getBoundingClientRect();
              setContextMenuState({
                anchorEl: target,
                anchorPosition: {
                  left: rect.left + rect.width / 2,
                  top: rect.top + rect.height / 2,
                },
                node,
              });
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
                cursor: 'context-menu',
              }}
            >
              <IconComponent
                nodeType={nodeType}
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
                defaultValue={editingValue}
                onChange={() => {
                  if (editingError) setEditingError(null);
                }}
                onBlur={(event) => {
                  const nextValue = event.target.value.trim();
                  if (nextValue === node.metadata.name) {
                    setEditingNodeId(null);
                    setEditingField(null);
                    setEditingError(null);
                    return;
                  }
                  const validation = validateInline('name', nextValue);
                  if (!validation.ok) {
                    setEditingError(validation.message || validationMessages.invalidName);
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
                    const nextValue = event.currentTarget.value.trim();
                    if (nextValue === node.metadata.name) {
                      setEditingNodeId(null);
                      setEditingField(null);
                      setEditingError(null);
                      return;
                    }
                    const validation = validateInline('name', nextValue);
                    if (!validation.ok) {
                      setEditingError(validation.message || validationMessages.invalidName);
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
                placeholder={!editingValue ? placeholders.nameEdit : undefined}
                sx={{ flex: 1 }}
              />
            </Box>
          ) : (() => {
            const linkHref = buildTreeConsoleLinkHref({
              treeId,
              nodeId: node.id,
              pageNodeId,
              holderType: (node as { holderType?: 'draft' | 'trash' }).holderType,
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
                  {node.metadata.name}
                </Box>
                <SparkleAnimation showSparkle={showSparkle} />
                {params.draftFlags.hasDraft.has(node.id as NodeId) ? (
                  <Chip
                    label={params.draftChipLabels.self}
                    size="small"
                    color="error"
                    variant="filled"
                    sx={{ height: 20 }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : params.draftFlags.hasDescendantDraft(node.id as NodeId) ? (
                  <Chip
                    label={params.draftChipLabels.descendant}
                    size="small"
                    color="warning"
                    variant="outlined"
                    sx={{ height: 20 }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : null}
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
    header: columnLabels.description,
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
              defaultValue={editingValue}
              onChange={() => {
                if (editingError) setEditingError(null);
              }}
              onBlur={(event) => {
                const nextValue = event.target.value.trim();
                if ((node.metadata.description || '') === nextValue) {
                  setEditingNodeId(null);
                  setEditingField(null);
                  setEditingError(null);
                  return;
                }
                const validation = validateInline('description', nextValue);
                if (!validation.ok) {
                  setEditingError(validation.message || validationMessages.invalidDescription);
                  return;
                }
                controller?.finishEdit?.(node.id, nextValue, 'description');
                setEditingNodeId(null);
                setEditingField(null);
                setEditingError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                  const nextValue = (event.currentTarget as HTMLInputElement).value.trim();
                  const validation = validateInline('description', nextValue);
                  if (!validation.ok) {
                    setEditingError(validation.message || validationMessages.invalidDescription);
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
              placeholder={!editingValue ? placeholders.descriptionEdit : undefined}
            />
          </Box>
        );
      }

      if (!node.metadata.description) return emptyValue;
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
          <span>{node.metadata.description}</span>
        </Box>
      );
    },
  };

  const createdColumn: ColumnDef<TreeNode> = {
    id: 'createdAt',
    accessorKey: 'createdAt',
    header: columnLabels.created,
    size: columnWidths.createdAt,
    enableSorting: true,
    cell: ({ row }) => {
      const value = row.original.createdAt as number | undefined;
      return formatTimestamp(value);
    },
  };

  const updatedColumn: ColumnDef<TreeNode> = {
    id: 'updatedAt',
    accessorKey: 'updatedAt',
    header: columnLabels.updated,
    size: columnWidths.updatedAt,
    enableSorting: true,
    cell: ({ row }) => {
      const value = row.original.updatedAt as number | undefined;
      return formatTimestamp(value);
    },
  };

  const columns: ColumnDef<TreeNode>[] = [selectionColumn, nameColumn, descriptionColumn, createdColumn, updatedColumn];

  if (useTrashColumns) {
    const removedColumn: ColumnDef<TreeNode> = {
      id: 'removedAt',
      accessorFn: (row) => (row as { removedAt?: number; deletedAt?: number }).removedAt ?? (row as { deletedAt?: number }).deletedAt,
      header: trashRemovedHeader || columnLabels.removed,
      size: columnWidths.removedAt ?? 150,
      enableSorting: true,
      cell: ({ row }) => {
        const nodeWithDeletion = row.original as unknown as { removedAt?: number; deletedAt?: number };
        const value = nodeWithDeletion.removedAt ?? nodeWithDeletion.deletedAt;
        return formatTimestamp(value);
      },
    };

    columns.push(removedColumn);
  }

  return columns;
}
