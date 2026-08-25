import {
  Add as AddIcon,
  ChevronRight,
  Clear as ClearIcon,
  FileCopy as DuplicateIcon,
  Edit as EditIcon,
  Folder as FolderIcon,
  PlayArrow as PlayArrowIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import {
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Switch,
  Tooltip,
} from '@mui/material';
import { memo } from 'react';
import { useRowContextMenu } from './useRowContextMenu.js';

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
  readonly onArchive?: () => void;
  readonly onToggleVisible?: (nextValue: boolean) => void;
  readonly isVisible?: boolean;
  readonly canOpen: boolean;
  readonly canEdit: boolean;
  readonly canCreate: boolean;
  readonly canRemove?: boolean;
  readonly canArchive?: boolean;
  readonly canDuplicate: boolean;
  readonly isArchiveRoot?: boolean;
  readonly mode?: 'restore' | 'dispose';
  readonly onRestoreToOriginal?: () => void;
  readonly onRestoreToCurrent?: () => void;
  /** Optional treeId for context-aware Create submenu (e.g., 'r'|'t'|'p') */
  readonly treeId?: string;
}

export const RowContextMenu = memo(
  function RowContextMenu(props: RowContextMenuProps) {
    const {
      t,
      language,
      addMenuOpen,
      addMenuAnchor,
      effectiveVisible,
      effectiveInvisible,
      isFolder,
      safeAnchorEl,
      allowArchive,
      localizedCreateMenuEntries,
      createMenuUnavailable,
      formatCreateTooltip,
      handleAddMenuClick,
      handleOpenClick,
      handleMainMenuClose,
      handleCreateClick,
      handleOpenFolderClick,
      handleToggleVisible,
      handleEditClick,
      handleDuplicateClick,
      handleArchiveClick,
      handlePreviewClick,
    } = useRowContextMenu(props);

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
          PaperProps={{
            'data-testid': 'context-menu',
            elevation: 8,
            sx: {
              zIndex: 9999,
              minWidth: 120,
            },
          }}
        >
          <MenuItem
            onClick={handleAddMenuClick}
            aria-label={t('treeConsole.contextMenu.create', 'Create')}
            data-testid="context-menu-create"
          >
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
            <MenuItem
              onClick={handleOpenClick}
              aria-label={t('treeConsole.contextMenu.open', 'Open')}
            >
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
            data-testid="context-menu-edit"
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
            data-testid="context-menu-duplicate"
          >
            <ListItemIcon>
              <DuplicateIcon />
            </ListItemIcon>
            <ListItemText>{t('treeConsole.contextMenu.duplicate', 'Duplicate')}</ListItemText>
          </MenuItem>

          <MenuItem
            onClick={handleArchiveClick}
            disabled={!allowArchive}
            aria-label={t('treeConsole.contextMenu.moveToArchive', 'Move to Archive')}
            data-testid="context-menu-remove"
          >
            <ListItemIcon>
              <ClearIcon color="error" />
            </ListItemIcon>
            <ListItemText>
              {t('treeConsole.contextMenu.moveToArchive', 'Move to Archive')}
            </ListItemText>
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
          {createMenuUnavailable ? (
            <MenuItem disabled>
              <ListItemText>
                {t('treeConsole.contextMenu.createUnavailable', 'Create menu unavailable')}
              </ListItemText>
            </MenuItem>
          ) : (
            localizedCreateMenuEntries.map((entry) => {
              if (entry.description.length === 0) {
                return (
                  <MenuItem
                    key={`${entry.key}-${language}`}
                    onClick={() => handleCreateClick(entry.nodeType)}
                    aria-label={entry.label}
                  >
                    <ListItemIcon>{entry.icon}</ListItemIcon>
                    <ListItemText primary={entry.label} />
                  </MenuItem>
                );
              }

              return (
                <Tooltip
                  key={`${entry.key}-${language}`}
                  title={formatCreateTooltip(entry.label, entry.description)}
                  placement="right"
                  enterDelay={300}
                  arrow
                >
                  <span style={{ display: 'block' }}>
                    <MenuItem
                      onClick={() => handleCreateClick(entry.nodeType)}
                      aria-label={entry.label}
                    >
                      <ListItemIcon>{entry.icon}</ListItemIcon>
                      <ListItemText primary={entry.label} />
                    </MenuItem>
                  </span>
                </Tooltip>
              );
            })
          )}
        </Menu>
      </>
    );
  },
  (prevProps, nextProps) => {
    const prevArchive = prevProps.canArchive ?? prevProps.canRemove;
    const nextArchive = nextProps.canArchive ?? nextProps.canRemove;
    return (
      prevProps.nodeType === nextProps.nodeType &&
      prevProps.canOpen === nextProps.canOpen &&
      prevProps.canEdit === nextProps.canEdit &&
      prevProps.canCreate === nextProps.canCreate &&
      prevArchive === nextArchive &&
      prevProps.canDuplicate === nextProps.canDuplicate &&
      prevProps.isVisible === nextProps.isVisible &&
      prevProps.parentElem === nextProps.parentElem &&
      prevProps.addMenuNodeTypes.length === nextProps.addMenuNodeTypes.length &&
      prevProps.addMenuNodeTypes.every((type, index) => type === nextProps.addMenuNodeTypes[index])
    );
  }
);
