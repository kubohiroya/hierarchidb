import React, { memo, type MouseEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import type { CreateMenuBuilder, GlobalMenuBuilders, CreateMenuEntry } from '@hierarchidb/common-type';
import { Divider, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import { Add as AddIcon, AssignmentTurnedIn, ChevronRight, Clear as ClearIcon, ContentCopy as ContentCopyIcon, Edit as EditIcon, Folder as FolderIcon, PlayArrow as PlayArrowIcon } from '@mui/icons-material';
import { getMuiIconWithColor } from '@hierarchidb/ui-icon';

// Defer resolving ui-core to runtime to avoid build-time type resolution issues

// import { TreeNodeType } from "~/types"; // Unused

export interface RowContextMenuProps {
  readonly nodeType: string;
  readonly addMenuNodeTypes: string[];
  readonly parentElem: HTMLElement | null;
  readonly onClose: () => void;
  readonly onOpen: () => void;
  readonly onOpenFolder: () => void;
  readonly onPreview: () => void;
  readonly onEdit: () => void;
  readonly onCreate: (type: string) => void;
  readonly onDuplicate: () => void;
  readonly onRemove: () => void;
  readonly onCheckReference: () => void;
  readonly canOpen: boolean;
  readonly canEdit: boolean;
  readonly canCreate: boolean;
  readonly canRemove: boolean;
  readonly canDuplicate: boolean;
  readonly isTrashRoot?: boolean;
  readonly mode?: 'restore' | 'dispose';
  readonly onRestoreToOriginal?: () => void;
  readonly onRestoreToCurrent?: () => void;
  /** Optional treeId for context-aware Create submenu (e.g., 'r'|'t'|'p') */
  readonly treeId?: string;
}

export const RowContextMenu = memo(
  function RowContextMenu(props: RowContextMenuProps) {
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

    // No registry dependency: use global menu-builders injected by the host app

    const handleOpenClick = () => {
      const onOpen = propsRef.current.onOpen;
      handleMainMenuClose();
      // Call onOpen after menu is closed to avoid conflicts
      requestAnimationFrame(() => {
        onOpen();
      });
    };

    const handleMainMenuClose = () => {
      // Close all submenus as well
      setAddMenuOpen(false);
      setAddMenuAnchor(null);
      propsRef.current.onClose();
    };

    const handleCreateClick = (type: string) => {
      const onCreate = propsRef.current.onCreate;
      handleMainMenuClose();
      // Call onCreate after menu is closed to avoid conflicts
      requestAnimationFrame(() => {
        onCreate(type);
      });
    };

    const handleOpenFolderClick = () => {
      const onOpenFolder = propsRef.current.onOpenFolder;
      handleMainMenuClose();
      // Call onOpenFolder after menu is closed to avoid conflicts
      requestAnimationFrame(() => {
        onOpenFolder();
      });
    };

    const handleEditClick = () => {
      const onEdit = propsRef.current.onEdit;
      // Close the menu first before opening Edit base-dialog
      handleMainMenuClose();
      // Open Edit base-dialog after a slight delay
      requestAnimationFrame(() => {
        onEdit();
      });
    };

    const handleDuplicateClick = () => {
      const onDuplicate = propsRef.current.onDuplicate;
      handleMainMenuClose();
      requestAnimationFrame(() => {
        onDuplicate();
      });
    };

    const handleRemoveClick = () => {
      const onRemove = propsRef.current.onRemove;
      handleMainMenuClose();
      requestAnimationFrame(() => {
        onRemove();
      });
    };

    const handlePreviewClick = () => {
      const onPreview = propsRef.current.onPreview;
      handleMainMenuClose();
      requestAnimationFrame(() => {
        onPreview();
      });
    };

    const handleCheckReferenceClick = () => {
      const onCheckReference = propsRef.current.onCheckReference;
      handleMainMenuClose();
      requestAnimationFrame(() => {
        onCheckReference();
      });
    };

    // Effect to ensure menus are closed when parentElem changes
    useEffect(() => {
      if (!props.parentElem) {
        setAddMenuOpen(false);
        setAddMenuAnchor(null);
      }
    }, [props.parentElem]);

    const isFolder = props.nodeType === 'folder';

    // Guard: ensure anchorEl is part of document layout
    const safeAnchorEl = (() => {
      const el = props.parentElem;
      try {
        if (!el) return null;
        const doc = el.ownerDocument || document;
        return doc.contains(el) ? el : null;
      } catch {
        return null;
      }
    })();

    useEffect(() => {
      if (safeAnchorEl === null && propsRef.current.parentElem && propsRef.current.onClose) {
        // Parent element disappeared; close the menu to avoid MUI warnings
        requestAnimationFrame(() => propsRef.current.onClose());
      }
    }, [safeAnchorEl]);

    return (
      <>
        <Menu
        anchorEl={safeAnchorEl}
        open={Boolean(props.parentElem)}
        onClose={handleMainMenuClose}
          disablePortal={false} // Enable portal to display outside scroll container
          keepMounted={false} // Don't keep mounted to avoid stale handlers
          disableScrollLock={true} // Disable scroll lock to prevent issues with virtual scroll
          disableAutoFocus
          disableAutoFocusItem
          disableEnforceFocus
          disableRestoreFocus
          MenuListProps={{
            'aria-labelledby': 'basic-button',
            autoFocusItem: false, // Prevent auto-focus issues
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
          <MenuItem onClick={handleAddMenuClick} aria-label="Create">
            <ListItemIcon>
              <AddIcon />
            </ListItemIcon>
            <ListItemText>Create</ListItemText>
            <ChevronRight sx={{ marginLeft: 'auto' }} />
          </MenuItem>

          <Divider />

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

          <MenuItem onClick={handleEditClick} disabled={!props.canEdit} aria-label="Edit">
            <ListItemIcon>
              <EditIcon />
            </ListItemIcon>
            <ListItemText>Edit</ListItemText>
          </MenuItem>

          <MenuItem
            onClick={handleDuplicateClick}
            disabled={!props.canDuplicate}
            aria-label="Duplicate"
          >
            <ListItemIcon>
              <ContentCopyIcon />
            </ListItemIcon>
            <ListItemText>Duplicate</ListItemText>
          </MenuItem>

          <MenuItem onClick={handleRemoveClick} disabled={!props.canRemove} aria-label="Move to Trash">
            <ListItemIcon>
              <ClearIcon color="error" />
            </ListItemIcon>
            <ListItemText>Move to Trash</ListItemText>
          </MenuItem>

          <Divider />

          <MenuItem onClick={handleCheckReferenceClick} aria-label="Check Reference">
            <ListItemIcon>
              <AssignmentTurnedIn />
            </ListItemIcon>
            <ListItemText>Check Reference</ListItemText>
          </MenuItem>

          {!isFolder && <Divider />}
          {!isFolder && (
            <MenuItem onClick={handlePreviewClick} aria-label="Preview">
              <ListItemIcon>
                <PlayArrowIcon />
              </ListItemIcon>
              <ListItemText>Preview</ListItemText>
            </MenuItem>
          )}
        </Menu>

        {/* Add submenu */}
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
          {/* Dynamic plugin-driven create menu via global menu-builders */}
          {(() => {
            try {
              const g = (globalThis as unknown as { __HDB_MENU_BUILDERS__?: GlobalMenuBuilders }).__HDB_MENU_BUILDERS__;
              const builder: CreateMenuBuilder | undefined = g?.buildMenuItemsForTreeId || g?.buildMenuItemsForContext;
              if (typeof builder !== 'function') {
                return (
                  <MenuItem disabled>
                    <ListItemText>Create menu unavailable</ListItemText>
                  </MenuItem>
                );
              }

              // Build items from treeId (resources/projects context)
              const items = builder(props.treeId) as CreateMenuEntry[];
              return (items || []).map((i) => {
                const IconEl: ReactNode = getMuiIconWithColor(i.icon?.muiIconName, i.icon?.emoji, i.icon?.color);
                return (
                  <MenuItem key={i.key} onClick={() => handleCreateClick(i.nodeType)} aria-label={i.nodeType}>
                    <ListItemIcon>{IconEl}</ListItemIcon>
                    <ListItemText primary={i.label} />
                  </MenuItem>
                );
              });
            } catch {
              return (
                <MenuItem disabled>
                  <ListItemText>Create menu unavailable</ListItemText>
                </MenuItem>
              );
            }
          })()}
        </Menu>
      </>
    );
  },
  (prevProps, nextProps) => {
    // Compare only important properties
    return (
      prevProps.nodeType === nextProps.nodeType &&
      prevProps.canOpen === nextProps.canOpen &&
      prevProps.canEdit === nextProps.canEdit &&
      prevProps.canCreate === nextProps.canCreate &&
      prevProps.canRemove === nextProps.canRemove &&
      prevProps.canDuplicate === nextProps.canDuplicate &&
      prevProps.parentElem === nextProps.parentElem &&
      prevProps.addMenuNodeTypes.length === nextProps.addMenuNodeTypes.length &&
      prevProps.addMenuNodeTypes.every((type, index) => type === nextProps.addMenuNodeTypes[index])
    );
  },
);
