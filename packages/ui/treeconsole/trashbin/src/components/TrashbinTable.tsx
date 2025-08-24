/**
 * TrashbinTable - ゴミ箱内のアイテム表示テーブル
 *
 * 削除されたアイテムの一覧表示と復元・完全削除機能
 */

import { useMemo, useState, MouseEvent } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Checkbox,
  Typography,
  Chip,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import type { TrashbinTableProps, TrashItem } from '../types';
import { NodeContextMenu, NodeTypeIcon } from '@hierarchidb/ui-treeconsole-breadcrumb';

// スタイル定義
const StyledTableContainer = styled(Box)`
  width: 100%;
  height: 100%;
  overflow: auto;
  position: relative;
  
  /* Custom scrollbar styling */
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
`;

const StyledTableHead = styled(TableHead)`
  position: sticky;
  top: 0;
  z-index: 10;
  background: ${({ theme }) => theme.palette.background.paper};
  
  & .MuiTableCell-root {
    font-weight: 600;
    border-bottom: 2px solid ${({ theme }) => theme.palette.divider};
    padding: 8px 12px;
    user-select: none;
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
    border-bottom: 1px solid ${({ theme }) => theme.palette.divider};
  }
`;

const ItemCell = styled(Box)`
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
`;

/**
 * TrashbinTable メインコンポーネント
 */
