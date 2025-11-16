/**
  * NodeContextMenu -
  * TreeTable
  * eria-cartographRowContextMenuMUI
  */

import { type MouseEvent, type ReactElement, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Divider, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import { Add as AddIcon, AssignmentTurnedIn as AssignmentTurnedInIcon, ChevronRight as ChevronRightIcon, Clear as ClearIcon, ContentCopy as ContentCopyIcon, ContentCut as ContentCutIcon, Edit as EditIcon, Folder as FolderIcon, PlayArrow as PlayArrowIcon } from '@mui/icons-material';
import { getMuiIconWithColor } from '@hierarchidb/ui-icon';
import { useGlobalI18nTranslator } from '@hierarchidb/ui-i18n';
type CreateMenuEntry = { key: string; nodeType: string; label: string; description?: string; icon?: { muiIconName?: string; emoji?: string; color?: string } };
type CreateMenuBuilder = (treeId?: string) => CreateMenuEntry[];
type GlobalMenuBuilders = { buildMenuItemsForTreeId?: CreateMenuBuilder; buildMenuItemsForContext?: CreateMenuBuilder };

const logNodeContextMenuWarning = (message: string, error: unknown): void => {
  if (typeof console === 'undefined') return;
  console.warn('[NodeContextMenu]', message, error);
};

export interface NodeContextMenuProps {
  anchorEl: HTMLElement | null;
  anchorPosition?: { top: number; left: number } | null;
  open: boolean;
  onClose: () => void;
  nodeId: string;
  nodeType?: string;
  nodeName?: string;
  treeId?: string;
  canOpen?: boolean;
  canEdit?: boolean;
  canCreate?: boolean;
  /** @deprecated Use canTrash */
  canRemove?: boolean;
  canTrash?: boolean;
  canDuplicate?: boolean;
  canCopy?: boolean;
  canCut?: boolean;
  onOpen?: () => void;
  onOpenFolder?: () => void;
  onPreview?: () => void;
  onEdit?: () => void;
  onCreate?: (type: string) => void;
  onDuplicate?: () => void;
  /** @deprecated Use onTrash */
  onRemove?: () => void;
  onTrash?: () => void;
  onCopy?: () => void;
  onCut?: () => void;
  onCheckReference?: () => void;
  isTrashRoot?: boolean;
  mode?: 'restore' | 'dispose';
  onRestoreToOriginal?: () => void;
  onRestoreToCurrent?: () => void;
  /** Optional explicit create items list; if omitted, tries to build from global builders */
  createItems?: Array<{ type: string; label: string; description?: string }>;
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
    treeId,
    canOpen: _canOpen = true,
    canEdit = true,
    canCreate = true,
    canRemove,
    canTrash = true,
    canDuplicate = true,
    canCopy = true,
    canCut = true,
    onOpen: _onOpen,
    onOpenFolder: _onOpenFolder,
    onPreview: _onPreview,
    onEdit: _onEdit,
    onCreate: _onCreate,
    onDuplicate: _onDuplicate,
    onRemove: _onRemove,
    onTrash: _onTrash,
    onCopy: _onCopy,
    onCut: _onCut,
    onCheckReference: _onCheckReference,
  } = props;


  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [addMenuAnchor, setAddMenuAnchor] = useState<HTMLElement | null>(null);
  const { t, language } = useGlobalI18nTranslator();

  const translateWithFallback = useMemo(() => {
    return (key: string, fallback: string) => {
      const safeFallback = fallback?.trim?.() ?? '';
      const translated = t(key, safeFallback);
      if (translated === key) {
        return safeFallback || key;
      }
      return translated;
    };
  }, [t]);

  const createLabel = translateWithFallback('treeConsole.contextMenu.create', 'Create');
  const openFolderLabel = translateWithFallback('treeConsole.contextMenu.openFolder', 'Open Folder');
  const openLabel = translateWithFallback('treeConsole.contextMenu.open', 'Open');
  const editLabel = translateWithFallback('treeConsole.contextMenu.edit', 'Edit');
  const copyLabel = translateWithFallback('treeConsole.contextMenu.copy', 'Copy');
  const cutLabel = translateWithFallback('treeConsole.contextMenu.cut', 'Cut');
  const duplicateLabel = translateWithFallback('treeConsole.contextMenu.duplicate', 'Duplicate');
  const moveToTrashLabel = translateWithFallback('treeConsole.contextMenu.moveToTrash', 'Move to Trash');
  const allowTrash = (typeof canTrash === 'boolean' ? canTrash : undefined) ?? (canRemove ?? true);
  const checkReferenceLabel = translateWithFallback('treeConsole.contextMenu.checkReference', 'Check Reference');
  const previewLabel = translateWithFallback('treeConsole.contextMenu.preview', 'Preview');

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

  const handleTrashClick = () => {
    const current = propsRef.current;
    const handler = current.onTrash ?? current.onRemove;
    blurActive();
    handleMainMenuClose();
    setTimeout(() => { handler?.(); }, 0);
  };

  const handleCopyClick = () => {
    const onCopy = propsRef.current.onCopy;
    blurActive();
    handleMainMenuClose();
    setTimeout(() => { onCopy?.(); }, 0);
  };

  const handleCutClick = () => {
    const onCut = propsRef.current.onCut;
    blurActive();
    handleMainMenuClose();
    setTimeout(() => { onCut?.(); }, 0);
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

  const fallbackAnchorPosition = !safeAnchorEl && anchorPosition ? anchorPosition : null;

  // If anchor is invalid while menu is open, close it proactively
  useEffect(() => {
    if (open && !safeAnchorEl && !fallbackAnchorPosition) {
      requestAnimationFrame(() => onClose());
    }
  }, [open, safeAnchorEl, fallbackAnchorPosition, onClose]);

  const isFolder =
    nodeType === 'folder' || nodeType === 'folder-plugin' || nodeType === 'ProjectFolder' || nodeType === 'ResourceFolder';

  // Build Create submenu items
  type BuiltItem = { type: string; label: string; description?: string; icon?: { muiIconName?: string; emoji?: string; color?: string } };
  const builtCreateItems: Array<BuiltItem> = (() => {
    if (props.createItems && props.createItems.length) return props.createItems;
    try {
      const g = (globalThis as unknown as { __HDB_MENU_BUILDERS__?: GlobalMenuBuilders }).__HDB_MENU_BUILDERS__;
      const builder: CreateMenuBuilder | undefined = g?.buildMenuItemsForTreeId || g?.buildMenuItemsForContext;
      if (typeof builder === 'function') {
        const items = builder(treeId) as CreateMenuEntry[];
        return (items || []).map((i) => ({ type: i.nodeType, label: i.label, description: i.description, icon: i.icon }));
      }
    } catch (error) {
      logNodeContextMenuWarning('Failed to build dynamic create menu items', error);
    }
    // Fallback minimal entries
    return [
      { type: 'folder', label: 'Folder', description: undefined, icon: { muiIconName: 'Folder' } },
      { type: 'note', label: 'Note', description: undefined, icon: { muiIconName: 'Extension' } },
    ];
  })();

  // Minimal local resolver for common MUI icon names (avoid extra deps)

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
          <MenuItem onClick={handleAddMenuClick} aria-label={createLabel}>
            <ListItemIcon>
              <AddIcon />
            </ListItemIcon>
            <ListItemText primary={createLabel} />
            <ChevronRightIcon sx={{ marginLeft: 'auto' }} />
          </MenuItem>
        )}

        {canCreate && <Divider />}

        {isFolder ? (
          <MenuItem onClick={handleOpenFolderClick} aria-label={openFolderLabel}>
            <ListItemIcon>
              <FolderIcon />
            </ListItemIcon>
            <ListItemText primary={openFolderLabel} />
          </MenuItem>
        ) : (
          <MenuItem onClick={handleOpenClick} aria-label={openLabel}>
            <ListItemIcon>
              <FolderIcon />
            </ListItemIcon>
            <ListItemText primary={openLabel} />
          </MenuItem>
        )}

        <MenuItem onClick={handleEditClick} disabled={!canEdit} aria-label={editLabel}>
          <ListItemIcon>
            <EditIcon />
          </ListItemIcon>
          <ListItemText primary={editLabel} />
        </MenuItem>

        <MenuItem onClick={handleCopyClick} disabled={!canCopy} aria-label={copyLabel}>
          <ListItemIcon>
            <ContentCopyIcon />
          </ListItemIcon>
          <ListItemText primary={copyLabel} />
        </MenuItem>

        <MenuItem onClick={handleCutClick} disabled={!canCut} aria-label={cutLabel}>
          <ListItemIcon>
            <ContentCutIcon />
          </ListItemIcon>
          <ListItemText primary={cutLabel} />
        </MenuItem>

        <MenuItem onClick={handleDuplicateClick} disabled={!canDuplicate} aria-label={duplicateLabel}>
          <ListItemIcon>
            <ContentCopyIcon />
          </ListItemIcon>
          <ListItemText primary={duplicateLabel} />
        </MenuItem>

        <MenuItem onClick={handleTrashClick} disabled={!allowTrash} aria-label={moveToTrashLabel}>
          <ListItemIcon>
            <ClearIcon color="error" />
          </ListItemIcon>
          <ListItemText primary={moveToTrashLabel} />
        </MenuItem>

        <Divider />

        <MenuItem onClick={handleCheckReferenceClick} aria-label={checkReferenceLabel}>
          <ListItemIcon>
            <AssignmentTurnedInIcon />
          </ListItemIcon>
          <ListItemText primary={checkReferenceLabel} />
        </MenuItem>

        {!isFolder && [
          <Divider key="divider-preview" />,
          <MenuItem key="menuitem-preview" onClick={handlePreviewClick} aria-label={previewLabel}>
            <ListItemIcon>
              <PlayArrowIcon />
            </ListItemIcon>
            <ListItemText primary={previewLabel} />
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
          const IconEl: ReactNode = getMuiIconWithColor(ci.icon?.muiIconName, ci.icon?.emoji, ci.icon?.color);
          const localizedLabel = translateWithFallback(`plugins.${ci.type}.name`, ci.label);
          const localizedDescription = translateWithFallback(`plugins.${ci.type}.description`, ci.description ?? '').trim();

          if (localizedDescription.length === 0) {
            return (
              <MenuItem
                key={`${ci.type}-${language}`}
                onClick={() => handleCreateClick(ci.type)}
                aria-label={localizedLabel}
              >
                <ListItemIcon>{IconEl}</ListItemIcon>
                <ListItemText>{localizedLabel}</ListItemText>
              </MenuItem>
            );
          }

          return (
            <Tooltip key={`${ci.type}-${language}`} title={localizedDescription} placement="right" enterDelay={300} arrow>
              <span style={{ display: 'block' }}>
                <MenuItem onClick={() => handleCreateClick(ci.type)} aria-label={localizedLabel}>
                  <ListItemIcon>{IconEl}</ListItemIcon>
                  <ListItemText>{localizedLabel}</ListItemText>
                </MenuItem>
              </span>
            </Tooltip>
          );
        })}
      </Menu>
    </>
  );
}
