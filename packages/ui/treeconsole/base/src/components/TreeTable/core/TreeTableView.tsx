import type React from 'react';
import { memo, useCallback, useMemo } from 'react';
import type { TreeNode } from '@hierarchidb/common-types';
import {
  Box,
  Checkbox,
  IconButton,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
} from '@mui/material';
import { rainbowColors } from '@hierarchidb/ui-theme';
import {
  ChevronRight as ChevronRightIcon,
  ExpandMore as ExpandMoreIcon,
  Folder as FolderIcon,
  InsertDriveFile as FileIcon,
} from '@mui/icons-material';
import { getPluginIconColor, isFolderNodeType } from '@hierarchidb/ui-treeconsole-breadcrumb';
import type { HierarchicalTreeNode } from '../../../types/index.js';

export interface TreeTableColumn {
  readonly id: string;
  readonly label: string;
  readonly width?: number | string;
  readonly sortable?: boolean;
  readonly align?: 'left' | 'center' | 'right';
  readonly render?: (value: unknown, node: HierarchicalTreeNode) => React.ReactNode;
}

export interface TreeTableViewProps {
  readonly data: readonly HierarchicalTreeNode[];
  readonly columns: readonly TreeTableColumn[];
  readonly loading?: boolean;
  readonly error?: string;
  readonly selectedIds: readonly string[];
  readonly expandedIds: readonly string[];
  readonly sortBy?: string;
  readonly sortDirection?: 'asc' | 'desc';
  readonly onNodeClick?: (node: HierarchicalTreeNode) => void;
  readonly onNodeSelect?: (nodeIds: string[], selected: boolean) => void;
  readonly onNodeExpand?: (nodeId: string, expanded: boolean) => void;
  readonly onSort?: (columnId: string) => void;
  // Right-click context menus are disabled app-wide
  readonly multiSelect?: boolean;
  readonly showCheckboxes?: boolean;
  readonly showIcons?: boolean;
  readonly dense?: boolean;
  readonly maxHeight?: number | string;
  readonly stickyHeader?: boolean;
}

