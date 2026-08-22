/**
 * BackgroundContextMenu — context menu shown when right-clicking the background
 * of IconView or ColumnView. Provides Reorganize icons, Create (with submenu),
 * Import, and Export actions.
 */

import type { CreateMenuEntryInput } from '@hierarchidb/ui-treeconsole-breadcrumb';
import {
  ChevronRight as ChevronRightIcon,
  Add as CreateIcon,
  FileDownload as ExportIcon,
  FileUpload as ImportIcon,
  GridView as RearrangeIcon,
} from '@mui/icons-material';
import { Divider, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import { type ReactElement } from 'react';
import { useBackgroundContextMenu } from '~/hooks/useBackgroundContextMenu';
import type { SortMode } from '~/types/view-mode-types';

export interface BackgroundContextMenuProps {
  anchorPosition: { left: number; top: number } | null;
  open: boolean;
  onClose: () => void;
  treeId?: string;
  targetNodeId?: string;
  sortMode?: SortMode;
  showReorganize?: boolean;
  createItems?: CreateMenuEntryInput[];
  onContextAction?: (
    action: string,
    node: { id: string },
    options?: Record<string, unknown>
  ) => void;
  onReorganizeIcons?: () => void;
}

export function BackgroundContextMenu(props: BackgroundContextMenuProps): ReactElement | null {
  const {
    anchorPosition,
    open,
    onClose,
    treeId,
    targetNodeId,
    sortMode,
    showReorganize,
    createItems,
    onContextAction,
    onReorganizeIcons,
  } = props;

  const {
    createMenuOpen,
    createMenuAnchor,
    createSubmenuOpen,
    createSubmenuAnchor,
    createSubmenuItems,
    builtCreateItems,
    reorganizeLabel,
    createLabel,
    importLabel,
    exportLabel,
    isReorganizeDisabled,
    showReorganize: effectiveShowReorganize,
    handleCreateMenuClick,
    openCreateSubmenu,
    handleCreateClick,
    handleImportClick,
    handleExportClick,
    handleReorganizeClick,
    handleClose,
    handleCreateSubmenuClose,
    translateWithFallback,
    resolveIcon,
  } = useBackgroundContextMenu({
    treeId,
    targetNodeId,
    sortMode,
    showReorganize,
    createItems,
    onContextAction,
    onReorganizeIcons,
    onClose,
  });

  if (!anchorPosition) return null;

  return (
    <>
      {/* Main background context menu */}
      <Menu
        anchorReference="anchorPosition"
        anchorPosition={{ top: anchorPosition.top, left: anchorPosition.left }}
        open={open}
        onClose={handleClose}
        disablePortal={false}
        disableScrollLock={true}
        keepMounted={false}
        disableAutoFocus
        disableAutoFocusItem
        disableEnforceFocus
        disableRestoreFocus
        MenuListProps={{
          autoFocusItem: false,
          dense: true,
          disablePadding: false,
        }}
        slotProps={{
          paper: {
            elevation: 8,
            sx: { minWidth: 120 },
          },
        }}
      >
        {effectiveShowReorganize && (
          <MenuItem
            onClick={handleReorganizeClick}
            disabled={isReorganizeDisabled}
            aria-label={reorganizeLabel}
          >
            <ListItemIcon>
              <RearrangeIcon />
            </ListItemIcon>
            <ListItemText primary={reorganizeLabel} />
          </MenuItem>
        )}

        {effectiveShowReorganize && <Divider />}

        <MenuItem onClick={handleCreateMenuClick} aria-label={createLabel}>
          <ListItemIcon>
            <CreateIcon />
          </ListItemIcon>
          <ListItemText primary={createLabel} />
          <ChevronRightIcon sx={{ marginLeft: 'auto' }} />
        </MenuItem>

        <MenuItem onClick={handleImportClick} aria-label={importLabel}>
          <ListItemIcon>
            <ImportIcon />
          </ListItemIcon>
          <ListItemText primary={importLabel} />
        </MenuItem>

        <MenuItem onClick={handleExportClick} aria-label={exportLabel}>
          <ListItemIcon>
            <ExportIcon />
          </ListItemIcon>
          <ListItemText primary={exportLabel} />
        </MenuItem>
      </Menu>

      {/* Create submenu */}
      <Menu
        anchorEl={createMenuAnchor}
        open={createMenuOpen}
        onClose={handleClose}
        disablePortal={false}
        disableScrollLock={true}
        keepMounted={false}
        disableAutoFocus
        disableAutoFocusItem
        disableEnforceFocus
        disableRestoreFocus
        MenuListProps={{
          autoFocusItem: false,
          dense: true,
          disablePadding: false,
        }}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        slotProps={{
          paper: {
            elevation: 8,
            sx: { minWidth: 100 },
          },
        }}
      >
        {builtCreateItems.map((ci) => {
          const createType = ci.createType ?? ci.nodeType;
          const hasChildren = Array.isArray(ci.children) && ci.children.length > 0;
          const IconEl = resolveIcon({ nodeType: ci.nodeType, icon: ci.icon });
          const localizedLabel = ci.labelKey
            ? translateWithFallback(ci.labelKey, ci.label)
            : translateWithFallback(`plugins.${ci.nodeType}.name`, ci.label);
          const localizedDescription = (
            ci.descriptionKey
              ? translateWithFallback(ci.descriptionKey, ci.description ?? '')
              : translateWithFallback(`plugins.${ci.nodeType}.description`, ci.description ?? '')
          ).trim();

          if (hasChildren) {
            return (
              <MenuItem
                key={createType}
                onMouseEnter={(event) => openCreateSubmenu(event, ci.children ?? [])}
                onClick={(event) => openCreateSubmenu(event, ci.children ?? [])}
                aria-label={localizedLabel}
              >
                <ListItemIcon>{IconEl}</ListItemIcon>
                <ListItemText>{localizedLabel}</ListItemText>
                <ChevronRightIcon sx={{ marginLeft: 'auto' }} />
              </MenuItem>
            );
          }

          if (localizedDescription.length === 0) {
            return (
              <MenuItem
                key={createType}
                onClick={() => handleCreateClick(createType)}
                aria-label={localizedLabel}
              >
                <ListItemIcon>{IconEl}</ListItemIcon>
                <ListItemText>{localizedLabel}</ListItemText>
              </MenuItem>
            );
          }

          return (
            <Tooltip
              key={createType}
              title={localizedDescription}
              placement="right"
              enterDelay={300}
              arrow
            >
              <MenuItem onClick={() => handleCreateClick(createType)} aria-label={localizedLabel}>
                <ListItemIcon>{IconEl}</ListItemIcon>
                <ListItemText>{localizedLabel}</ListItemText>
              </MenuItem>
            </Tooltip>
          );
        })}
      </Menu>

      {/* Nested submenu for create items with children */}
      <Menu
        anchorEl={createSubmenuAnchor}
        open={createSubmenuOpen}
        onClose={handleCreateSubmenuClose}
        disablePortal={false}
        disableScrollLock={true}
        keepMounted={false}
        disableAutoFocus
        disableAutoFocusItem
        disableEnforceFocus
        disableRestoreFocus
        MenuListProps={{
          autoFocusItem: false,
          dense: true,
          disablePadding: false,
        }}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        slotProps={{
          paper: {
            elevation: 8,
            sx: { minWidth: 180 },
          },
        }}
      >
        {createSubmenuItems.map((item) => {
          const createType = item.createType ?? item.nodeType;
          const IconEl = resolveIcon({ nodeType: item.nodeType, icon: item.icon });
          const localizedLabel = item.labelKey
            ? translateWithFallback(item.labelKey, item.label)
            : translateWithFallback(`plugins.${item.nodeType}.name`, item.label);
          const localizedDescription = (
            item.descriptionKey
              ? translateWithFallback(item.descriptionKey, item.description ?? '')
              : translateWithFallback(
                  `plugins.${item.nodeType}.description`,
                  item.description ?? ''
                )
          ).trim();

          if (localizedDescription.length === 0) {
            return (
              <MenuItem
                key={`${createType}-nested`}
                onClick={() => handleCreateClick(createType)}
                aria-label={localizedLabel}
              >
                <ListItemIcon>{IconEl}</ListItemIcon>
                <ListItemText>{localizedLabel}</ListItemText>
              </MenuItem>
            );
          }

          return (
            <Tooltip
              key={`${createType}-nested`}
              title={localizedDescription}
              placement="right"
              enterDelay={300}
              arrow
            >
              <MenuItem onClick={() => handleCreateClick(createType)} aria-label={localizedLabel}>
                <ListItemIcon>{IconEl}</ListItemIcon>
                <ListItemText>{localizedLabel}</ListItemText>
              </MenuItem>
            </Tooltip>
          );
        })}
      </Menu>
    </>
  );
}
