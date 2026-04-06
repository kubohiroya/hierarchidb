import { useTranslation } from '@hierarchidb/ui-i18n';
import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { TreeConsoleToolbarProps } from '~/types';
import { SearchOnlyToolbar, type SearchStrings } from './toolbar/SearchOnlyToolbar.js';
import { TreeConsoleToolbarContent } from './toolbar/TreeConsoleToolbarContent.js';

export const TreeConsoleToolbar = (props: TreeConsoleToolbarProps): React.JSX.Element | null => {
  const {
    hideConsole = false,
    showSearchOnly = false,
    controller,
    hasArchiveItems = false,
    archiveNodeId,
    onAction,
    rowClickAction = 'Select/Navigate',
    onRowClickActionChange,
    autosaveEnabled = false,
    onAutosaveEnabledChange,
    dialogBackdropDismissEnabled = false,
    onDialogBackdropDismissEnabledChange,
    zoomBandBoundaries,
    onZoomBandBoundariesChange,
    canUndo = false,
    canRedo = false,
    canCopy = false,
    canPaste = false,
    canDuplicate = false,
    canArchive,
    developerModeEnabled = false,
    viewMode,
    onViewModeChange,
    sortMode,
    onSortModeChange,
  } = props;

  const theme = useTheme();
  const { t: tCommon } = useTranslation('common');

  const searchStrings: SearchStrings = {
    placeholder: tCommon('treeConsole.toolbar.search.placeholder', 'Search tree…'),
    ariaLabel: tCommon('treeConsole.toolbar.search.ariaLabel', 'Tree search'),
  };
  const toolbarAriaLabel = tCommon('treeConsole.toolbar.aria.toolbarLabel', 'Tree console toolbar');

  if (hideConsole) {
    return null;
  }

  if (showSearchOnly) {
    return <SearchOnlyToolbar controller={controller} searchStrings={searchStrings} />;
  }

  return (
    <Box
      data-testid="tree-console-toolbar"
      className="tree-console-toolbar"
      aria-label={toolbarAriaLabel}
      style={{ backgroundColor: theme.palette.background.paper }}
    >
      <TreeConsoleToolbarContent
        controller={controller}
        hasArchiveItems={hasArchiveItems}
        archiveNodeId={archiveNodeId}
        onAction={onAction}
        rowClickAction={rowClickAction}
        onRowClickActionChange={onRowClickActionChange}
        autosaveEnabled={autosaveEnabled}
        onAutosaveEnabledChange={onAutosaveEnabledChange}
        dialogBackdropDismissEnabled={dialogBackdropDismissEnabled}
        onDialogBackdropDismissEnabledChange={onDialogBackdropDismissEnabledChange}
        zoomBandBoundaries={zoomBandBoundaries}
        onZoomBandBoundariesChange={onZoomBandBoundariesChange}
        canUndo={canUndo}
        canRedo={canRedo}
        canCopy={canCopy}
        canPaste={canPaste}
        canDuplicate={canDuplicate}
        canArchive={canArchive}
        developerModeEnabled={developerModeEnabled}
        searchStrings={searchStrings}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        sortMode={sortMode}
        onSortModeChange={onSortModeChange}
      />
    </Box>
  );
};
