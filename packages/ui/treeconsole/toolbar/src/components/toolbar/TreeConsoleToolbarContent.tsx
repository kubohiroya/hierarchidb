import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from '@hierarchidb/ui-i18n';
import { TREE_CONSOLE_DEFAULT_ZOOM_BAND_BOUNDARIES } from '@hierarchidb/util';
import { useCallback, useState } from 'react';
import type { TreeConsoleToolbarProps, TreeConsoleToolbarActionParams, TreeConsoleSearchMode } from '~/types';
import { ActionButtons } from './ActionButtons.js';
import { TreeTableSearchInput } from '@hierarchidb/ui-search-input';
import type { SearchStrings } from './SearchOnlyToolbar.js';
import { SettingsMenu } from './SettingsMenu.js';
import { ArchiveMenu } from './ArchiveMenu.js';

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
  buildContinuationPolicy?: TreeConsoleToolbarProps['buildContinuationPolicy'];
  onBuildContinuationPolicyChange?: TreeConsoleToolbarProps['onBuildContinuationPolicyChange'];
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
  buildContinuationPolicy = 'finish_all_stages',
  onBuildContinuationPolicyChange,
  canUndo,
  canRedo,
  canCopy,
  canPaste,
  canDuplicate,
  canArchive,
  canRemove,
  searchStrings,
}: TreeConsoleToolbarContentProps) {
  const portalContainer = typeof window !== 'undefined' ? document.body : undefined;
  const [archiveAnchorEl, setArchiveAnchorEl] = useState<HTMLElement | null>(null);
  const { t: tCommon } = useTranslation('common');

  const handleAction = useCallback(
    (action: string, params?: TreeConsoleToolbarActionParams) => {
      if (onAction) {
        onAction(action, params);
      } else {
        console.log(`Action: ${action}`, params ?? '- TODO: Connect to controller');
      }
    },
    [onAction]
  );

  const handleSearch = useCallback(
    (value: string) => {
      try {
        controller?.handleSearchTextChange?.(value);
      } catch (error) {
        console.warn('Search not implemented:', error);
      }
    },
    [controller]
  );

  const currentSearchMode: TreeConsoleSearchMode = 'local';

  const allowArchive = (typeof canArchive === 'boolean' ? canArchive : undefined) ?? canRemove ?? true;

  const archiveMenuHandlers = {
    onRestore: () => handleAction('restore', archiveNodeId ? { archiveNodeId } : undefined),
    onEmpty: () => handleAction('empty', archiveNodeId ? { archiveNodeId } : undefined),
  };

  const tooltips = {
    undo: tCommon('treeConsole.toolbar.tooltips.undo', { shortcut: '⌘+Z' }),
    redo: tCommon('treeConsole.toolbar.tooltips.redo', { shortcut: '⌘+Shift+Z' }),
    cut: tCommon('treeConsole.toolbar.tooltips.cut', { shortcut: '⌘+X' }),
    copy: tCommon('treeConsole.toolbar.tooltips.copy', { shortcut: '⌘+C' }),
    paste: tCommon('treeConsole.toolbar.tooltips.paste', { shortcut: '⌘+V' }),
    duplicate: tCommon('treeConsole.toolbar.tooltips.duplicate', { shortcut: '⌘+D' }),
    moveToArchive: tCommon('treeConsole.toolbar.tooltips.moveToArchive', { shortcut: '⌘+X' }),
  } as const;

  const archiveButtonLabel = tCommon('treeConsole.toolbar.aria.archiveMenuButton');
  const settingsButtonLabel = tCommon('treeConsole.toolbar.aria.settingsButton');

  const labels = {
    restoreLabel: tCommon('treeConsole.toolbar.archiveMenu.restore'),
    emptyLabel: tCommon('treeConsole.toolbar.archiveMenu.empty'),
    rowClickTitle: tCommon('treeConsole.toolbar.rowClick.title'),
    rowClickSelectNavigate: tCommon('treeConsole.toolbar.rowClick.options.selectNavigate'),
    rowClickEdit: tCommon('treeConsole.toolbar.rowClick.options.edit'),
    themeTitle: tCommon('treeConsole.toolbar.settings.theme.title'),
    themeModes: {
      system: tCommon('treeConsole.toolbar.settings.theme.modes.system'),
      light: tCommon('treeConsole.toolbar.settings.theme.modes.light'),
      dark: tCommon('treeConsole.toolbar.settings.theme.modes.dark'),
    },
    languageTitle: tCommon('treeConsole.toolbar.settings.language.title'),
    languageModes: {
      system: tCommon('treeConsole.toolbar.settings.language.modes.system'),
      en: tCommon('treeConsole.toolbar.settings.language.modes.en'),
      ja: tCommon('treeConsole.toolbar.settings.language.modes.ja'),
    },
    developerMenuLabel: tCommon('treeConsole.toolbar.developerMenu.clearIndexedDb'),
    autosaveTitle: tCommon('treeConsole.toolbar.settings.autosave.title', 'Autosave'),
    dialogBackdropDismissTitle: tCommon(
      'treeConsole.toolbar.settings.dialogBackdropDismiss.title',
      'Close dialogs on outside click',
    ),
    zoomBandsTitle: tCommon('treeConsole.toolbar.settings.zoomBands.title', 'Zoom bands'),
    zoomBandsHelper: tCommon(
      'treeConsole.toolbar.settings.zoomBands.helper',
      'Default zoom band settings for new Shape/Route builds.',
    ),
    zoomBandsSummary: tCommon(
      'treeConsole.toolbar.settings.zoomBands.summary',
      'Used as the default Transform zoom bands when creating new Shape/Route nodes.',
    ),
    zoomBandsRangeCount: tCommon('treeConsole.toolbar.settings.zoomBands.rangeCount', 'Number of ranges'),
    zoomBandsRangeCountHelp: tCommon(
      'treeConsole.toolbar.settings.zoomBands.rangeCountHelp',
      'Set how many zoom ranges to use for transforms.',
    ),
    zoomBandsBoundaries: tCommon('treeConsole.toolbar.settings.zoomBands.boundaries', 'Range boundaries'),
    zoomBandsBoundariesHelp: tCommon(
      'treeConsole.toolbar.settings.zoomBands.boundariesHelp',
      'Adjust the zoom levels that split each range.',
    ),
    buildPolicyTitle: tCommon('treeConsole.toolbar.settings.buildPolicy.title', 'Build continuation policy'),
    buildPolicyHelper: tCommon(
      'treeConsole.toolbar.settings.buildPolicy.helper',
      'Controls how builds behave after errors.',
    ),
    buildPolicyFinishAll: tCommon(
      'treeConsole.toolbar.settings.buildPolicy.options.finishAll',
      'Finish all stages',
    ),
    buildPolicyFinishStage: tCommon(
      'treeConsole.toolbar.settings.buildPolicy.options.finishStage',
      'Finish stage then stop',
    ),
    buildPolicyStop: tCommon('treeConsole.toolbar.settings.buildPolicy.options.stop', 'Stop on first error'),
  } as const;

  return (
    <TreeConsoleToolbarContainer>
      <TreeTableSearchInput
        searchText={controller?.searchText || ''}
        handleSearchTextChange={handleSearch}
        handleSearchCommit={controller?.handleSearchCommit}
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
          buildContinuationPolicy={buildContinuationPolicy}
          onBuildContinuationPolicyChange={onBuildContinuationPolicyChange}
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
            buildPolicyTitle: labels.buildPolicyTitle,
            buildPolicyHelper: labels.buildPolicyHelper,
            buildPolicyFinishAll: labels.buildPolicyFinishAll,
            buildPolicyFinishStage: labels.buildPolicyFinishStage,
            buildPolicyStop: labels.buildPolicyStop,
          }}
        />
      </Box>
    </TreeConsoleToolbarContainer>
  );
}
