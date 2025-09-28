/**
  * NodeContextMenu -
  * TreeTable
  * eria-cartographRowContextMenuMUI
  */

import { type MouseEvent, useEffect, useRef, useState } from 'react';
import { Divider, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import { Add as AddIcon, AssignmentTurnedIn as AssignmentTurnedInIcon, ChevronRight as ChevronRightIcon, Clear as ClearIcon, ContentCopy as ContentCopyIcon, Edit as EditIcon, Folder as FolderIcon, PlayArrow as PlayArrowIcon } from '@mui/icons-material';
import { getMuiIconWithColor } from '@hierarchidb/ui-icon';
type CreateMenuEntry = { key: string; nodeType: string; label: string; icon?: { muiIconName?: string; emoji?: string; color?: string } };
type CreateMenuBuilder = (treeId?: string) => CreateMenuEntry[];
type GlobalMenuBuilders = { buildMenuItemsForTreeId?: CreateMenuBuilder; buildMenuItemsForContext?: CreateMenuBuilder };

const logNodeContextMenuWarning = (message: string, error: unknown): void => {
  if (typeof console === 'undefined') return;
  console.warn('[NodeContextMenu]', message, error);
};


export interface NodeContextMenuProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  nodeId: string;
  nodeType?: string;
  nodeName?: string;
  treeId?: string;
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
  /** Optional explicit create items list; if omitted, tries to build from global builders */
  createItems?: Array<{ type: string; label: string }>;
}

/**
  * NodeContextMenu
 * eria-cartographRowContextMenuMUI
  */
import type { ReactElement } from 'react';
export function NodeContextMenu(props: NodeContextMenuProps): ReactElement | null {
  const {
    anchorEl,
    open,
    onClose,
    nodeType = 'folder',
    treeId,
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

  const blurActive = () => {
    try {
      const el = (globalThis?.document?.activeElement ?? null) as HTMLElement | null;
      el?.blur?.();
    } catch (error) {
      logNodeContextMenuWarning('Failed to blur active element', error);
    }
  };

  const handleOpenClick = () => {
    const onOpen = propsRef.current.onOpen;
    blurActive();
    handleMainMenuClose();
    // Defer until after menu unmount/aria-hidden settles
    setTimeout(() => { onOpen?.(); }, 0);
  };

  const handleOpenFolderClick = () => {
    const onOpenFolder = propsRef.current.onOpenFolder;
    blurActive();
    handleMainMenuClose();
    setTimeout(() => { onOpenFolder?.(); }, 0);
  };

  const handleEditClick = () => {
    const onEdit = propsRef.current.onEdit;
    blurActive();
    handleMainMenuClose();
    setTimeout(() => { onEdit?.(); }, 0);
  };

  const handleCreateClick = (type: string) => {
    const onCreate = propsRef.current.onCreate;
    blurActive();
    handleMainMenuClose();
    setTimeout(() => { onCreate?.(type); }, 0);
  };

  const handleDuplicateClick = () => {
    const onDuplicate = propsRef.current.onDuplicate;
    blurActive();
    handleMainMenuClose();
    setTimeout(() => { onDuplicate?.(); }, 0);
  };

  const handleRemoveClick = () => {
    const onRemove = propsRef.current.onRemove;
    blurActive();
    handleMainMenuClose();
    setTimeout(() => { onRemove?.(); }, 0);
  };

  const handlePreviewClick = () => {
    const onPreview = propsRef.current.onPreview;
    blurActive();
    handleMainMenuClose();
    setTimeout(() => { onPreview?.(); }, 0);
  };

  const handleCheckReferenceClick = () => {
    const onCheckReference = propsRef.current.onCheckReference;
    blurActive();
    handleMainMenuClose();
    setTimeout(() => { onCheckReference?.(); }, 0);
  };

  // Effect to ensure menus are closed when anchorEl changes
  useEffect(() => {
    if (!anchorEl) {
      setAddMenuOpen(false);
      setAddMenuAnchor(null);
    }
  }, [anchorEl]);

  // Guard: ensure anchorEl is part of document layout
  const safeAnchorEl = (() => {
    try {
      if (!anchorEl) return null;
      const doc = anchorEl.ownerDocument || document;
      return doc.contains(anchorEl) ? anchorEl : null;
    } catch (error) {
      logNodeContextMenuWarning('Failed to validate context menu anchor', error);
      return null;
    }
  })();

  // If anchor is invalid while menu is open, close it proactively
  useEffect(() => {
    if (open && !safeAnchorEl) {
      requestAnimationFrame(() => onClose());
    }
  }, [open, safeAnchorEl, onClose]);

  const isFolder =
    nodeType === 'folder' || nodeType === 'folder-plugin' || nodeType === 'ProjectFolder' || nodeType === 'ResourceFolder';

  // Build Create submenu items
  type BuiltItem = { type: string; label: string; icon?: { muiIconName?: string; emoji?: string; color?: string } };
  const builtCreateItems: Array<BuiltItem> = (() => {
    if (props.createItems && props.createItems.length) return props.createItems;
    try {
      const g = (globalThis as unknown as { __HDB_MENU_BUILDERS__?: GlobalMenuBuilders }).__HDB_MENU_BUILDERS__;
      const builder: CreateMenuBuilder | undefined = g?.buildMenuItemsForTreeId || g?.buildMenuItemsForContext;
      if (typeof builder === 'function') {
        const items = builder(treeId) as CreateMenuEntry[];
        return (items || []).map((i) => ({ type: i.nodeType, label: i.label, icon: i.icon }));
      }
    } catch (error) {
      logNodeContextMenuWarning('Failed to build dynamic create menu items', error);
    }
    // Fallback minimal entries
    return [
      { type: 'folder', label: 'Folder', icon: { muiIconName: 'Folder' } },
      { type: 'note', label: 'Note', icon: { muiIconName: 'Extension' } },
    ];
  })();

  // Minimal local resolver for common MUI icon names (avoid extra deps)

  return (
    <>
      {/*
*/}
      <Menu
        anchorEl={safeAnchorEl}
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

        <MenuItem onClick={handleRemoveClick} disabled={!canRemove} aria-label="Move to Trash">
          <ListItemIcon>
            <ClearIcon color="error" />
          </ListItemIcon>
          <ListItemText>Move to Trash</ListItemText>
        </MenuItem>

        <Divider />

        <MenuItem onClick={handleCheckReferenceClick} aria-label="Check Reference">
          <ListItemIcon>
            <AssignmentTurnedInIcon />
          </ListItemIcon>
          <ListItemText>Check Reference</ListItemText>
        </MenuItem>

        {!isFolder && [
          <Divider key="divider-preview" />,
          <MenuItem key="menuitem-preview" onClick={handlePreviewClick} aria-label="Preview">
            <ListItemIcon>
              <PlayArrowIcon />
            </ListItemIcon>
            <ListItemText>Preview</ListItemText>
          </MenuItem>,
        ]}
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
        {builtCreateItems.map((ci) => {
          const IconEl = getMuiIconWithColor(ci.icon?.muiIconName, ci.icon?.emoji, ci.icon?.color) as React.ReactNode;
          return (
            <MenuItem key={ci.type} onClick={() => handleCreateClick(ci.type)} aria-label={ci.label}>
              <ListItemIcon>{IconEl}</ListItemIcon>
              <ListItemText>{ci.label}</ListItemText>
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
