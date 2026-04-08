import { useCallback, useRef, useState } from 'react';
import { Box, ClickAwayListener, Grow, IconButton, Paper, Popper, useMediaQuery } from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { TREE_CONSOLE_DEFAULT_ZOOM_BAND_BOUNDARIES } from '@hierarchidb/util';
import type { TreeConsoleToolbarProps } from '~/types';
import { ActionButtons } from './ActionButtons.js';
import { TreeTableSearchInput } from '@hierarchidb/components';
import type { SearchStrings } from './SearchOnlyToolbar.js';
import { SettingsMenu } from './SettingsMenu.js';
import { ArchiveMenu } from './ArchiveMenu.js';
import { SortModeSelector } from './SortModeSelector.js';
import type { SortMode } from './SortModeSelector.js';
import { ViewModeSelector } from './ViewModeSelector.js';
import type { ViewMode } from './ViewModeSelector.js';
import { useTreeConsoleToolbarContent } from './useTreeConsoleToolbarContent.js';

/**
 * Responsive toolbar layout tiers (aligned with MUI breakpoints):
 *
 * | Width       | Tier            | Search       | Actions              | ViewMode          | SortMode      |
 * |-------------|-----------------|--------------|----------------------|-------------------|---------------|
 * | ≥1200 (xl)  | full            | normal       | all 8 buttons        | 3-btn ButtonGroup | button+label  |
 * | 960–1199    | compact-actions | normal       | ✂️+More actions menu | 3-btn ButtonGroup | button+label  |
 * | 600–959(md) | compact-search  | 180px width  | ✂️+More actions menu | 1-btn+menu        | icon-only     |
 * | <600 (sm)   | minimal         | 🔍 icon+Popper | ✂️ icon-only menu  | icon-only+menu    | icon-only     |
 */
const BP_XL = 1200;
const BP_LG = 960;
const BP_MD = 600;

type ToolbarTier = 'full' | 'compact-actions' | 'compact-search' | 'minimal';

const TreeConsoleToolbarContainer = styled(Box)(() => ({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  margin: '0 16px 2px',
  minHeight: '48px',
  flexWrap: 'nowrap',
}));

interface TreeConsoleToolbarContentProps {
  controller?: TreeConsoleToolbarProps['controller'];
  hasArchiveItems: boolean;
  archiveNodeId?: string;
  onAction?: TreeConsoleToolbarProps['onAction'];
  rowClickAction?: TreeConsoleToolbarProps['rowClickAction'];
  onRowClickActionChange?: TreeConsoleToolbarProps['onRowClickActionChange'];
  autosaveEnabled?: boolean;
  onAutosaveEnabledChange?: TreeConsoleToolbarProps['onAutosaveEnabledChange'];
  dialogBackdropDismissEnabled?: boolean;
  onDialogBackdropDismissEnabledChange?: TreeConsoleToolbarProps['onDialogBackdropDismissEnabledChange'];
  zoomBandBoundaries?: TreeConsoleToolbarProps['zoomBandBoundaries'];
  onZoomBandBoundariesChange?: TreeConsoleToolbarProps['onZoomBandBoundariesChange'];
  canUndo: boolean;
  canRedo: boolean;
  canCopy: boolean;
  canPaste: boolean;
  canDuplicate: boolean;
  canArchive?: boolean;
  canRemove?: boolean;
  developerModeEnabled: boolean;
  searchStrings: SearchStrings;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  sortMode?: SortMode;
  onSortModeChange?: (mode: SortMode) => void;
}

