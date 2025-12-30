import { memo, type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CreateMenuBuilder, GlobalMenuBuilders, CreateMenuEntry } from '@hierarchidb/common-types';
import { Divider, ListItemIcon, ListItemText, Menu, MenuItem, Switch, Tooltip } from '@mui/material';
import {
  Add as AddIcon,
  ChevronRight,
  Clear as ClearIcon,
  Edit as EditIcon,
  FileCopy as DuplicateIcon,
  Folder as FolderIcon,
  PlayArrow as PlayArrowIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import { useIconRegistry } from '@hierarchidb/ui-icon';
import { useGlobalI18nTranslator } from '@hierarchidb/ui-i18n';

// Defer resolving ui-core to runtime-worker to avoid stage-time type resolution issues

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
  readonly onRemove?: () => void;
  readonly onTrash?: () => void;
  readonly onToggleVisible?: (nextValue: boolean) => void;
  readonly isVisible?: boolean;
  readonly canOpen: boolean;
  readonly canEdit: boolean;
  readonly canCreate: boolean;
  readonly canRemove?: boolean;
  readonly canTrash?: boolean;
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
    const [localInvisible, setLocalInvisible] = useState<boolean | null>(null);
    const { t, language } = useGlobalI18nTranslator();
    const { resolveIcon } = useIconRegistry();
    const isVisible = props.isVisible;
    const effectiveVisible =
      localInvisible !== null ? !localInvisible : (typeof isVisible === 'boolean' ? isVisible : true);
    const effectiveInvisible = !effectiveVisible;
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

    const formatCreateTooltip = useCallback(
      (label: string, description?: string) => {
        if (!description || description.trim().length === 0) return label;
        const template = translateWithFallback(
          'treeConsole.contextMenu.createTooltip',
          '{{label}}: {{description}}'
        );
        return template.replace('{{label}}', label).replace('{{description}}', description);
      },
      [translateWithFallback]
    );

    // Use refs to store the latest props to avoid stale closures
    const propsRef = useRef(props);
    useEffect(() => {
      propsRef.current = props;
    });

    useEffect(() => {
      if (!props.parentElem) {
        setLocalInvisible(null);
        return;
      }
      const resolvedVisible = typeof isVisible === 'boolean' ? isVisible : true;
      if (localInvisible !== null && localInvisible === !resolvedVisible) {
        setLocalInvisible(null);
      }
    }, [props.parentElem, isVisible, localInvisible]);

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

    const handleToggleVisible = () => {
      const onToggleVisible = propsRef.current.onToggleVisible;
      const nextVisible = !effectiveVisible;
      setLocalInvisible(!nextVisible);
      requestAnimationFrame(() => {
        onToggleVisible?.(nextVisible);
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
        onPreview();
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

    const allowTrash = (props.canTrash ?? props.canRemove ?? true);

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
          <MenuItem onClick={handleAddMenuClick} aria-label={t('treeConsole.contextMenu.create', 'Create')}>
            <ListItemIcon>
              <AddIcon />
            </ListItemIcon>
            <ListItemText>{t('treeConsole.contextMenu.create', 'Create')}</ListItemText>
            <ChevronRight sx={{ marginLeft: 'auto' }} />
          </MenuItem>

          <Divider />

          {isFolder ? (
            <MenuItem
              onClick={handleOpenFolderClick}
              aria-label={t('treeConsole.contextMenu.openFolder', 'Open folder')}
            >
              <ListItemIcon>
                <FolderIcon />
              </ListItemIcon>
              <ListItemText>{t('treeConsole.contextMenu.openFolder', 'Open folder')}</ListItemText>
            </MenuItem>
          ) : (
            <MenuItem onClick={handleOpenClick} aria-label={t('treeConsole.contextMenu.open', 'Open')}>
              <ListItemIcon>
                <FolderIcon />
              </ListItemIcon>
              <ListItemText>{t('treeConsole.contextMenu.open', 'Open')}</ListItemText>
            </MenuItem>
          )}

          <MenuItem
            onClick={handleEditClick}
            disabled={!props.canEdit}
            aria-label={t('treeConsole.contextMenu.edit', 'Edit')}
          >
            <ListItemIcon>
              <EditIcon />
            </ListItemIcon>
            <ListItemText>{t('treeConsole.contextMenu.edit', 'Edit')}</ListItemText>
          </MenuItem>

          <MenuItem
            onClick={handleDuplicateClick}
            disabled={!props.canDuplicate}
            aria-label={t('treeConsole.contextMenu.duplicate', 'Duplicate')}
          >
            <ListItemIcon>
              <DuplicateIcon />
            </ListItemIcon>
            <ListItemText>{t('treeConsole.contextMenu.duplicate', 'Duplicate')}</ListItemText>
          </MenuItem>

          <MenuItem
            onClick={handleTrashClick}
            disabled={!allowTrash}
            aria-label={t('treeConsole.contextMenu.moveToTrash', 'Move to Trash')}
          >
            <ListItemIcon>
              <ClearIcon color="error" />
            </ListItemIcon>
            <ListItemText>{t('treeConsole.contextMenu.moveToTrash', 'Move to Trash')}</ListItemText>
          </MenuItem>

          <Divider />

            <MenuItem
              onClick={handleToggleVisible}
              aria-label={
              effectiveInvisible
                ? t('treeConsole.contextMenu.hidden', 'Hidden')
                : t('treeConsole.contextMenu.visible', 'Visible')
              }
              sx={{ minWidth: 200 }}
            >
            <ListItemIcon>
              {effectiveInvisible ? <VisibilityOffIcon /> : <VisibilityIcon />}
            </ListItemIcon>
            <ListItemText>
              {effectiveInvisible
                ? t('treeConsole.contextMenu.hidden', 'Hidden')
                : t('treeConsole.contextMenu.visible', 'Visible')}
            </ListItemText>
            <Switch
              checked={effectiveVisible}
              size="small"
              onChange={(event) => {
                event.stopPropagation();
                handleToggleVisible();
              }}
              sx={{ ml: 'auto' }}
              inputProps={{
                'aria-label': effectiveInvisible
                  ? t('treeConsole.contextMenu.hidden', 'Hidden')
                  : t('treeConsole.contextMenu.visible', 'Visible'),
              }}
            />
          </MenuItem>

          {!isFolder && <Divider />}
          {!isFolder && (
            <MenuItem
              onClick={handlePreviewClick}
              aria-label={t('treeConsole.contextMenu.preview', 'Preview')}
              disabled={effectiveInvisible}
            >
              <ListItemIcon>
                <PlayArrowIcon />
              </ListItemIcon>
              <ListItemText>{t('treeConsole.contextMenu.preview', 'Preview')}</ListItemText>
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
                    <ListItemText>
                      {t('treeConsole.contextMenu.createUnavailable', 'Create menu unavailable')}
                    </ListItemText>
                  </MenuItem>
                );
              }

              // Build items from treeId (resources/projects context)
              const items = builder(props.treeId) as CreateMenuEntry[];
              return (items || []).map((i) => {
                const IconEl = resolveIcon({ nodeType: i.nodeType, icon: i.icon });
                const localizedLabel = translateWithFallback(`plugins.${i.nodeType}.name`, i.label);
                const localizedDescription = translateWithFallback(`plugins.${i.nodeType}.description`, i.description ?? '').trim();

                if (localizedDescription.length === 0) {
                  return (
                    <MenuItem
                      key={`${i.key}-${language}`}
                      onClick={() => handleCreateClick(i.nodeType)}
                      aria-label={localizedLabel}
                    >
                      <ListItemIcon>{IconEl}</ListItemIcon>
                      <ListItemText primary={localizedLabel} />
                    </MenuItem>
                  );
                }

                return (
                  <Tooltip
                    key={`${i.key}-${language}`}
                    title={formatCreateTooltip(localizedLabel, localizedDescription)}
                    placement="right"
                    enterDelay={300}
                    arrow
                  >
                    <span style={{ display: 'block' }}>
                      <MenuItem onClick={() => handleCreateClick(i.nodeType)} aria-label={localizedLabel}>
                        <ListItemIcon>{IconEl}</ListItemIcon>
                        <ListItemText primary={localizedLabel} />
                      </MenuItem>
                    </span>
                  </Tooltip>
                );
              });
            } catch {
              return (
                <MenuItem disabled>
                  <ListItemText>
                    {t('treeConsole.contextMenu.createUnavailable', 'Create menu unavailable')}
                  </ListItemText>
                </MenuItem>
             );
            }
          })()}
        </Menu>
      </>
    );
  },
  (prevProps, nextProps) => {
    const prevTrash = prevProps.canTrash ?? prevProps.canRemove;
    const nextTrash = nextProps.canTrash ?? nextProps.canRemove;
    return (
      prevProps.nodeType === nextProps.nodeType &&
      prevProps.canOpen === nextProps.canOpen &&
      prevProps.canEdit === nextProps.canEdit &&
      prevProps.canCreate === nextProps.canCreate &&
      prevTrash === nextTrash &&
      prevProps.canDuplicate === nextProps.canDuplicate &&
      prevProps.isVisible === nextProps.isVisible &&
      prevProps.parentElem === nextProps.parentElem &&
      prevProps.addMenuNodeTypes.length === nextProps.addMenuNodeTypes.length &&
      prevProps.addMenuNodeTypes.every((type, index) => type === nextProps.addMenuNodeTypes[index])
    );
  },
);