export function TrashbinTable({
  controller,
  viewHeight = 400,
  viewWidth = 800,
  showMetadata = true,
  allowMultiSelect = true,
  NodeTypeIcon: CustomNodeTypeIcon,
  NodeContextMenu: CustomNodeContextMenu,
  onItemDoubleClick,
  onItemContextMenu,
}: TrashbinTableProps) {
  // コンポーネントの選択
  const IconComponent = CustomNodeTypeIcon || NodeTypeIcon;
  const ContextMenuComponent = CustomNodeContextMenu || NodeContextMenu;

  // State
  const [contextMenuState, setContextMenuState] = useState<{
    anchorEl: HTMLElement | null;
    item: TrashItem | null;
  }>({ anchorEl: null, item: null });

  // Get data from controller
  const trashItems = controller?.trashItems || [];
  const selectedItemIds = controller?.selectedItemIds || new Set();
  const searchText = controller?.searchText || '';

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!searchText.trim()) {
      return trashItems;
    }

    const lowerSearchText = searchText.toLowerCase();
    return trashItems.filter(
      (item) =>
        item.name.toLowerCase().includes(lowerSearchText) ||
        item.nodeType.toLowerCase().includes(lowerSearchText) ||
        item.originalPath?.toLowerCase().includes(lowerSearchText)
    );
  }, [trashItems, searchText]);

  // Event handlers
  const handleItemClick = (item: TrashItem, event: MouseEvent) => {
    if (!allowMultiSelect) {
      controller?.onSelectionChange?.([item.id]);
      return;
    }

    const currentSelected = Array.from(selectedItemIds);
    let newSelected: string[];

    if (event.ctrlKey || event.metaKey) {
      // Toggle selection
      if (selectedItemIds.has(item.id)) {
        newSelected = currentSelected.filter((id) => id !== item.id);
      } else {
        newSelected = [...currentSelected, item.id];
      }
    } else {
      // Single selection
      newSelected = [item.id];
    }

    controller?.onSelectionChange?.(newSelected);
    controller?.onItemClick?.(item.id, item);
  };

  const handleItemDoubleClick = (item: TrashItem, event: MouseEvent) => {
    event.stopPropagation();
    onItemDoubleClick?.(item);
  };

  const handleItemContextMenu = (item: TrashItem, event: MouseEvent) => {
    event.preventDefault();
    setContextMenuState({
      anchorEl: event.currentTarget as HTMLElement,
      item,
    });
    onItemContextMenu?.(item, event);
  };

  const handleContextMenuClose = () => {
    setContextMenuState({ anchorEl: null, item: null });
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const allIds = filteredItems.map((item) => item.id);
      controller?.onSelectionChange?.(allIds);
    } else {
      controller?.onSelectionChange?.([]);
    }
  };

  const isAllSelected =
    filteredItems.length > 0 && filteredItems.every((item) => selectedItemIds.has(item.id));
  const isIndeterminate =
    filteredItems.some((item) => selectedItemIds.has(item.id)) && !isAllSelected;

  // Format date
  const formatDate = (date: string | Date | undefined) => {
    if (!date) return '-';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  };

  return (
    <StyledTableContainer sx={{ height: viewHeight, width: viewWidth }}>
      <StyledTable stickyHeader>
        <StyledTableHead>
          <TableRow>
            {allowMultiSelect && (
              <TableCell sx={{ width: 48 }}>
                <Checkbox
                  indeterminate={isIndeterminate}
                  checked={isAllSelected}
                  onChange={handleSelectAll}
                  size="small"
                />
              </TableCell>
            )}
            <TableCell sx={{ width: 300 }}>Name</TableCell>
            <TableCell sx={{ width: 120 }}>Type</TableCell>
            {showMetadata && (
              <>
                <TableCell sx={{ width: 180 }}>Deleted At</TableCell>
                <TableCell sx={{ width: 200 }}>Original Path</TableCell>
              </>
            )}
            <TableCell sx={{ width: 80 }}>Status</TableCell>
          </TableRow>
        </StyledTableHead>

        <TableBody>
          {filteredItems.map((item) => {
            const isSelected = selectedItemIds.has(item.id);

            return (
              <StyledTableRow
                key={item.id}
                selected={isSelected}
                onClick={(e) => handleItemClick(item, e)}
                onDoubleClick={(e) => handleItemDoubleClick(item, e)}
                onContextMenu={(e) => handleItemContextMenu(item, e)}
                sx={{ cursor: 'pointer' }}
              >
                {allowMultiSelect && (
                  <TableCell>
                    <Checkbox
                      checked={isSelected}
                      size="small"
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const newSelected = e.target.checked
                          ? [...Array.from(selectedItemIds), item.id]
                          : Array.from(selectedItemIds).filter((id) => id !== item.id);
                        controller?.onSelectionChange?.(newSelected);
                      }}
                    />
                  </TableCell>
                )}

                <TableCell>
                  <ItemCell>
                    <IconComponent
                      nodeType={item.nodeType || item.type || 'folder'}
                      size="small"
                    />
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {item.name}
                    </Typography>
                  </ItemCell>
                </TableCell>

                <TableCell>
                  <Typography variant="body2">
                    {item.nodeType || item.type || 'Unknown'}
                  </Typography>
                </TableCell>

                {showMetadata && (
                  <>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatDate(item.deletedAt)}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.originalPath || '-'}
                      </Typography>
                    </TableCell>
                  </>
                )}

                <TableCell>
                  <Chip label="Deleted" size="small" color="error" variant="outlined" />
                </TableCell>
              </StyledTableRow>
            );
          })}

          {filteredItems.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={allowMultiSelect ? (showMetadata ? 6 : 4) : showMetadata ? 5 : 3}
                sx={{ textAlign: 'center', py: 4 }}
              >
                <Typography color="text.secondary">
                  {searchText ? 'No items found matching your search.' : 'Trash is empty.'}
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </StyledTable>

      {/* Context Menu */}
      <ContextMenuComponent
        anchorEl={contextMenuState.anchorEl}
        open={Boolean(contextMenuState.anchorEl)}
        onClose={handleContextMenuClose}
        nodeId={contextMenuState.item?.id || ''}
        nodeType={contextMenuState.item?.nodeType || contextMenuState.item?.type || 'folder'}
        nodeName={contextMenuState.item?.name}
        canCreate={false}
        canEdit={false}
        canRemove={true}
        canDuplicate={false}
        mode="restore"
        onRestoreToOriginal={() => {
          if (contextMenuState.item) {
            controller?.onRestore?.([contextMenuState.item.id]);
          }
          handleContextMenuClose();
        }}
        onRemove={() => {
          if (contextMenuState.item) {
            controller?.onPermanentDelete?.([contextMenuState.item.id]);
          }
          handleContextMenuClose();
        }}
      />
    </StyledTableContainer>
  );
}
