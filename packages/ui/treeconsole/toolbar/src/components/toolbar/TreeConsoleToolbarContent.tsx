import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from '@hierarchidb/ui-i18n';
import { TREE_CONSOLE_DEFAULT_ZOOM_BAND_BOUNDARIES } from '@hierarchidb/util';
import { useCallback, useState } from 'react';
import type { TreeConsoleToolbarProps, TreeConsoleToolbarActionParams, TreeConsoleSearchMode } from '../../types.js';
import { ActionButtons } from './ActionButtons.js';
import { SearchField } from './SearchField.js';
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
  trashNodeId?: string;
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
  trashNodeId,
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
  const [trashAnchorEl, setArchiveAnchorEl] = useState<HTMLElement | null>(null);
  const { t } = useTranslation('common', { keyPrefix: 'treeConsole.toolbar' });

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

  const trashMenuHandlers = {
    onRestore: () => handleAction('restore', trashNodeId ? { trashNodeId } : undefined),
    onEmpty: () => handleAction('empty', trashNodeId ? { trashNodeId } : undefined),
  };

  const tooltips = {
    undo: t('tooltips.undo', { shortcut: '⌘+Z' }),
    redo: t('tooltips.redo', { shortcut: '⌘+Shift+Z' }),
    cut: t('tooltips.cut', { shortcut: '⌘+X' }),
    copy: t('tooltips.copy', { shortcut: '⌘+C' }),
    paste: t('tooltips.paste', { shortcut: '⌘+V' }),
    duplicate: t('tooltips.duplicate', { shortcut: '⌘+D' }),
    moveToArchive: t('tooltips.moveToArchive', { shortcut: '⌘+X' }),
  } as const;

  const trashButtonLabel = t('aria.trashMenuButton');
  const settingsButtonLabel = t('aria.settingsButton');

  const labels = {
    trashRestore: t('trashMenu.restore'),
    trashEmpty: t('trashMenu.empty'),
    rowClickTitle: t('rowClick.title'),
    rowClickSelectNavigate: t('rowClick.options.selectNavigate'),
    rowClickEdit: t('rowClick.options.edit'),
    themeTitle: t('settings.theme.title'),
    themeModes: {
      system: t('settings.theme.modes.system'),
      light: t('settings.theme.modes.light'),
      dark: t('settings.theme.modes.dark'),
    },
    languageTitle: t('settings.language.title'),
    languageModes: {
      system: t('settings.language.modes.system'),
      en: t('settings.language.modes.en'),
      ja: t('settings.language.modes.ja'),
    },
    developerMenuLabel: t('developerMenu.clearIndexedDb'),
    autosaveTitle: t('settings.autosave.title', 'Autosave'),
    dialogBackdropDismissTitle: t(
      'settings.dialogBackdropDismiss.title',
      'Close dialogs on outside click',
    ),
    zoomBandsTitle: t('settings.zoomBands.title', 'Zoom bands'),
    zoomBandsHelper: t(
      'settings.zoomBands.helper',
      'Default zoom band settings for new Shape/Route builds.',
    ),
    zoomBandsSummary: t(
      'settings.zoomBands.summary',
      'Used as the default Transform zoom bands when creating new Shape/Route nodes.',
    ),
    zoomBandsRangeCount: t('settings.zoomBands.rangeCount', 'Number of ranges'),
    zoomBandsRangeCountHelp: t(
      'settings.zoomBands.rangeCountHelp',
      'Set how many zoom ranges to use for transforms.',
    ),
    zoomBandsBoundaries: t('settings.zoomBands.boundaries', 'Range boundaries'),
    zoomBandsBoundariesHelp: t(
      'settings.zoomBands.boundariesHelp',
      'Adjust the zoom levels that split each range.',
    ),
    buildPolicyTitle: t('settings.buildPolicy.title', 'Build continuation policy'),
    buildPolicyHelper: t(
      'settings.buildPolicy.helper',
      'Controls how builds behave after errors.',
    ),
    buildPolicyFinishAll: t('settings.buildPolicy.options.finishAll', 'Finish all stages'),
    buildPolicyFinishStage: t('settings.buildPolicy.options.finishStage', 'Finish stage then stop'),
    buildPolicyStop: t('settings.buildPolicy.options.stop', 'Stop on first error'),
  } as const;

  return (
    <TreeConsoleToolbarContainer>
      <SearchField
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
        trashButtonLabel={trashButtonLabel}
        hasArchiveItems={hasArchiveItems}
        onAction={handleAction}
        onArchiveClick={(event) => setArchiveAnchorEl(event.currentTarget)}
        tooltips={tooltips}
      />

      <ArchiveMenu
        anchorEl={trashAnchorEl}
        open={Boolean(trashAnchorEl)}
        onClose={() => setArchiveAnchorEl(null)}
        onRestore={trashMenuHandlers.onRestore}
        onEmpty={trashMenuHandlers.onEmpty}
        restoreLabel={labels.trashRestore}
        emptyLabel={labels.trashEmpty}
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
