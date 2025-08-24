import React, { type MouseEvent } from 'react';
import { memo, useEffect, useRef, useState } from 'react';
import { Divider, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import {
  AssignmentTurnedIn,
  ChevronRight,
  PlayArrow as PlayArrowIcon,
  Add as AddIcon,
  Clear as ClearIcon,
  ContentCopy as ContentCopyIcon,
  Edit as EditIcon,
  Folder as FolderIcon,
} from '@mui/icons-material';
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
      // Close the menu first before opening Edit dialog
      handleMainMenuClose();
      // Open Edit dialog after a slight delay
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

    return (
      <>
        <Menu
          anchorEl={props.parentElem}
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

          <MenuItem onClick={handleRemoveClick} disabled={!props.canRemove} aria-label="Remove">
            <ListItemIcon>
              <ClearIcon color="error" />
            </ListItemIcon>
            <ListItemText>Remove</ListItemText>
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
          <MenuItem
            onClick={() => {
              handleCreateClick('folder');
            }}
            aria-label="Folder"
          >
            <ListItemIcon>
              <FolderIcon />
            </ListItemIcon>
            <ListItemText>Folder</ListItemText>
          </MenuItem>

          {props.addMenuNodeTypes.length > 0 && <Divider />}

          {props.addMenuNodeTypes
            .map((type, index) => {
              const prevType = index > 0 ? props.addMenuNodeTypes[index - 1] : null;

              // Add divider logic based on the specified grouping
              const shouldAddDividerBefore =
                // Divider after BaseMap (before Shapes)
                (type === '_shapes_buggy' && prevType === 'basemap') ||
                // Divider after Routes (before StyleMap)
                (type === 'stylemap' && prevType === 'routes') ||
                // Divider after StyleMap (before PropertyResolver)
                (type === 'propertyresolver' && prevType === 'stylemap');

              const items: React.ReactNode[] = [];

              // Add divider if needed
              if (shouldAddDividerBefore) {
                items.push(<Divider key={`divider-${type}`} />);
              }

              // Add menu item
              items.push(
                <MenuItem key={type} onClick={() => handleCreateClick(type)} aria-label={type}>
                  <ListItemIcon>
                    <FolderIcon />
                  </ListItemIcon>
                  <ListItemText>{type}</ListItemText>
                </MenuItem>
              );

              return items;
            })
            .flat()}
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
  }
);
