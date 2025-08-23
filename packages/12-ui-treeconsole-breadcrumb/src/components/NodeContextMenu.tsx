/**
 * NodeContextMenu - 共通のノードコンテキストメニュー
 *
 * パンくずリストとTreeTable行の両方で使用される
 * ノード操作用の統一されたコンテキストメニュー
 * eria-cartographのRowContextMenuMUIの見た目を忠実に再現
 */

import { useState, MouseEvent, useRef, useEffect } from 'react';
import { Menu, MenuItem, ListItemIcon, ListItemText, Divider } from '@mui/material';
import {
  ChevronRight as ChevronRightIcon,
  Add as AddIcon,
  Edit as EditIcon,
  ContentCopy as ContentCopyIcon,
  Clear as ClearIcon,
  Folder as FolderIcon,
  AssignmentTurnedIn as AssignmentTurnedInIcon,
  PlayArrow as PlayArrowIcon,
  CreateNewFolder as CreateFolderIcon,
  NoteAdd as NoteAddIcon,
} from '@mui/icons-material';


export interface NodeContextMenuProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  nodeId: string;
  nodeType?: string;
  nodeName?: string;
  canOpen?: boolean;
  canEdit?: boolean;
  canCreate?: boolean;
  canRemove?: boolean;
  canDuplicate?: boolean;
  onOpen?: () => void;
  onOpenFolder?: () => void;
  onPreview?: () => void;
  onEdit?: () => void;
  onCreate?: (type: string) => void;
  onDuplicate?: () => void;
  onRemove?: () => void;
  onCheckReference?: () => void;
  isTrashRoot?: boolean;
  mode?: 'restore' | 'dispose';
  onRestoreToOriginal?: () => void;
  onRestoreToCurrent?: () => void;
}

/**
 * NodeContextMenu コンポーネント
 * eria-cartographのRowContextMenuMUIのデザインを完全再現
 */
export function NodeContextMenu(props: NodeContextMenuProps) {
  const {
    anchorEl,
    open,
    onClose,
    nodeType = 'folder',
    canOpen: _canOpen = true,
    canEdit = true,
    canCreate = true,
    canRemove = true,
    canDuplicate = true,
    onOpen: _onOpen,
    onOpenFolder: _onOpenFolder,
    onPreview: _onPreview,
    onEdit: _onEdit,
    onCreate: _onCreate,
    onDuplicate: _onDuplicate,
    onRemove: _onRemove,
    onCheckReference: _onCheckReference,
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

  const handleRemoveClick = () => {
    const onRemove = propsRef.current.onRemove;
    handleMainMenuClose();
    requestAnimationFrame(() => {
      onRemove?.();
    });
  };

  const handlePreviewClick = () => {
    const onPreview = propsRef.current.onPreview;
    handleMainMenuClose();
    requestAnimationFrame(() => {
      onPreview?.();
    });
  };

  const handleCheckReferenceClick = () => {
    const onCheckReference = propsRef.current.onCheckReference;
    handleMainMenuClose();
    requestAnimationFrame(() => {
      onCheckReference?.();
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

  return (
    <>
      {/* メインメニュー */}
      <Menu
        anchorEl={anchorEl}
        open={open}
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

        <MenuItem onClick={handleRemoveClick} disabled={!canRemove} aria-label="Remove">
          <ListItemIcon>
            <ClearIcon color="error" />
          </ListItemIcon>
          <ListItemText>Remove</ListItemText>
        </MenuItem>

        <Divider />

        <MenuItem onClick={handleCheckReferenceClick} aria-label="Check Reference">
          <ListItemIcon>
            <AssignmentTurnedInIcon />
          </ListItemIcon>
          <ListItemText>Check Reference</ListItemText>
        </MenuItem>

        {!isFolder && (
          <>
            <Divider />
            <MenuItem onClick={handlePreviewClick} aria-label="Preview">
              <ListItemIcon>
                <PlayArrowIcon />
              </ListItemIcon>
              <ListItemText>Preview</ListItemText>
            </MenuItem>
          </>
        )}
      </Menu>

      {/* Create サブメニュー */}
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
        
        <MenuItem onClick={() => handleCreateClick('note')} aria-label="Note">
          <ListItemIcon>
            <NoteAddIcon />
          </ListItemIcon>
          <ListItemText>Note</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
