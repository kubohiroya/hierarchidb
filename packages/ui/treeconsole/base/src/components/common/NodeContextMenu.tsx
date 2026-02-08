/**
 * NodeContextMenu -
 * TreeTable
 * eria-cartographRowContextMenuMUI
 */

import {
  Add as AddIcon,
  ChevronRight as ChevronRightIcon,
  Clear as ClearIcon,
  ContentCopy as ContentCopyIcon,
  CreateNewFolder as CreateFolderIcon,
  Edit as EditIcon,
  InsertDriveFile as FileIcon,
  Folder as FolderIcon,
  NoteAdd as NoteAddIcon,
  PlayArrow as PlayArrowIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import { Divider, ListItemIcon, ListItemText, Menu, MenuItem, Switch } from '@mui/material';
import type { ReactElement } from 'react';
import { useTreeConsoleNodeContextMenu } from '../../hooks/useTreeConsoleNodeContextMenu.js';

export interface TreeConsoleNodeContextMenuProps {
  anchorEl: HTMLElement | null;
  anchorPosition?: { top: number; left: number } | null;
  open: boolean;
  onClose: () => void;
  nodeId: string;
  nodeType?: string;
  nodeName?: string;
  canOpen?: boolean;
  canEdit?: boolean;
  canCreate?: boolean;
  canRemove?: boolean;
  canTrash?: boolean;
  canDuplicate?: boolean;
  onOpen?: () => void;
  onOpenFolder?: () => void;
  onPreview?: () => void;
  onEdit?: () => void;
  onCreate?: (type: string) => void;
  onDuplicate?: () => void;
  /** @deprecated Use onTrash */
  onRemove?: () => void;
  onTrash?: () => void;
  onToggleVisible?: (nextValue: boolean) => void;
  isVisible?: boolean;
  addMenuNodeTypes?: string[];
  isTrashRoot?: boolean;
  mode?: 'restore' | 'dispose';
  onRestoreToOriginal?: () => void;
  onRestoreToCurrent?: () => void;
}

/**
 * NodeContextMenu
 * eria-cartographRowContextMenuMUI
 */
export function NodeContextMenu(props: TreeConsoleNodeContextMenuProps): ReactElement | null {
  const { canCreate = true, canEdit = true, canDuplicate = true, addMenuNodeTypes = [] } = props;

  const {
    addMenuOpen,
    addMenuAnchor,
    isFolder,
    allowTrash,
    safeAnchorEl,
    fallbackAnchorPosition,
    effectiveVisible,
    effectiveInvisible,
    labels,
    handleAddMenuClick,
    handleMainMenuClose,
    handleOpenClick,
    handleOpenFolderClick,
    handleEditClick,
    handleCreateClick,
    handleDuplicateClick,
    handleTrashClick,
    handlePreviewClick,
    handleToggleVisible,
  } = useTreeConsoleNodeContextMenu(props);

  return (
    <>
      <Menu
        anchorEl={safeAnchorEl}
        anchorReference={fallbackAnchorPosition ? 'anchorPosition' : 'anchorEl'}
        anchorPosition={fallbackAnchorPosition ?? undefined}
        open={props.open && (!!safeAnchorEl || !!fallbackAnchorPosition)}
        onClose={handleMainMenuClose}
        disablePortal={false}
        keepMounted={false}
        disableScrollLock={true}
        disableAutoFocus
        disableAutoFocusItem
        disableEnforceFocus
        disableRestoreFocus
        MenuListProps={{
          'aria-labelledby': 'basic-button',
          autoFocusItem: false,
          dense: true,
          disablePadding: false,
        }}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        slotProps={{
          paper: {
            elevation: 8,
            sx: {
              zIndex: 9999,
              minWidth: 120,
            },
          },
        }}
      >
        {canCreate && (
          <MenuItem onClick={handleAddMenuClick} aria-label={labels.create}>
            <ListItemIcon>
              <AddIcon />
            </ListItemIcon>
            <ListItemText>{labels.create}</ListItemText>
            <ChevronRightIcon sx={{ marginLeft: 'auto' }} />
          </MenuItem>
        )}

        {canCreate && <Divider />}

        {isFolder ? (
          <MenuItem onClick={handleOpenFolderClick} aria-label={labels.openFolder}>
            <ListItemIcon>
              <FolderIcon />
            </ListItemIcon>
            <ListItemText>{labels.openFolder}</ListItemText>
          </MenuItem>
        ) : (
          <MenuItem onClick={handleOpenClick} aria-label={labels.open}>
            <ListItemIcon>
              <FolderIcon />
            </ListItemIcon>
            <ListItemText>{labels.open}</ListItemText>
          </MenuItem>
        )}

        <MenuItem onClick={handleEditClick} disabled={!canEdit} aria-label={labels.edit}>
          <ListItemIcon>
            <EditIcon />
          </ListItemIcon>
          <ListItemText>{labels.edit}</ListItemText>
        </MenuItem>

        <MenuItem onClick={handleDuplicateClick} disabled={!canDuplicate} aria-label={labels.duplicate}>
          <ListItemIcon>
            <ContentCopyIcon />
          </ListItemIcon>
          <ListItemText>{labels.duplicate}</ListItemText>
        </MenuItem>

        <MenuItem onClick={handleTrashClick} disabled={!allowTrash} aria-label={labels.moveToTrash}>
          <ListItemIcon>
            <ClearIcon color="error" />
          </ListItemIcon>
          <ListItemText>{labels.moveToTrash}</ListItemText>
        </MenuItem>

        <Divider />

        <MenuItem
          onClick={handleToggleVisible}
          aria-label={effectiveInvisible ? labels.hidden : labels.visible}
          sx={{ minWidth: 200 }}
        >
          <ListItemIcon>
            {effectiveInvisible ? <VisibilityOffIcon /> : <VisibilityIcon />}
          </ListItemIcon>
          <ListItemText>{effectiveInvisible ? labels.hidden : labels.visible}</ListItemText>
          <Switch
            checked={effectiveVisible}
            size="small"
            onChange={(event) => {
              event.stopPropagation();
              handleToggleVisible();
            }}
            sx={{ ml: 'auto' }}
            inputProps={{ 'aria-label': effectiveInvisible ? labels.hidden : labels.visible }}
          />
        </MenuItem>

        {!isFolder && (
          <>
            <Divider />
            <MenuItem onClick={handlePreviewClick} aria-label={labels.preview} disabled={!effectiveVisible}>
              <ListItemIcon>
                <PlayArrowIcon />
              </ListItemIcon>
              <ListItemText>{labels.preview}</ListItemText>
            </MenuItem>
          </>
        )}
      </Menu>

      <Menu
        anchorEl={addMenuAnchor}
        open={addMenuOpen}
        onClose={handleMainMenuClose}
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
            sx: {
              zIndex: 9999,
              minWidth: 100,
            },
          },
        }}
      >
        <MenuItem onClick={() => handleCreateClick('folder')} aria-label={labels.createFolder}>
          <ListItemIcon>
            <CreateFolderIcon />
          </ListItemIcon>
          <ListItemText>{labels.createFolder}</ListItemText>
        </MenuItem>

        {addMenuNodeTypes.length > 0 && <Divider />}

        <MenuItem onClick={() => handleCreateClick('note')} aria-label={labels.createNote}>
          <ListItemIcon>
            <NoteAddIcon />
          </ListItemIcon>
          <ListItemText>{labels.createNote}</ListItemText>
        </MenuItem>

        <MenuItem onClick={() => handleCreateClick('file')} aria-label={labels.createFile}>
          <ListItemIcon>
            <FileIcon />
          </ListItemIcon>
          <ListItemText>{labels.createFile}</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
