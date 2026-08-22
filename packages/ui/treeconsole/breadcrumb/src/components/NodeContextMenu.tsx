/**
 * NodeContextMenu -
 * TreeTable
 * eria-cartographRowContextMenuMUI
 */

import {
  Add as AddIcon,
  ChevronRight as ChevronRightIcon,
  Clear as ClearIcon,
  Construction as ConstructionIcon,
  ContentCopy as ContentCopyIcon,
  ContentCut as ContentCutIcon,
  FileCopy as DuplicateIcon,
  Edit as EditIcon,
  FileDownload as FileDownloadIcon,
  FileUpload as FileUploadIcon,
  Folder as FolderIcon,
  OpenInNew as OpenInNewIcon,
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
import { type ReactElement } from 'react';
import { useNodeContextMenu } from './useNodeContextMenu';

export type OpenStepOption = { step: number; label?: string; disabled?: boolean };

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
  folderBuildReady?: boolean;
  buildRequired?: boolean;
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
    canEdit = true,
    canCreate = true,
    canDuplicate = true,
    canCopy = true,
    canCut = true,
    open,
    openSteps = [],
    openStepsLoading = false,
  } = props;

  const {
    addMenuOpen,
    addMenuAnchor,
    createSubmenuOpen,
    createSubmenuAnchor,
    createSubmenuItems,
    openStepMenuOpen,
    openStepMenuAnchor,
    isShiftPressed,
    language,
    createLabel,
    openFolderLabel,
    openLabel,
    editLabel,
    copyLabel,
    cutLabel,
    duplicateLabel,
    moveToArchiveLabel,
    importLabel,
    exportLabel,
    allowArchive,
    visibleLabel,
    hiddenLabel,
    previewLabel,
    buildLabel,
    effectiveVisible,
    effectiveInvisible,
    canPreview,
    showBuildEntry,
    buildDisabled,
    anchorReference,
    resolvedAnchorPosition,
    anchorForMenu,
    isFolder,
    hasOpenSteps,
    showImport,
    showExport,
    builtCreateItems,
    translateWithFallback,
    resolveIcon,
    handleAddMenuClick,
    openCreateSubmenu,
    handleOpenStepMenuClick,
    handleMainMenuClose,
    handleOpenClick,
    handleOpenStepClick,
    handleOpenFolderClick,
    handleEditClick,
    handleCreateClick,
    handleDuplicateClick,
    handleArchiveClick,
    handleCopyClick,
    handleCutClick,
    handleImportClick,
    handleExportClick,
    handlePreviewClick,
    handleBuildClick,
    handleToggleVisible,
    handleCreateSubmenuClose,
  } = useNodeContextMenu(props);

  return (
    <>
      {/*
       */}
      <Menu
        anchorEl={anchorForMenu}
        anchorReference={anchorReference}
        anchorPosition={resolvedAnchorPosition ?? undefined}
        open={
          open &&
          (anchorReference === 'anchorPosition' ? !!resolvedAnchorPosition : !!anchorForMenu)
        }
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

        <MenuItem
          onClick={handleDuplicateClick}
          disabled={!canDuplicate}
          aria-label={duplicateLabel}
        >
          <ListItemIcon>
            <DuplicateIcon />
          </ListItemIcon>
          <ListItemText primary={duplicateLabel} />
        </MenuItem>

        <MenuItem
          onClick={handleArchiveClick}
          disabled={!allowArchive}
          aria-label={moveToArchiveLabel}
        >
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
            <MenuItem
              key="menuitem-open-folder"
              onClick={(event) => handleOpenFolderClick(event)}
              aria-label={openFolderLabel}
            >
              <ListItemIcon>
                <FolderIcon />
              </ListItemIcon>
              <ListItemText primary={openFolderLabel} />
              {isShiftPressed ? (
                <span style={{ marginLeft: 'auto' }}>
                  <OpenInNewIcon fontSize="small" sx={{ m: 0, p: 0, fontSize: '95%' }} />
                </span>
              ) : null}
            </MenuItem>
          ) : hasOpenSteps ? (
            <MenuItem
              key="menuitem-open-steps"
              onClick={handleOpenStepMenuClick}
              aria-label={openLabel}
            >
              <ListItemIcon>
                <FolderIcon />
              </ListItemIcon>
              <ListItemText primary={openLabel} />
              <ChevronRightIcon sx={{ marginLeft: 'auto' }} />
            </MenuItem>
          ) : (
            <MenuItem
              key="menuitem-open"
              onClick={(event) => handleOpenClick(event)}
              aria-label={openLabel}
            >
              <ListItemIcon>
                <FolderIcon />
              </ListItemIcon>
              <ListItemText primary={openLabel} />
              {isShiftPressed ? (
                <span style={{ marginLeft: 'auto' }}>
                  <OpenInNewIcon fontSize="small" sx={{ m: 0, p: 0, fontSize: '95%' }} />
                </span>
              ) : null}
            </MenuItem>
          ),
          <MenuItem
            key="menuitem-edit"
            onClick={(event) => handleEditClick(event)}
            disabled={!canEdit}
            aria-label={editLabel}
          >
            <ListItemIcon>
              <EditIcon />
            </ListItemIcon>
            <ListItemText primary={editLabel} />
            {isShiftPressed ? (
              <span style={{ marginLeft: 'auto' }}>
                <OpenInNewIcon fontSize="small" sx={{ m: 0, p: 0, fontSize: '95%' }} />
              </span>
            ) : null}
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
              {isShiftPressed ? (
                <span style={{ marginLeft: 'auto' }}>
                  <OpenInNewIcon fontSize="small" sx={{ m: 0, p: 0, fontSize: '95%' }} />
                </span>
              ) : null}
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
            {isShiftPressed ? (
              <span style={{ marginLeft: 'auto' }}>
                <OpenInNewIcon fontSize="small" sx={{ m: 0, p: 0, fontSize: '95%' }} />
              </span>
            ) : null}
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
          const localizedDescription = (
            ci.descriptionKey
              ? translateWithFallback(ci.descriptionKey, ci.description ?? '')
              : translateWithFallback(`plugins.${ci.nodeType}.description`, ci.description ?? '')
          ).trim();

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
                {isShiftPressed ? (
                  <span style={{ marginLeft: 'auto' }}>
                    <OpenInNewIcon fontSize="small" sx={{ m: 0, p: 0, fontSize: '95%' }} />
                  </span>
                ) : null}
              </MenuItem>
            );
          }

          return (
            <Tooltip
              key={`${createType}-${language}`}
              title={localizedDescription}
              placement="right"
              enterDelay={300}
              arrow
            >
              <span style={{ display: 'block' }}>
                <MenuItem
                  onClick={(event) => handleCreateClick(createType, event)}
                  aria-label={localizedLabel}
                >
                  <ListItemIcon>{IconEl}</ListItemIcon>
                  <ListItemText>{localizedLabel}</ListItemText>
                  {isShiftPressed ? (
                    <span style={{ marginLeft: 'auto' }}>
                      <OpenInNewIcon fontSize="small" sx={{ m: 0, p: 0, fontSize: '95%' }} />
                    </span>
                  ) : null}
                </MenuItem>
              </span>
            </Tooltip>
          );
        })}
      </Menu>

      <Menu
        anchorEl={createSubmenuAnchor}
        open={createSubmenuOpen}
        onClose={handleCreateSubmenuClose}
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
          const localizedDescription = (
            item.descriptionKey
              ? translateWithFallback(item.descriptionKey, item.description ?? '')
              : translateWithFallback(
                  `plugins.${item.nodeType}.description`,
                  item.description ?? ''
                )
          ).trim();

          if (localizedDescription.length === 0) {
            return (
              <MenuItem
                key={`${createType}-submenu-${language}`}
                onClick={(event) => handleCreateClick(createType, event)}
                aria-label={localizedLabel}
              >
                <ListItemIcon>{IconEl}</ListItemIcon>
                <ListItemText>{localizedLabel}</ListItemText>
                {isShiftPressed ? (
                  <span style={{ marginLeft: 'auto' }}>
                    <OpenInNewIcon fontSize="small" sx={{ m: 0, p: 0, fontSize: '95%' }} />
                  </span>
                ) : null}
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
                <MenuItem
                  onClick={(event) => handleCreateClick(createType, event)}
                  aria-label={localizedLabel}
                >
                  <ListItemIcon>{IconEl}</ListItemIcon>
                  <ListItemText>{localizedLabel}</ListItemText>
                  {isShiftPressed ? (
                    <span style={{ marginLeft: 'auto' }}>
                      <OpenInNewIcon fontSize="small" sx={{ m: 0, p: 0, fontSize: '95%' }} />
                    </span>
                  ) : null}
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
            <ListItemText
              primary={translateWithFallback('treeConsole.contextMenu.loading', 'Loading...')}
            />
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
                {isShiftPressed ? (
                  <span style={{ marginLeft: 'auto' }}>
                    <OpenInNewIcon fontSize="small" sx={{ m: 0, p: 0, fontSize: '95%' }} />
                  </span>
                ) : null}
              </MenuItem>
            );
          })
        )}
      </Menu>
    </>
  );
}