export const TreeTableView = memo(function TreeTableView(props: TreeTableViewProps) {
  const {
    data,
    columns,
    loading = false,
    error,
    selectedIds,
    expandedIds,
    sortBy,
    sortDirection,
    onNodeClick,
    onNodeSelect,
    onNodeExpand,
    onSort,
    
    multiSelect: _multiSelect = true,
    showCheckboxes = true,
    showIcons = true,
    dense = false,
    maxHeight = 600,
    stickyHeader = true,
  } = props;

  const expandedSet = useMemo(() => new Set(expandedIds.map(String)), [expandedIds]);
  const parentMap = useMemo(() => {
    const map = new Map<string, string | undefined>();
    data.forEach((node) => {
      const parent = (node as TreeNode).parentId;
      if (parent !== null && parent !== undefined) {
        map.set(node.id, String(parent));
      } else {
        map.set(node.id, undefined);
      }
    });
    return map;
  }, [data]);

  const baseDepth = useMemo(() => {
    const depths = data
      .map((node) => (typeof node.depth === 'number' ? node.depth : undefined))
      .filter((value): value is number => typeof value === 'number');
    if (depths.length === 0) {
      return 0;
    }
    return Math.min(...depths);
  }, [data]);

  const isSelected = useCallback((nodeId: string) => selectedIds.includes(nodeId), [selectedIds]);
  const isExpanded = useCallback((nodeId: string) => expandedSet.has(String(nodeId)), [expandedSet]);

  const isVisible = useCallback(
    (nodeId: string): boolean => {
      let current = parentMap.get(nodeId);
      const seen = new Set<string>();
      while (current) {
        if (seen.has(current)) break;
        seen.add(current);
        if (!expandedSet.has(current)) {
          // Parent collapsed (and present in map) => hide
          if (parentMap.has(current)) {
            return false;
          }
        }
        current = parentMap.get(current);
      }
      return true;
    },
    [parentMap, expandedSet],
  );

  const handleSelectAll = (checked: boolean) => {
    if (!onNodeSelect) return;
    const targets = data
      .filter((node) => isVisible(node.id) && isSelected(node.id) !== checked)
      .map((node) => node.id);
    if (targets.length) {
      onNodeSelect(targets, checked);
    }
  };

  const visibleNodes = useMemo(() => data.filter((node) => isVisible(node.id)), [data, isVisible]);

  const allSelected =
    visibleNodes.length > 0 && visibleNodes.every((node) => isSelected(node.id));
  const someSelected = visibleNodes.some((node) => isSelected(node.id));

  const renderRow = (node: HierarchicalTreeNode): React.ReactNode => {
    const hasChildren = Boolean(node.hasChildren) || Boolean(node.children?.length);
    const expanded = isExpanded(node.id);
    const selected = isSelected(node.id);
    const nodeWithAbsolute = node as HierarchicalTreeNode & { absoluteDepth?: number };
    const absoluteDepth = typeof nodeWithAbsolute.absoluteDepth === 'number'
      ? nodeWithAbsolute.absoluteDepth
      : typeof node.depth === 'number'
        ? node.depth
        : 0;
    const level = Math.max(0, absoluteDepth - baseDepth);

    const handleRowClick = (event: React.MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('[data-no-row-click]')) {
        return;
      }
      onNodeClick?.(node);
    };

    return (
      <TableRow
        key={node.id}
        hover
        selected={selected}
        onClick={handleRowClick}
        sx={{
          cursor: 'pointer',
          '&.Mui-selected': {
            bgcolor: 'action.selected',
          },
        }}
      >
        {/* Selection checkbox */}
        {showCheckboxes && (
          <TableCell
            padding="checkbox"
            data-no-row-click="true"
            style={{ padding: '4px 6px', width: 49, minWidth: 49, maxWidth: 49 }}
          >
            <Checkbox
              checked={selected}
              onChange={(e) => {
                onNodeSelect?.([node.id], e.target.checked);
              }}
              size={dense ? 'small' : 'medium'}
            />
          </TableCell>
        )}

        {/* Main content cells */}
        {columns.map((column, columnIndex) => {
          const isFirstColumn = columnIndex === 0;
          // Type-safe property access with index signature
          const nodeWithIndex = node as TreeNode & { [key: string]: unknown };
          const cellValue = nodeWithIndex[column.id];

          return (
            <TableCell
              key={column.id}
              align={column.align || 'left'}
              style={{
                ...(column.width && { width: column.width }),
                paddingLeft: isFirstColumn ? `${level * 24 + 8}px` : '8px',
                paddingRight: '8px',
                borderRight: columnIndex < columns.length - 1 ? '1px solid rgba(224, 224, 224, 1)' : 'none',
                borderBottom: '1px solid rgba(224, 224, 224, 1)',
              }}
            >
              {isFirstColumn && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {/* Expand/collapse button */}
                  <Box sx={{ width: 24, display: 'flex', justifyContent: 'center' }}>
                    {hasChildren ? (
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNodeExpand?.(node.id, !expanded);
                        }}
                        data-no-row-click="true"
                      >
                        {expanded ? (
                          <ExpandMoreIcon fontSize="small" />
                        ) : (
                          <ChevronRightIcon fontSize="small" />
                        )}
                      </IconButton>
                    ) : (
                      <Box sx={{ width: 24 }} />
                    )}
                  </Box>

                  {/* Node icon */}
                  {showIcons && (
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {(() => {
                        const baseIconColor = rainbowColors[Math.max(0, Math.round(absoluteDepth)) % rainbowColors.length];
                        const nodeType = node.nodeType ?? (hasChildren ? 'folder' : 'file');
                        const manifestIconColor = getPluginIconColor(nodeType);
                        const iconColor = isFolderNodeType(nodeType)
                          ? baseIconColor
                          : (manifestIconColor ?? baseIconColor);
                        return hasChildren ? (
                          <FolderIcon fontSize="small" color="inherit" htmlColor={iconColor} />
                        ) : (
                          <FileIcon fontSize="small" color="inherit" htmlColor={iconColor} />
                        );
                      })()}
                    </Box>
                  )}

                  {/* Cell content */}
                  <Box sx={{ flex: 1 }}>
                    {column.render ? column.render(cellValue, node) : String(cellValue || '')}
                  </Box>
                </Box>
              )}

              {!isFirstColumn &&
                (column.render ? column.render(cellValue, node) : String(cellValue || ''))}
            </TableCell>
          );
        })}
      </TableRow>
    );
  };

  const renderLoadingSkeleton = () => {
    return Array.from({ length: 5 }).map((_, index) => (
      <TableRow key={`skeleton-${index}`}>
        {showCheckboxes && (
          <TableCell padding="checkbox" style={{ padding: '4px 6px', width: 49, minWidth: 49, maxWidth: 49 }}>
            <Skeleton variant="rectangular" width={20} height={20} />
          </TableCell>
        )}
        {columns.map((column) => (
          <TableCell key={column.id} sx={{padding: '0px 3px 0px 3px'}}>
            <Skeleton variant="text" width="80%" />
          </TableCell>
        ))}
      </TableRow>
    ));
  };

  return (
    <Paper elevation={0} sx={{ width: '100%', overflow: 'hidden' }}>
      <TableContainer sx={{ maxHeight }}>
        <Table
          stickyHeader={stickyHeader}
          size={dense ? 'small' : 'medium'}
          aria-label="tree table"
        >
          <TableHead>
            <TableRow>
              {/* Selection header */}
              {showCheckboxes && (
                <TableCell
                  padding="checkbox"
                  style={{
                    borderRight: columns.length > 0 ? '1px solid rgba(224, 224, 224, 1)' : 'none',
                    borderBottom: '2px solid rgba(224, 224, 224, 1)',
                    padding: '4px 6px',
                    width: 49,
                    minWidth: 49,
                    maxWidth: 49,
                  }}
                >
                  <Checkbox
                    indeterminate={someSelected && !allSelected}
                    checked={allSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    size={dense ? 'small' : 'medium'}
                  />
                </TableCell>
              )}

              {/* Column headers */}
              {columns.map((column, index) => (
                <TableCell
                  key={column.id}
                  align={column.align || 'left'}
                  style={{
                    fontWeight: 600,
                    ...(column.width && { width: column.width }),
                    borderTop: '1px solid rgba(224, 224, 224, 1)',
                    borderRight: index < columns.length - 1 ? '1px solid rgba(224, 224, 224, 1)' : 'none',
                    borderBottom: '2px solid rgba(224, 224, 224, 1)',
                    padding: '0px 3px 0px 3px',
                  }}
                >
                  {column.sortable && onSort ? (
                    <TableSortLabel
                      active={sortBy === column.id}
                      direction={sortBy === column.id ? sortDirection : 'asc'}
                      onClick={() => onSort(column.id)}
                    >
                      {column.label}
                    </TableSortLabel>
                  ) : (
                    column.label
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {error ? (
              <TableRow>
                <TableCell colSpan={columns.length + (showCheckboxes ? 1 : 0)}>
                  <Box sx={{ p: 2, textAlign: 'center' }}>
                    <Typography color="error">{error}</Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : loading ? (
              renderLoadingSkeleton()
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (showCheckboxes ? 1 : 0)}>
                  <Box sx={{ p: 2, textAlign: 'center' }}>
                    <Typography color="text.secondary">No items to display</Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              visibleNodes.map((node) => renderRow(node as HierarchicalTreeNode))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
});
