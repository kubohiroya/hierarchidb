import { useTranslation } from '@hierarchidb/ui-i18n';
import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { TreeConsoleToolbarProps } from '../types.js';
import { SearchOnlyToolbar, type SearchStrings } from './toolbar/SearchOnlyToolbar.js';
import { TreeConsoleToolbarContent } from './toolbar/TreeConsoleToolbarContent.js';

export const TreeConsoleToolbar = (props: TreeConsoleToolbarProps): React.JSX.Element | null => {
  const {
    hideConsole = false,
    showSearchOnly = false,
    controller,
    hasArchiveItems = false,
    trashNodeId,
    onAction,
    rowClickAction = 'Select/Navigate',
    onRowClickActionChange,
    autosaveEnabled = false,
    onAutosaveEnabledChange,
    dialogBackdropDismissEnabled = false,
    onDialogBackdropDismissEnabledChange,
    zoomBandBoundaries,
    onZoomBandBoundariesChange,
    buildContinuationPolicy = 'finish_all_stages',
    onBuildContinuationPolicyChange,
    canUndo = false,
    canRedo = false,
    canCopy = false,
    canPaste = false,
    canDuplicate = false,
    canArchive,
    developerModeEnabled = false,
  } = props;

  const theme = useTheme();
  const { t } = useTranslation('common', { keyPrefix: 'treeConsole.toolbar' });

  const searchStrings: SearchStrings = {
    placeholder: t('search.placeholder'),
    ariaLabel: t('search.ariaLabel'),
  };
  const toolbarAriaLabel = t('aria.toolbarLabel');

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
        trashNodeId={trashNodeId}
        onAction={onAction}
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
        canUndo={canUndo}
        canRedo={canRedo}
        canCopy={canCopy}
        canPaste={canPaste}
        canDuplicate={canDuplicate}
        canArchive={canArchive}
        developerModeEnabled={developerModeEnabled}
        searchStrings={searchStrings}
      />
    </Box>
  );
};
