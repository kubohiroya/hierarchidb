import React from 'react';
import { memo } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Checkbox,
  IconButton,
  Paper,
  Skeleton,
  Typography,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Folder as FolderIcon,
  InsertDriveFile as FileIcon,
} from '@mui/icons-material';
import { TreeNodeData } from '../../../types/index';

export interface TreeTableColumn {
  readonly id: string;
  readonly label: string;
  readonly width?: number | string;
  readonly sortable?: boolean;
  readonly align?: 'left' | 'center' | 'right';
  readonly render?: (value: unknown, node: TreeNodeData) => React.ReactNode;
}

export interface TreeTableViewProps {
  readonly data: readonly TreeNodeData[];
  readonly columns: readonly TreeTableColumn[];
  readonly loading?: boolean;
  readonly error?: string;
  readonly selectedIds: readonly string[];
  readonly expandedIds: readonly string[];
  readonly sortBy?: string;
  readonly sortDirection?: 'asc' | 'desc';
  readonly onNodeClick?: (node: TreeNodeData) => void;
  readonly onNodeSelect?: (nodeId: string, selected: boolean) => void;
  readonly onNodeExpand?: (nodeId: string, expanded: boolean) => void;
  readonly onSort?: (columnId: string) => void;
  readonly onContextMenu?: (event: React.MouseEvent, node: TreeNodeData) => void;
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
    onContextMenu,
    multiSelect: _multiSelect = true,
    showCheckboxes = true,
    showIcons = true,
    dense = false,
    maxHeight = 600,
    stickyHeader = true,
  } = props;

  const isSelected = (nodeId: string) => selectedIds.includes(nodeId);
  const isExpanded = (nodeId: string) => expandedIds.includes(nodeId);

  const handleSelectAll = (checked: boolean) => {
    if (!onNodeSelect) return;
    data.forEach((node) => {
      if (isSelected(node.id) !== checked) {
        onNodeSelect(node.id, checked);
      }
    });
  };

  const allSelected = data.length > 0 && data.every((node) => isSelected(node.id));
  const someSelected = data.some((node) => isSelected(node.id));

  const renderNode = (node: TreeNodeData, level: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const expanded = isExpanded(node.id);
    const selected = isSelected(node.id);

    const handleRowClick = (event: React.MouseEvent) => {
      // Don't trigger row click if clicking on expand/checkbox
      const target = event.target as HTMLElement;
      if (target.closest('[data-no-row-click]')) {
        return;
      }
      onNodeClick?.(node);
    };

    const handleContextMenu = (event: React.MouseEvent) => {
      event.preventDefault();
      onContextMenu?.(event, node);
    };

    const rows: React.ReactNode[] = [];

    // Main row
    rows.push(
      <TableRow
        key={node.id}
        hover
        selected={selected}
        onClick={handleRowClick}
        onContextMenu={handleContextMenu}
        sx={{
          cursor: 'pointer',
          '&.Mui-selected': {
            bgcolor: 'action.selected',
          },
        }}
      >
        {/* Selection checkbox */}
        {showCheckboxes && (
          <TableCell padding="checkbox" data-no-row-click="true">
            <Checkbox
              checked={selected}
              onChange={(e) => onNodeSelect?.(node.id, e.target.checked)}
              size={dense ? 'small' : 'medium'}
            />
          </TableCell>
        )}

        {/* Main content cells */}
        {columns.map((column, columnIndex) => {
          const isFirstColumn = columnIndex === 0;
          const cellValue = (node as any)[column.id];

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
                      {hasChildren ? (
                        <FolderIcon fontSize="small" color="action" />
                      ) : (
                        <FileIcon fontSize="small" color="action" />
                      )}
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

    // Child rows (if expanded)
    if (expanded && hasChildren && node.children) {
      node.children.forEach((child: any) => {
        rows.push(...renderNode(child, level + 1));
      });
    }

    return rows;
  };

  const renderLoadingSkeleton = () => {
    return Array.from({ length: 5 }).map((_, index) => (
      <TableRow key={`skeleton-${index}`}>
        {showCheckboxes && (
          <TableCell padding="checkbox">
            <Skeleton variant="rectangular" width={20} height={20} />
          </TableCell>
        )}
        {columns.map((column) => (
          <TableCell key={column.id}>
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
                    padding: '8px 12px',
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
                    borderRight: index < columns.length - 1 ? '1px solid rgba(224, 224, 224, 1)' : 'none',
                    borderBottom: '2px solid rgba(224, 224, 224, 1)',
                    padding: '8px 12px',
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
              data.flatMap((node) => renderNode(node))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
});
