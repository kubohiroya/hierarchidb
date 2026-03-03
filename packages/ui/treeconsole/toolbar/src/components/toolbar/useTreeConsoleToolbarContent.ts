import { useTranslation } from '@hierarchidb/ui-i18n';
import { useCallback, useMemo, useState } from 'react';
import type { TreeConsoleSearchMode, TreeConsoleToolbarActionParams, TreeConsoleToolbarProps } from '~/types';
import type { SearchStrings } from './SearchOnlyToolbar.js';

interface UseTreeConsoleToolbarContentParams {
  controller?: TreeConsoleToolbarProps['controller'];
  archiveNodeId?: string;
  onAction?: TreeConsoleToolbarProps['onAction'];
  canArchive?: boolean;
  canRemove?: boolean;
  searchStrings: SearchStrings;
}

export function useTreeConsoleToolbarContent({
  controller,
  archiveNodeId,
  onAction,
  canArchive,
  canRemove,
  searchStrings,
}: UseTreeConsoleToolbarContentParams) {
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
    [onAction],
  );

  const handleSearch = useCallback(
    (value: string) => {
      try {
        controller?.handleSearchTextChange?.(value);
      } catch (error) {
        console.warn('Search not implemented:', error);
      }
    },
    [controller],
  );

  const currentSearchMode: TreeConsoleSearchMode = 'local';

  const allowArchive = (typeof canArchive === 'boolean' ? canArchive : undefined) ?? canRemove ?? true;

  const archiveMenuHandlers = useMemo(
    () => ({
      onRestore: () => handleAction('restore', archiveNodeId ? { archiveNodeId } : undefined),
      onEmpty: () => handleAction('empty', archiveNodeId ? { archiveNodeId } : undefined),
    }),
    [archiveNodeId, handleAction],
  );

  const tooltips = useMemo(
    () => ({
      undo: tCommon('treeConsole.toolbar.tooltips.undo', { shortcut: '⌘+Z' }),
      redo: tCommon('treeConsole.toolbar.tooltips.redo', { shortcut: '⌘+Shift+Z' }),
      cut: tCommon('treeConsole.toolbar.tooltips.cut', { shortcut: '⌘+X' }),
      copy: tCommon('treeConsole.toolbar.tooltips.copy', { shortcut: '⌘+C' }),
      paste: tCommon('treeConsole.toolbar.tooltips.paste', { shortcut: '⌘+V' }),
      duplicate: tCommon('treeConsole.toolbar.tooltips.duplicate', { shortcut: '⌘+D' }),
      moveToArchive: tCommon('treeConsole.toolbar.tooltips.moveToArchive', { shortcut: '⌘+X' }),
    }),
    [tCommon],
  );

  const archiveButtonLabel = tCommon('treeConsole.toolbar.aria.archiveMenuButton');
  const settingsButtonLabel = tCommon('treeConsole.toolbar.aria.settingsButton');

  const labels = useMemo(
    () => ({
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
        'Used as the default Geometry zoom bands when creating new Shape/Route nodes.',
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
    }),
    [tCommon],
  );

  return {
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
    searchText: controller?.searchText || '',
    handleSearchCommit: controller?.handleSearchCommit,
    searchStrings,
  };
}
