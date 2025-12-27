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
import { type MouseEvent, type ReactElement, useEffect, useRef, useState } from 'react';

export interface NodeContextMenuProps {
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
  onToggleInvisible?: (nextValue: boolean) => void;
  isInvisible?: boolean;
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
export function NodeContextMenu(props: NodeContextMenuProps): ReactElement | null {
  const {
    anchorEl,
    anchorPosition,
    open,
    onClose,
    nodeType = 'folder',
    canOpen: _canOpen = true,
    canEdit = true,
    canCreate = true,
    canRemove,
    canTrash,
    canDuplicate = true,
    onOpen: _onOpen,
    onOpenFolder: _onOpenFolder,
    onPreview: _onPreview,
    onEdit: _onEdit,
    onCreate: _onCreate,
    onDuplicate: _onDuplicate,
    onRemove: _onRemove,
    onTrash: _onTrash,
    onToggleInvisible: _onToggleInvisible,
    isInvisible = false,
    addMenuNodeTypes = [],
  } = props;

  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [addMenuAnchor, setAddMenuAnchor] = useState<HTMLElement | null>(null);

  // Use refs to store the latest props to avoid stale closures
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  });

  const handleAddMenuClick = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    event.preventDefault();
    // Get the menu item element as anchor
    const menuItem = event.currentTarget.closest('li');
    if (menuItem) {
      setAddMenuAnchor(menuItem as HTMLElement);
      setAddMenuOpen(true);
    }
  };

  const handleMainMenuClose = () => {
    // Close all submenus as well
    setAddMenuOpen(false);
    setAddMenuAnchor(null);
    onClose();
  };

  const handleOpenClick = () => {
    const onOpen = propsRef.current.onOpen;
    handleMainMenuClose();
    // Call onOpen after menu is closed to avoid conflicts
    requestAnimationFrame(() => {
      onOpen?.();
    });
  };

  const handleOpenFolderClick = () => {
    const onOpenFolder = propsRef.current.onOpenFolder;
    handleMainMenuClose();
    requestAnimationFrame(() => {
      onOpenFolder?.();
    });
  };

  const handleEditClick = () => {
    const onEdit = propsRef.current.onEdit;
    handleMainMenuClose();
    requestAnimationFrame(() => {
      onEdit?.();
    });
  };

  const handleCreateClick = (type: string) => {
    const onCreate = propsRef.current.onCreate;
    handleMainMenuClose();
    requestAnimationFrame(() => {
      onCreate?.(type);
    });
  };

  const handleDuplicateClick = () => {
    const onDuplicate = propsRef.current.onDuplicate;
    handleMainMenuClose();
    requestAnimationFrame(() => {
      onDuplicate?.();
    });
  };

  const handleTrashClick = () => {
    const current = propsRef.current;
    const handler = current.onTrash ?? current.onRemove;
    handleMainMenuClose();
    requestAnimationFrame(() => {
      handler?.();
    });
  };

  const handlePreviewClick = () => {
    const onPreview = propsRef.current.onPreview;
    handleMainMenuClose();
    requestAnimationFrame(() => {
      onPreview?.();
    });
  };

  const handleToggleInvisible = () => {
    const onToggleInvisible = propsRef.current.onToggleInvisible;
    const nextInvisible = !Boolean(propsRef.current.isInvisible);
    handleMainMenuClose();
    requestAnimationFrame(() => {
      onToggleInvisible?.(nextInvisible);
    });
  };

  // Effect to ensure menus are closed when anchorEl changes
  useEffect(() => {
    if (!anchorEl) {
      setAddMenuOpen(false);
      setAddMenuAnchor(null);
    }
  }, [anchorEl]);

  const isFolder =
    nodeType === 'folder' || nodeType === 'ProjectFolder' || nodeType === 'ResourceFolder';
  const allowTrash = (typeof canTrash === 'boolean' ? canTrash : undefined) ?? canRemove ?? true;

  const safeAnchorEl = (() => {
    try {
      if (!anchorEl) return null;
      const doc = anchorEl.ownerDocument || document;
      return doc.contains(anchorEl) ? anchorEl : null;
    } catch (error) {
      console.warn('[NodeContextMenu] Failed to validate context menu anchor', error);
      return null;
    }
  })();

  const fallbackAnchorPosition = !safeAnchorEl && anchorPosition ? anchorPosition : null;

  useEffect(() => {
    if (open && !safeAnchorEl && !fallbackAnchorPosition) {
      requestAnimationFrame(() => handleMainMenuClose());
    }
  }, [open, safeAnchorEl, fallbackAnchorPosition]);

  return (
    <>
      {/*
       */}
      <Menu
        anchorEl={safeAnchorEl}
        anchorReference={fallbackAnchorPosition ? 'anchorPosition' : 'anchorEl'}
        anchorPosition={fallbackAnchorPosition ?? undefined}
        open={open && (!!safeAnchorEl || !!fallbackAnchorPosition)}
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
          <MenuItem onClick={handleAddMenuClick} aria-label="Create">
            <ListItemIcon>
              <AddIcon />
            </ListItemIcon>
            <ListItemText>Create</ListItemText>
            <ChevronRightIcon sx={{ marginLeft: 'auto' }} />
          </MenuItem>
        )}

        {canCreate && <Divider />}

        {isFolder ? (
          <MenuItem onClick={handleOpenFolderClick} aria-label="Open Folder">
            <ListItemIcon>
              <FolderIcon />
            </ListItemIcon>
            <ListItemText>Open Folder</ListItemText>
          </MenuItem>
        ) : (
          <MenuItem onClick={handleOpenClick} aria-label="Open">
            <ListItemIcon>
              <FolderIcon />
            </ListItemIcon>
            <ListItemText>Open</ListItemText>
          </MenuItem>
        )}

        <MenuItem onClick={handleEditClick} disabled={!canEdit} aria-label="Edit">
          <ListItemIcon>
            <EditIcon />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>

        <MenuItem onClick={handleDuplicateClick} disabled={!canDuplicate} aria-label="Duplicate">
          <ListItemIcon>
            <ContentCopyIcon />
          </ListItemIcon>
          <ListItemText>Duplicate</ListItemText>
        </MenuItem>

        <MenuItem onClick={handleTrashClick} disabled={!allowTrash} aria-label="Move to Trash">
          <ListItemIcon>
            <ClearIcon color="error" />
          </ListItemIcon>
          <ListItemText>Move to Trash</ListItemText>
        </MenuItem>

        <Divider />

        <MenuItem onClick={handleToggleInvisible} aria-label={isInvisible ? 'Invisible' : 'Visible'}>
          <ListItemIcon>
            {isInvisible ? <VisibilityOffIcon /> : <VisibilityIcon />}
          </ListItemIcon>
          <ListItemText>{isInvisible ? 'Invisible' : 'Visible'}</ListItemText>
          <Switch
            checked={!isInvisible}
            size="small"
            onChange={(event) => {
              event.stopPropagation();
              handleToggleInvisible();
            }}
            inputProps={{ 'aria-label': isInvisible ? 'Invisible' : 'Visible' }}
          />
        </MenuItem>

        {!isFolder && (
          <>
            <Divider />
            <MenuItem onClick={handlePreviewClick} aria-label="Preview" disabled={isInvisible}>
              <ListItemIcon>
                <PlayArrowIcon />
              </ListItemIcon>
              <ListItemText>Preview</ListItemText>
            </MenuItem>
          </>
        )}
      </Menu>

      {/*
 Create
*/}
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
        <MenuItem onClick={() => handleCreateClick('folder')} aria-label="Folder">
          <ListItemIcon>
            <CreateFolderIcon />
          </ListItemIcon>
          <ListItemText>Folder</ListItemText>
        </MenuItem>

        {addMenuNodeTypes.length > 0 && <Divider />}

        <MenuItem onClick={() => handleCreateClick('note')} aria-label="Note">
          <ListItemIcon>
            <NoteAddIcon />
          </ListItemIcon>
          <ListItemText>Note</ListItemText>
        </MenuItem>

        <MenuItem onClick={() => handleCreateClick('file')} aria-label="File">
          <ListItemIcon>
            <FileIcon />
          </ListItemIcon>
          <ListItemText>File</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
