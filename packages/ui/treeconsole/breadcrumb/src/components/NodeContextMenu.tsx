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
  FileDownload as FileDownloadIcon,
  FileUpload as FileUploadIcon,
  FileCopy as DuplicateIcon,
  Folder as FolderIcon,
  OpenInNew as OpenInNewIcon,
  PlayArrow as PlayArrowIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import { useIconRegistry } from '@hierarchidb/ui-icon';
import { useGlobalI18nTranslator } from '@hierarchidb/ui-i18n';
import { isFolderNodeType } from '~/utils/nodeTypeIconColor';
type CreateMenuEntry = {
  key: string;
  nodeType: string;
  createType?: string;
  label: string;
  labelKey?: string;
  description?: string;
  descriptionKey?: string;
  icon?: { muiIconName?: string; emoji?: string; color?: string };
  children?: CreateMenuEntry[];
};
type CreateMenuBuilder = (treeId?: string) => CreateMenuEntry[];
type GlobalMenuBuilders = { buildMenuItemsForTreeId?: CreateMenuBuilder; buildMenuItemsForContext?: CreateMenuBuilder };
const buildableNodeTypes = new Set(['styler', 'shape', 'route']);
export type OpenStepOption = { step: number; label?: string; disabled?: boolean };

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
  /** @deprecated Use canArchive */
  canRemove?: boolean;
  canArchive?: boolean;
  canDuplicate?: boolean;
  canCopy?: boolean;
  canCut?: boolean;
  canImport?: boolean;
  canExport?: boolean;
  canBuild?: boolean;
  canPreview?: boolean;
  onOpen?: (options?: { openInNewTab?: boolean }) => void;
  onOpenFolder?: (options?: { openInNewTab?: boolean }) => void;
  onOpenStep?: (step: number, options?: { openInNewTab?: boolean }) => void;
  onPreview?: (options?: { openInNewTab?: boolean }) => void;
  onBuild?: (options?: { openInNewTab?: boolean }) => void;
  onEdit?: (options?: { openInNewTab?: boolean }) => void;
  onCreate?: (type: string, options?: { openInNewTab?: boolean }) => void;
  onDuplicate?: () => void;
  /** @deprecated Use onArchive */
  onRemove?: () => void;
  onArchive?: () => void;
  onCopy?: () => void;
  onCut?: () => void;
  onImport?: () => void;
  onExport?: () => void;
  onToggleVisible?: (nextValue: boolean) => void;
  isVisible?: boolean;
  isArchiveRoot?: boolean;
  mode?: 'restore' | 'dispose';
  onRestoreToOriginal?: () => void;
  onRestoreToCurrent?: () => void;
  /** Optional explicit create items list; if omitted, tries to stage from global builders */
  createItems?: Array<{
    type: string;
    createType?: string;
    label: string;
    labelKey?: string;
    description?: string;
    descriptionKey?: string;
    icon?: { muiIconName?: string; emoji?: string; color?: string };
    children?: Array<{
      type: string;
      createType?: string;
      label: string;
      labelKey?: string;
      description?: string;
      descriptionKey?: string;
      icon?: { muiIconName?: string; emoji?: string; color?: string };
    }>;
  }>;
  /** Optional step options for "Open" submenu */
  openSteps?: OpenStepOption[];
  /** Optional loading flag for async step options */
  openStepsLoading?: boolean;
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
    canArchive = true,
    canDuplicate = true,
    canCopy = true,
    canCut = true,
    canImport = true,
    canExport = true,
    canBuild,
    canPreview: canPreviewOverride,
    onOpen: _onOpen,
    onOpenFolder: _onOpenFolder,
    onOpenStep: _onOpenStep,
    onPreview: _onPreview,
    onBuild: _onBuild,
    onEdit: _onEdit,
    onCreate: _onCreate,
    onDuplicate: _onDuplicate,
    onRemove: _onRemove,
    onArchive: _onArchive,
    onCopy: _onCopy,
    onCut: _onCut,
    onImport: _onImport,
    onExport: _onExport,
    onToggleVisible: _onToggleVisible,
    isVisible,
    openSteps = [],
    openStepsLoading = false,
  } = props;

  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [addMenuAnchor, setAddMenuAnchor] = useState<HTMLElement | null>(null);
  const [createSubmenuOpen, setCreateSubmenuOpen] = useState(false);
  const [createSubmenuAnchor, setCreateSubmenuAnchor] = useState<HTMLElement | null>(null);
  const [createSubmenuItems, setCreateSubmenuItems] = useState<CreateMenuEntry[]>([]);
  const [openStepMenuOpen, setOpenStepMenuOpen] = useState(false);
  const [openStepMenuAnchor, setOpenStepMenuAnchor] = useState<HTMLElement | null>(null);
  const [localInvisible, setLocalInvisible] = useState<boolean | null>(null);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
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
  const moveToArchiveLabel = translateWithFallback('treeConsole.contextMenu.moveToArchive', 'Move to Archive');
  const importLabel = translateWithFallback('treeConsole.contextMenu.import', 'Import');
  const exportLabel = translateWithFallback('treeConsole.contextMenu.export', 'Export');
  const allowArchive = (typeof canArchive === 'boolean' ? canArchive : undefined) ?? (canRemove ?? true);
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
  const openInNewAdornment = isShiftPressed ? <OpenInNewIcon fontSize="small" sx={{ m: 0, p: 0, fontSize: '95%' }} /> : null;

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        setIsShiftPressed(true);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        setIsShiftPressed(false);
      }
    };
    const onBlur = () => {
      setIsShiftPressed(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

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

  const openCreateSubmenu = useCallback((event: MouseEvent<HTMLElement>, children: CreateMenuEntry[]) => {
    event.stopPropagation();
    event.preventDefault();
    const menuItem = event.currentTarget.closest('li');
    if (!menuItem) return;
    setCreateSubmenuAnchor(menuItem as HTMLElement);
    setCreateSubmenuItems(children);
    setCreateSubmenuOpen(true);
  }, []);

  const handleOpenStepMenuClick = useCallback((event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    event.preventDefault();
    const menuItem = event.currentTarget.closest('li');
    if (menuItem) {
      setOpenStepMenuAnchor(menuItem as HTMLElement);
      setOpenStepMenuOpen(true);
    }
  }, []);

  const handleMainMenuClose = useCallback(() => {
    // Close all submenus as well
    setAddMenuOpen(false);
    setAddMenuAnchor(null);
    setCreateSubmenuOpen(false);
    setCreateSubmenuAnchor(null);
    setCreateSubmenuItems([]);
    setOpenStepMenuOpen(false);
    setOpenStepMenuAnchor(null);
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

  const resolveOpenInNew = useCallback(
    (event?: MouseEvent<HTMLElement>) => Boolean(event?.shiftKey || isShiftPressed),
    [isShiftPressed]
  );

  const handleOpenClick = useCallback((event?: MouseEvent<HTMLElement>) => {
    const onOpen = propsRef.current.onOpen;
    const openInNewTab = resolveOpenInNew(event);
    blurActive();
    handleMainMenuClose();
    // Defer until after menu unmount/aria-hidden settles
    setTimeout(() => { onOpen?.({ openInNewTab }); }, 0);
  }, [blurActive, handleMainMenuClose, resolveOpenInNew]);

  const handleOpenStepClick = useCallback((step: number, event?: MouseEvent<HTMLElement>) => {
    const onOpenStep = propsRef.current.onOpenStep;
    const openInNewTab = resolveOpenInNew(event);
    blurActive();
    handleMainMenuClose();
    setTimeout(() => { onOpenStep?.(step, { openInNewTab }); }, 0);
  }, [blurActive, handleMainMenuClose, resolveOpenInNew]);

  const handleOpenFolderClick = useCallback((event?: MouseEvent<HTMLElement>) => {
    const onOpenFolder = propsRef.current.onOpenFolder;
    const openInNewTab = resolveOpenInNew(event);
    blurActive();
    handleMainMenuClose();
    setTimeout(() => { onOpenFolder?.({ openInNewTab }); }, 0);
  }, [blurActive, handleMainMenuClose, resolveOpenInNew]);

  const handleEditClick = useCallback((event?: MouseEvent<HTMLElement>) => {
    const onEdit = propsRef.current.onEdit;
    const openInNewTab = resolveOpenInNew(event);
    blurActive();
    handleMainMenuClose();
    setTimeout(() => { onEdit?.({ openInNewTab }); }, 0);
  }, [blurActive, handleMainMenuClose, resolveOpenInNew]);

  const handleCreateClick = useCallback((type: string, event?: MouseEvent<HTMLElement>) => {
    const onCreate = propsRef.current.onCreate;
    const openInNewTab = resolveOpenInNew(event);
    blurActive();
    handleMainMenuClose();
    setTimeout(() => { onCreate?.(type, { openInNewTab }); }, 0);
  }, [blurActive, handleMainMenuClose, resolveOpenInNew]);

  const handleDuplicateClick = useCallback(() => {
    const onDuplicate = propsRef.current.onDuplicate;
    blurActive();
    handleMainMenuClose();
    setTimeout(() => { onDuplicate?.(); }, 0);
  }, [blurActive, handleMainMenuClose]);

  const handleArchiveClick = useCallback(() => {
    const current = propsRef.current;
    const handler = current.onArchive ?? current.onRemove;
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

  const handleImportClick = useCallback(() => {
    const onImport = propsRef.current.onImport;
    blurActive();
    handleMainMenuClose();
    setTimeout(() => { onImport?.(); }, 0);
  }, [blurActive, handleMainMenuClose]);

  const handleExportClick = useCallback(() => {
    const onExport = propsRef.current.onExport;
    blurActive();
    handleMainMenuClose();
    setTimeout(() => { onExport?.(); }, 0);
  }, [blurActive, handleMainMenuClose]);

  const handlePreviewClick = useCallback((event?: MouseEvent<HTMLElement>) => {
    const onPreview = propsRef.current.onPreview;
    const openInNewTab = resolveOpenInNew(event);
    blurActive();
    handleMainMenuClose();
    setTimeout(() => { onPreview?.({ openInNewTab }); }, 0);
  }, [blurActive, handleMainMenuClose, resolveOpenInNew]);

  const handleBuildClick = useCallback((event?: MouseEvent<HTMLElement>) => {
    const onBuild = propsRef.current.onBuild;
    const openInNewTab = resolveOpenInNew(event);
    blurActive();
    handleMainMenuClose();
    setTimeout(() => { onBuild?.({ openInNewTab }); }, 0);
  }, [blurActive, handleMainMenuClose, resolveOpenInNew]);

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
      setCreateSubmenuOpen(false);
      setCreateSubmenuAnchor(null);
      setCreateSubmenuItems([]);
      setOpenStepMenuOpen(false);
      setOpenStepMenuAnchor(null);
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

  const isFolder = isFolderNodeType(nodeType);
  const hasOpenSteps = Boolean(_onOpenStep && (openSteps.length > 0 || openStepsLoading));
  const showImport = isFolder && Boolean(_onImport) && canImport;
  const showExport = isFolder && Boolean(_onExport) && canExport;

  // Build Create submenu items
  const builtCreateItems: Array<CreateMenuEntry> = (() => {
    if (props.createItems?.length) {
      return props.createItems.map((item) => ({
        key: item.createType ?? item.type,
        nodeType: item.type,
        createType: item.createType,
        label: item.label,
        labelKey: item.labelKey,
        description: item.description,
        descriptionKey: item.descriptionKey,
        icon: item.icon,
        children: (item.children ?? []).map((child) => ({
          key: child.createType ?? child.type,
          nodeType: child.type,
          createType: child.createType,
          label: child.label,
          labelKey: child.labelKey,
          description: child.description,
          descriptionKey: child.descriptionKey,
          icon: child.icon,
        })),
      }));
    }
    try {
      const g = (globalThis as unknown as { __HDB_MENU_BUILDERS__?: GlobalMenuBuilders }).__HDB_MENU_BUILDERS__;
      const builder: CreateMenuBuilder | undefined = g?.buildMenuItemsForTreeId || g?.buildMenuItemsForContext;
      if (typeof builder === 'function') {
        const items = builder(treeId) as CreateMenuEntry[];
        return (items || []).map((i) => ({
          key: i.key ?? (i.createType ?? i.nodeType),
          nodeType: i.nodeType,
          createType: i.createType,
          label: i.label,
          labelKey: i.labelKey,
          description: i.description,
          descriptionKey: i.descriptionKey,
          icon: i.icon,
          children: (i.children ?? []).map((child) => ({
            key: child.key ?? (child.createType ?? child.nodeType),
            nodeType: child.nodeType,
            createType: child.createType,
            label: child.label,
            labelKey: child.labelKey,
            description: child.description,
            descriptionKey: child.descriptionKey,
            icon: child.icon,
          })),
        }));
      }
    } catch (error) {
      logNodeContextMenuWarning('Failed to stage dynamic create menu items', error);
    }
    // Fallback minimal entries
    return [
      { key: 'folder', nodeType: 'folder', label: 'Folder', description: undefined, icon: { muiIconName: 'Folder' } },
      { key: 'note', nodeType: 'note', label: 'Note', description: undefined, icon: { muiIconName: 'Extension' } },
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

        {showImport && (
          <MenuItem onClick={handleImportClick} aria-label={importLabel}>
            <ListItemIcon>
              <FileUploadIcon />
            </ListItemIcon>
            <ListItemText primary={importLabel} />
          </MenuItem>
        )}

        {showExport && (
          <MenuItem onClick={handleExportClick} aria-label={exportLabel}>
            <ListItemIcon>
              <FileDownloadIcon />
            </ListItemIcon>
            <ListItemText primary={exportLabel} />
          </MenuItem>
        )}

        {(showImport || showExport) && <Divider />}

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

        <MenuItem onClick={handleArchiveClick} disabled={!allowArchive} aria-label={moveToArchiveLabel}>
          <ListItemIcon>
            <ClearIcon color="error" />
          </ListItemIcon>
          <ListItemText primary={moveToArchiveLabel} />
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
          <MenuItem key="menuitem-open-folder" onClick={(event) => handleOpenFolderClick(event)} aria-label={openFolderLabel}>
            <ListItemIcon>
              <FolderIcon />
            </ListItemIcon>
            <ListItemText primary={openFolderLabel} />
            {openInNewAdornment ? <span style={{ marginLeft: 'auto' }}>{openInNewAdornment}</span> : null}
          </MenuItem>
        ) : hasOpenSteps ? (
          <MenuItem key="menuitem-open-steps" onClick={handleOpenStepMenuClick} aria-label={openLabel}>
            <ListItemIcon>
              <FolderIcon />
            </ListItemIcon>
            <ListItemText primary={openLabel} />
            <ChevronRightIcon sx={{ marginLeft: 'auto' }} />
          </MenuItem>
        ) : (
          <MenuItem key="menuitem-open" onClick={(event) => handleOpenClick(event)} aria-label={openLabel}>
            <ListItemIcon>
              <FolderIcon />
            </ListItemIcon>
            <ListItemText primary={openLabel} />
            {openInNewAdornment ? <span style={{ marginLeft: 'auto' }}>{openInNewAdornment}</span> : null}
          </MenuItem>
        ),
          <MenuItem key="menuitem-edit" onClick={(event) => handleEditClick(event)} disabled={!canEdit} aria-label={editLabel}>
            <ListItemIcon>
              <EditIcon />
            </ListItemIcon>
            <ListItemText primary={editLabel} />
            {openInNewAdornment ? <span style={{ marginLeft: 'auto' }}>{openInNewAdornment}</span> : null}
          </MenuItem>,
          showBuildEntry ? (
            <MenuItem
              key="menuitem-build"
              onClick={(event) => handleBuildClick(event)}
              aria-label={buildLabel}
              disabled={buildDisabled}
            >
              <ListItemIcon>
                <ConstructionIcon />
              </ListItemIcon>
              <ListItemText primary={buildLabel} />
              {openInNewAdornment ? <span style={{ marginLeft: 'auto' }}>{openInNewAdornment}</span> : null}
            </MenuItem>
          ) : null,
          <MenuItem
            key="menuitem-preview"
            onClick={(event) => handlePreviewClick(event)}
            aria-label={previewLabel}
            disabled={!canPreview}
          >
            <ListItemIcon>
              <PlayArrowIcon />
            </ListItemIcon>
            <ListItemText primary={previewLabel} />
            {openInNewAdornment ? <span style={{ marginLeft: 'auto' }}>{openInNewAdornment}</span> : null}
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
          const createType = ci.createType ?? ci.nodeType;
          const hasChildren = Array.isArray(ci.children) && ci.children.length > 0;
          const IconEl = resolveIcon({ nodeType: ci.nodeType, icon: ci.icon });
          const localizedLabel = ci.labelKey
            ? translateWithFallback(ci.labelKey, ci.label)
            : translateWithFallback(`plugins.${ci.nodeType}.name`, ci.label);
          const localizedDescription = (ci.descriptionKey
            ? translateWithFallback(ci.descriptionKey, ci.description ?? '')
            : translateWithFallback(`plugins.${ci.nodeType}.description`, ci.description ?? '')).trim();

          if (hasChildren) {
            return (
              <MenuItem
                key={`${createType}-${language}`}
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
                key={`${createType}-${language}`}
                onClick={(event) => handleCreateClick(createType, event)}
                aria-label={localizedLabel}
              >
                <ListItemIcon>{IconEl}</ListItemIcon>
                <ListItemText>{localizedLabel}</ListItemText>
                {openInNewAdornment ? <span style={{ marginLeft: 'auto' }}>{openInNewAdornment}</span> : null}
              </MenuItem>
            );
          }

          return (
            <Tooltip key={`${createType}-${language}`} title={localizedDescription} placement="right" enterDelay={300} arrow>
              <span style={{ display: 'block' }}>
                <MenuItem onClick={(event) => handleCreateClick(createType, event)} aria-label={localizedLabel}>
                  <ListItemIcon>{IconEl}</ListItemIcon>
                  <ListItemText>{localizedLabel}</ListItemText>
                  {openInNewAdornment ? <span style={{ marginLeft: 'auto' }}>{openInNewAdornment}</span> : null}
                </MenuItem>
              </span>
            </Tooltip>
          );
        })}
      </Menu>

      <Menu
        anchorEl={createSubmenuAnchor}
        open={createSubmenuOpen}
        onClose={() => {
          setCreateSubmenuOpen(false);
          setCreateSubmenuAnchor(null);
          setCreateSubmenuItems([]);
        }}
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
              minWidth: 180,
            },
          },
        }}
      >
        {createSubmenuItems.map((item) => {
          const createType = item.createType ?? item.nodeType;
          const IconEl = resolveIcon({ nodeType: item.nodeType, icon: item.icon });
          const localizedLabel = item.labelKey
            ? translateWithFallback(item.labelKey, item.label)
            : translateWithFallback(`plugins.${item.nodeType}.name`, item.label);
          const localizedDescription = (item.descriptionKey
            ? translateWithFallback(item.descriptionKey, item.description ?? '')
            : translateWithFallback(`plugins.${item.nodeType}.description`, item.description ?? '')).trim();

          if (localizedDescription.length === 0) {
            return (
              <MenuItem
                key={`${createType}-submenu-${language}`}
                onClick={(event) => handleCreateClick(createType, event)}
                aria-label={localizedLabel}
              >
                <ListItemIcon>{IconEl}</ListItemIcon>
                <ListItemText>{localizedLabel}</ListItemText>
                {openInNewAdornment ? <span style={{ marginLeft: 'auto' }}>{openInNewAdornment}</span> : null}
              </MenuItem>
            );
          }

          return (
            <Tooltip
              key={`${createType}-submenu-${language}`}
              title={localizedDescription}
              placement="right"
              enterDelay={300}
              arrow
            >
              <span style={{ display: 'block' }}>
                <MenuItem onClick={(event) => handleCreateClick(createType, event)} aria-label={localizedLabel}>
                  <ListItemIcon>{IconEl}</ListItemIcon>
                  <ListItemText>{localizedLabel}</ListItemText>
                  {openInNewAdornment ? <span style={{ marginLeft: 'auto' }}>{openInNewAdornment}</span> : null}
                </MenuItem>
              </span>
            </Tooltip>
          );
        })}
      </Menu>

      {/*
 Open Steps
*/}
      <Menu
        anchorEl={openStepMenuAnchor}
        open={openStepMenuOpen}
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
              minWidth: 140,
            },
          },
        }}
      >
        {openStepsLoading && openSteps.length === 0 ? (
          <MenuItem key="step-loading" disabled aria-label="Loading">
            <ListItemText primary={translateWithFallback('treeConsole.contextMenu.loading', 'Loading...')} />
          </MenuItem>
        ) : (
          openSteps.map((entry) => {
            const stepLabel = entry.label?.trim() || `Step ${entry.step}`;
            return (
              <MenuItem
                key={`step-${entry.step}`}
                onClick={(event) => handleOpenStepClick(entry.step, event)}
                disabled={Boolean(entry.disabled)}
                aria-label={stepLabel}
              >
                <ListItemText primary={stepLabel} />
                {openInNewAdornment ? <span style={{ marginLeft: 'auto' }}>{openInNewAdornment}</span> : null}
              </MenuItem>
            );
          })
        )}
      </Menu>
    </>
  );
}
