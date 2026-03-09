import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import { TREE_CONSOLE_DEFAULT_ZOOM_BAND_BOUNDARIES } from '@hierarchidb/util';
import type { TreeConsoleToolbarProps } from '~/types';
import { ActionButtons } from './ActionButtons.js';
import { TreeTableSearchInput } from '@hierarchidb/components';
import type { SearchStrings } from './SearchOnlyToolbar.js';
import { SettingsMenu } from './SettingsMenu.js';
import { ArchiveMenu } from './ArchiveMenu.js';
import { useTreeConsoleToolbarContent } from './useTreeConsoleToolbarContent.js';

const TreeConsoleToolbarContainer = styled(Box)(() => ({
  display: 'flex',
  alignItems: 'center',
  gap: '20px',
  margin: '0 16px 2px',
  minHeight: '48px',
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
}: TreeConsoleToolbarContentProps) {
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
      <TreeTableSearchInput
        searchText={searchText}
        handleSearchTextChange={handleSearch}
        handleSearchCommit={handleSearchCommit}
        placeholder={searchStrings.placeholder}
        ariaLabel={searchStrings.ariaLabel}
        searchMode={currentSearchMode}
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

      <Box sx={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
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
