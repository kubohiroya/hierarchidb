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

/** Breakpoints for responsive toolbar layout tiers. */
const BP_WIDE = 900;
const BP_MEDIUM = 600;

type ToolbarTier = 'wide' | 'medium' | 'narrow';

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
  const isWide = useMediaQuery(`(min-width:${BP_WIDE}px)`);
  const isMedium = useMediaQuery(`(min-width:${BP_MEDIUM}px)`);
  const tier: ToolbarTier = isWide ? 'wide' : isMedium ? 'medium' : 'narrow';

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
      {/* Search: wide = normal, medium = compact width, narrow = icon + popper */}
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
        layout={tier}
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
            breakpoint={BP_WIDE}
            iconOnly={tier === 'narrow'}
          />
        )}
        {onSortModeChange && (
          <SortModeSelector
            value={sortMode}
            onChange={onSortModeChange}
            iconOnly={tier !== 'wide'}
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

  if (tier === 'narrow') {
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

  // wide: normal width, medium: compact width via sx override
  return (
    <Box sx={{ flexShrink: tier === 'medium' ? 1 : 0, minWidth: tier === 'medium' ? 120 : undefined }}>
      <TreeTableSearchInput
        searchText={searchText}
        handleSearchTextChange={handleSearch}
        handleSearchCommit={handleSearchCommit}
        placeholder={searchStrings.placeholder}
        ariaLabel={searchStrings.ariaLabel}
        searchMode={currentSearchMode}
        sx={tier === 'medium' ? {
          '& .MuiInputBase-root': { width: '180px !important' },
        } : undefined}
      />
    </Box>
  );
}