export function TreeConsoleToolbarContent({
  controller,
  hasArchiveItems,
  archiveNodeId,
  onAction,
  rowClickAction = 'Select/Navigate',
  onRowClickActionChange,
  autosaveEnabled = false,
  onAutosaveEnabledChange,
  dialogBackdropDismissEnabled = false,
  onDialogBackdropDismissEnabledChange,
  zoomBandBoundaries = TREE_CONSOLE_DEFAULT_ZOOM_BAND_BOUNDARIES,
  onZoomBandBoundariesChange,
  canUndo,
  canRedo,
  canCopy,
  canPaste,
  canDuplicate,
  canArchive,
  canRemove,
  searchStrings,
  viewMode = 'list',
  onViewModeChange,
  sortMode = 'none',
  onSortModeChange,
}: TreeConsoleToolbarContentProps) {
  const isXl = useMediaQuery(`(min-width:${BP_XL}px)`);
  const isLg = useMediaQuery(`(min-width:${BP_LG}px)`);
  const isMd = useMediaQuery(`(min-width:${BP_MD}px)`);
  const tier: ToolbarTier = isXl ? 'full' : isLg ? 'compact-actions' : isMd ? 'compact-search' : 'minimal';

  const {
    portalContainer,
    archiveAnchorEl,
    setArchiveAnchorEl,
    handleAction,
    handleSearch,
    currentSearchMode,
    allowArchive,
    archiveMenuHandlers,
    tooltips,
    archiveButtonLabel,
    settingsButtonLabel,
    labels,
    searchText,
    handleSearchCommit,
  } = useTreeConsoleToolbarContent({
    controller,
    archiveNodeId,
    onAction,
    canArchive,
    canRemove,
    searchStrings,
  });

  return (
    <TreeConsoleToolbarContainer>
      {/* Search: full/compact-actions = normal, compact-search = compact width, minimal = icon + popper */}
      <SearchArea
        tier={tier}
        searchText={searchText}
        handleSearch={handleSearch}
        handleSearchCommit={handleSearchCommit}
        searchStrings={searchStrings}
        currentSearchMode={currentSearchMode}
      />

      <ActionButtons
        canUndo={canUndo}
        canRedo={canRedo}
        canCopy={canCopy}
        canPaste={canPaste}
        canDuplicate={canDuplicate}
        allowArchive={allowArchive}
        archiveButtonLabel={archiveButtonLabel}
        hasArchiveItems={hasArchiveItems}
        onAction={handleAction}
        onArchiveClick={(event) => setArchiveAnchorEl(event.currentTarget)}
        tooltips={tooltips}
        layout={tier === 'full' ? 'wide' : tier === 'minimal' ? 'narrow' : 'medium'}
      />

      <ArchiveMenu
        anchorEl={archiveAnchorEl}
        open={Boolean(archiveAnchorEl)}
        onClose={() => setArchiveAnchorEl(null)}
        onRestore={archiveMenuHandlers.onRestore}
        onEmpty={archiveMenuHandlers.onEmpty}
        restoreLabel={labels.restoreLabel}
        emptyLabel={labels.emptyLabel}
      />

      <Box sx={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        {onViewModeChange && (
          <ViewModeSelector
            value={viewMode}
            onChange={onViewModeChange}
            breakpoint={BP_LG}
            iconOnly={tier === 'minimal'}
          />
        )}
        {onSortModeChange && (
          <SortModeSelector
            value={sortMode}
            onChange={onSortModeChange}
            iconOnly={tier === 'compact-search' || tier === 'minimal'}
          />
        )}
        <SettingsMenu
          rowClickAction={rowClickAction}
          onRowClickActionChange={onRowClickActionChange}
          autosaveEnabled={autosaveEnabled}
          onAutosaveEnabledChange={onAutosaveEnabledChange}
          dialogBackdropDismissEnabled={dialogBackdropDismissEnabled}
          onDialogBackdropDismissEnabledChange={onDialogBackdropDismissEnabledChange}
          zoomBandBoundaries={zoomBandBoundaries}
          onZoomBandBoundariesChange={onZoomBandBoundariesChange}
          onAction={handleAction}
          portalContainer={portalContainer}
          labels={{
            settingsButton: settingsButtonLabel,
            rowClickTitle: labels.rowClickTitle,
            rowClickSelectNavigate: labels.rowClickSelectNavigate,
            rowClickEdit: labels.rowClickEdit,
            autosaveTitle: labels.autosaveTitle,
            dialogBackdropDismissTitle: labels.dialogBackdropDismissTitle,
            zoomBandsTitle: labels.zoomBandsTitle,
            zoomBandsHelper: labels.zoomBandsHelper,
            zoomBandsSummary: labels.zoomBandsSummary,
            zoomBandsRangeCount: labels.zoomBandsRangeCount,
            zoomBandsRangeCountHelp: labels.zoomBandsRangeCountHelp,
            zoomBandsBoundaries: labels.zoomBandsBoundaries,
            zoomBandsBoundariesHelp: labels.zoomBandsBoundariesHelp,
          }}
        />
      </Box>
    </TreeConsoleToolbarContainer>
  );
}

// -- Search area with responsive behavior --

interface SearchAreaProps {
  tier: ToolbarTier;
  searchText: string;
  handleSearch: (value: string) => void;
  handleSearchCommit?: () => void;
  searchStrings: SearchStrings;
  currentSearchMode: string;
}

function SearchArea({
  tier,
  searchText,
  handleSearch,
  handleSearchCommit,
  searchStrings,
  currentSearchMode,
}: SearchAreaProps) {
  const [popperOpen, setPopperOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement | null>(null);

  const handleToggle = useCallback(() => {
    setPopperOpen((prev) => !prev);
  }, []);

  const handleClickAway = useCallback(() => {
    setPopperOpen(false);
  }, []);

  if (tier === 'minimal') {
    return (
      <>
        <IconButton
          ref={anchorRef}
          size="small"
          onClick={handleToggle}
          aria-label={searchStrings.ariaLabel ?? 'Search'}
        >
          <SearchIcon fontSize="small" />
        </IconButton>
        <Popper
          open={popperOpen}
          anchorEl={anchorRef.current}
          placement="bottom-start"
          transition
          style={{ zIndex: 1300 }}
        >
          {({ TransitionProps }) => (
            <Grow {...TransitionProps}>
              <Paper elevation={4} sx={{ p: 1 }}>
                <ClickAwayListener onClickAway={handleClickAway}>
                  <Box>
                    <TreeTableSearchInput
                      searchText={searchText}
                      handleSearchTextChange={handleSearch}
                      handleSearchCommit={handleSearchCommit}
                      placeholder={searchStrings.placeholder}
                      ariaLabel={searchStrings.ariaLabel}
                      searchMode={currentSearchMode}
                      autoFocus
                    />
                  </Box>
                </ClickAwayListener>
              </Paper>
            </Grow>
          )}
        </Popper>
      </>
    );
  }

  // full / compact-actions: normal width, compact-search: compact width via sx override
  const isCompact = tier === 'compact-search';
  return (
    <Box sx={{ flexShrink: isCompact ? 1 : 0, minWidth: isCompact ? 120 : undefined }}>
      <TreeTableSearchInput
        searchText={searchText}
        handleSearchTextChange={handleSearch}
        handleSearchCommit={handleSearchCommit}
        placeholder={searchStrings.placeholder}
        ariaLabel={searchStrings.ariaLabel}
        searchMode={currentSearchMode}
        sx={isCompact ? {
          '& .MuiInputBase-root': { width: '180px !important' },
        } : undefined}
      />
    </Box>
  );
}
