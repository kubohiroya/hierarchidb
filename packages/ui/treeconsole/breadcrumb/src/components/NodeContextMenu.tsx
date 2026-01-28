/**
  * NodeContextMenu -
  * TreeTable
  * eria-cartographRowContextMenuMUI
  */

import { type MouseEvent, type ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Divider, ListItemIcon, ListItemText, Menu, MenuItem, Switch, Tooltip } from '@mui/material';
import {
  Add as AddIcon,
  ChevronRight as ChevronRightIcon,
  Clear as ClearIcon,
  ContentCopy as ContentCopyIcon,
  ContentCut as ContentCutIcon,
  Construction as ConstructionIcon,
  Edit as EditIcon,
  FileCopy as DuplicateIcon,
  Folder as FolderIcon,
  PlayArrow as PlayArrowIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import { useIconRegistry } from '@hierarchidb/ui-icon';
import { useGlobalI18nTranslator } from '@hierarchidb/ui-i18n';
import { isFolderNodeType } from '../utils/nodeTypeIconColor.js';
type CreateMenuEntry = { key: string; nodeType: string; label: string; description?: string; icon?: { muiIconName?: string; emoji?: string; color?: string } };
type CreateMenuBuilder = (treeId?: string) => CreateMenuEntry[];
type GlobalMenuBuilders = { buildMenuItemsForTreeId?: CreateMenuBuilder; buildMenuItemsForContext?: CreateMenuBuilder };
const buildableNodeTypes = new Set(['styler', 'shape', 'route']);

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
  canBuild?: boolean;
  canPreview?: boolean;
  onOpen?: () => void;
  onOpenFolder?: () => void;
  onPreview?: () => void;
  onBuild?: () => void;
  onEdit?: () => void;
  onCreate?: (type: string) => void;
  onDuplicate?: () => void;
  /** @deprecated Use onTrash */
  onRemove?: () => void;
  onTrash?: () => void;
  onCopy?: () => void;
  onCut?: () => void;
  onToggleVisible?: (nextValue: boolean) => void;
  isVisible?: boolean;
  isTrashRoot?: boolean;
  mode?: 'restore' | 'dispose';
  onRestoreToOriginal?: () => void;
  onRestoreToCurrent?: () => void;
  /** Optional explicit create items list; if omitted, tries to stage from global builders */
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
    canBuild,
    canPreview: canPreviewOverride,
    onOpen: _onOpen,
    onOpenFolder: _onOpenFolder,
    onPreview: _onPreview,
    onBuild: _onBuild,
    onEdit: _onEdit,
    onCreate: _onCreate,
    onDuplicate: _onDuplicate,
    onRemove: _onRemove,
    onTrash: _onTrash,
    onCopy: _onCopy,
    onCut: _onCut,
    onToggleVisible: _onToggleVisible,
    isVisible,
  } = props;

  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [addMenuAnchor, setAddMenuAnchor] = useState<HTMLElement | null>(null);
  const [localInvisible, setLocalInvisible] = useState<boolean | null>(null);
  const { t, language } = useGlobalI18nTranslator();
  const { resolveIcon } = useIconRegistry();

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
  const visibleLabel = translateWithFallback('treeConsole.contextMenu.visible', 'Visible');
  const hiddenLabel = translateWithFallback('treeConsole.contextMenu.hidden', 'Hidden');
  const previewLabel = translateWithFallback('treeConsole.contextMenu.preview', 'Preview');
  const buildLabel = translateWithFallback('treeConsole.contextMenu.build', 'Build');
  const effectiveVisible =
    localInvisible !== null ? !localInvisible : (typeof isVisible === 'boolean' ? isVisible : true);
  const effectiveInvisible = !effectiveVisible;
  const canPreview = typeof canPreviewOverride === 'boolean' ? canPreviewOverride : !effectiveInvisible;
  const normalizedNodeType = String(nodeType ?? '').trim().toLowerCase();
  const isLocationNode = normalizedNodeType === 'location';
  const canBuildEntry =
    Boolean(_onBuild) &&
    (typeof canBuild === 'boolean'
      ? canBuild
      : isFolderNodeType(nodeType) || buildableNodeTypes.has(normalizedNodeType));
  const showBuildEntry = Boolean(_onBuild) && (canBuildEntry || isLocationNode);
  const buildDisabled = !canBuildEntry || isLocationNode;

  // Use refs to store the latest props to avoid stale closures
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  });

  useEffect(() => {
    if (!open) {
      setLocalInvisible(null);
      return;
    }
    const resolvedVisible = typeof isVisible === 'boolean' ? isVisible : true;
    if (localInvisible !== null && localInvisible === !resolvedVisible) {
      setLocalInvisible(null);
    }
  }, [open, isVisible, localInvisible]);

  const handleAddMenuClick = useCallback((event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    event.preventDefault();
    // Get the menu item element as anchor
    const menuItem = event.currentTarget.closest('li');
    if (menuItem) {
      setAddMenuAnchor(menuItem as HTMLElement);
      setAddMenuOpen(true);
    }
  },[]);

  const handleMainMenuClose = useCallback(() => {
    // Close all submenus as well
    setAddMenuOpen(false);
    setAddMenuAnchor(null);
    onClose();
  },[onClose]);

  const blurActive = useCallback(() => {
    try {
      const el = (globalThis?.document?.activeElement ?? null) as HTMLElement | null;
      el?.blur?.();
    } catch (error) {
      logNodeContextMenuWarning('Failed to blur active element', error);
    }
  },[]);

  const handleOpenClick = useCallback(() => {
    const onOpen = propsRef.current.onOpen;
    blurActive();
    handleMainMenuClose();
    // Defer until after menu unmount/aria-hidden settles
    setTimeout(() => { onOpen?.(); }, 0);
  }, [blurActive, handleMainMenuClose]);

  const handleOpenFolderClick = useCallback(() => {
    const onOpenFolder = propsRef.current.onOpenFolder;
    blurActive();
    handleMainMenuClose();
    setTimeout(() => { onOpenFolder?.(); }, 0);
  }, [blurActive, handleMainMenuClose]);

  const handleEditClick = useCallback(() => {
    const onEdit = propsRef.current.onEdit;
    blurActive();
    handleMainMenuClose();
    setTimeout(() => { onEdit?.(); }, 0);
  }, [blurActive, handleMainMenuClose]);

  const handleCreateClick = useCallback((type: string) => {
    const onCreate = propsRef.current.onCreate;
    blurActive();
    handleMainMenuClose();
    setTimeout(() => { onCreate?.(type); }, 0);
  }, [blurActive, handleMainMenuClose]);

  const handleDuplicateClick = useCallback(() => {
    const onDuplicate = propsRef.current.onDuplicate;
    blurActive();
    handleMainMenuClose();
    setTimeout(() => { onDuplicate?.(); }, 0);
  }, [blurActive, handleMainMenuClose]);

  const handleTrashClick = useCallback(() => {
    const current = propsRef.current;
    const handler = current.onTrash ?? current.onRemove;
    blurActive();
    handleMainMenuClose();
    setTimeout(() => { handler?.(); }, 0);
  }, [blurActive, handleMainMenuClose]);

  const handleCopyClick = useCallback(() => {
    const onCopy = propsRef.current.onCopy;
    blurActive();
    handleMainMenuClose();
    setTimeout(() => { onCopy?.(); }, 0);
  }, [blurActive, handleMainMenuClose]);

  const handleCutClick = useCallback(() => {
    const onCut = propsRef.current.onCut;
    blurActive();
    handleMainMenuClose();
    setTimeout(() => { onCut?.(); }, 0);
  }, [blurActive, handleMainMenuClose]);

  const handlePreviewClick = useCallback(() => {
    const onPreview = propsRef.current.onPreview;
    blurActive();
    handleMainMenuClose();
    setTimeout(() => { onPreview?.(); }, 0);
  }, [blurActive, handleMainMenuClose]);

  const handleBuildClick = useCallback(() => {
    const onBuild = propsRef.current.onBuild;
    blurActive();
    handleMainMenuClose();
    setTimeout(() => { onBuild?.(); }, 0);
  }, [blurActive, handleMainMenuClose]);

  const handleToggleVisible = useCallback(() => {
    const onToggleVisible = propsRef.current.onToggleVisible;
    const nextVisible = !effectiveVisible;
    blurActive();
    setLocalInvisible(!nextVisible);
    setTimeout(() => { onToggleVisible?.(nextVisible); }, 0);
  }, [blurActive, effectiveVisible]);

  // Effect to ensure menus are closed when anchorEl changes
  useEffect(() => {
    if (!anchorEl) {
      setAddMenuOpen(false);
      setAddMenuAnchor(null);
    }
  }, [anchorEl]);

  // Guard: ensure anchorEl is part of document layout
  const safeAnchorEl = useMemo(() => {
    try {
      if (!anchorEl) return null;
      const doc = anchorEl.ownerDocument || document;
      return doc.contains(anchorEl) ? anchorEl : null;
    } catch (error) {
      logNodeContextMenuWarning('Failed to validate context menu anchor', error);
      return null;
    }
  }, [anchorEl]);

  const hasAnchorPosition = Boolean(anchorPosition);
  const anchorReference: 'anchorEl' | 'anchorPosition' = hasAnchorPosition ? 'anchorPosition' : 'anchorEl';
  const resolvedAnchorPosition = hasAnchorPosition ? anchorPosition : null;
  const anchorForMenu = anchorReference === 'anchorEl' ? safeAnchorEl : null;

  // If anchor is invalid while menu is open, close it proactively
  useEffect(() => {
    if (anchorReference === 'anchorEl' && open && !anchorForMenu) {
      requestAnimationFrame(() => onClose());
    }
  }, [anchorReference, open, anchorForMenu, onClose]);

  const isFolder =
    nodeType === 'folder' || nodeType === 'folder-plugin' || nodeType === 'ProjectFolder' || nodeType === 'ResourceFolder';

  // Build Create submenu items
  type BuiltItem = { type: string; label: string; description?: string; icon?: { muiIconName?: string; emoji?: string; color?: string } };
  const builtCreateItems: Array<BuiltItem> = (() => {
    if (props.createItems?.length) return props.createItems;
    try {
      const g = (globalThis as unknown as { __HDB_MENU_BUILDERS__?: GlobalMenuBuilders }).__HDB_MENU_BUILDERS__;
      const builder: CreateMenuBuilder | undefined = g?.buildMenuItemsForTreeId || g?.buildMenuItemsForContext;
      if (typeof builder === 'function') {
        const items = builder(treeId) as CreateMenuEntry[];
        return (items || []).map((i) => ({ type: i.nodeType, label: i.label, description: i.description, icon: i.icon }));
      }
    } catch (error) {
      logNodeContextMenuWarning('Failed to stage dynamic create menu items', error);
    }
    // Fallback minimal entries
    return [
      { type: 'folder', label: 'Folder', description: undefined, icon: { muiIconName: 'Folder' } },
      { type: 'note', label: 'Note', description: undefined, icon: { muiIconName: 'Extension' } },
    ];
  })();

  // Minimal local resolver for _obsolate_common MUI icon names (avoid extra deps)

  return (
    <>
      {/*
*/}
      <Menu
        anchorEl={anchorForMenu}
        anchorReference={anchorReference}
        anchorPosition={resolvedAnchorPosition ?? undefined}
        open={open && (anchorReference === 'anchorPosition' ? !!resolvedAnchorPosition : !!anchorForMenu)}
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

        <MenuItem onClick={handleCutClick} disabled={!canCut} aria-label={cutLabel}>
          <ListItemIcon>
            <ContentCutIcon />
          </ListItemIcon>
          <ListItemText primary={cutLabel} />
        </MenuItem>

        <MenuItem onClick={handleCopyClick} disabled={!canCopy} aria-label={copyLabel}>
          <ListItemIcon>
            <ContentCopyIcon />
          </ListItemIcon>
          <ListItemText primary={copyLabel} />
        </MenuItem>

        <MenuItem onClick={handleDuplicateClick} disabled={!canDuplicate} aria-label={duplicateLabel}>
          <ListItemIcon>
            <DuplicateIcon />
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

        <MenuItem
          onClick={handleToggleVisible}
          aria-label={effectiveInvisible ? hiddenLabel : visibleLabel}
          sx={{ minWidth: 200 }}
        >
          <ListItemIcon>
            {effectiveInvisible ? <VisibilityOffIcon /> : <VisibilityIcon />}
          </ListItemIcon>
          <ListItemText primary={effectiveInvisible ? hiddenLabel : visibleLabel} />
          <Switch
            checked={effectiveVisible}
            onChange={(event) => {
              event.stopPropagation();
              handleToggleVisible();
            }}
            size="small"
            sx={{ ml: 'auto' }}
            inputProps={{ 'aria-label': effectiveInvisible ? hiddenLabel : visibleLabel }}
          />
        </MenuItem>

        {[
          <Divider key="divider-action-group" />,
          isFolder ? (
            <MenuItem key="menuitem-open-folder" onClick={handleOpenFolderClick} aria-label={openFolderLabel}>
              <ListItemIcon>
                <FolderIcon />
              </ListItemIcon>
              <ListItemText primary={openFolderLabel} />
            </MenuItem>
          ) : (
            <MenuItem key="menuitem-open" onClick={handleOpenClick} aria-label={openLabel}>
              <ListItemIcon>
                <FolderIcon />
              </ListItemIcon>
              <ListItemText primary={openLabel} />
            </MenuItem>
          ),
          <MenuItem key="menuitem-edit" onClick={handleEditClick} disabled={!canEdit} aria-label={editLabel}>
            <ListItemIcon>
              <EditIcon />
            </ListItemIcon>
            <ListItemText primary={editLabel} />
          </MenuItem>,
          showBuildEntry ? (
            <MenuItem
              key="menuitem-build"
              onClick={handleBuildClick}
              aria-label={buildLabel}
              disabled={buildDisabled}
            >
              <ListItemIcon>
                <ConstructionIcon />
              </ListItemIcon>
              <ListItemText primary={buildLabel} />
            </MenuItem>
          ) : null,
          <MenuItem
            key="menuitem-preview"
            onClick={handlePreviewClick}
            aria-label={previewLabel}
            disabled={!canPreview}
          >
            <ListItemIcon>
              <PlayArrowIcon />
            </ListItemIcon>
            <ListItemText primary={previewLabel} />
          </MenuItem>,
        ].filter(Boolean)}
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
          const IconEl = resolveIcon({ nodeType: ci.type, icon: ci.icon });
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
