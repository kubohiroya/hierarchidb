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
    hasTrashItems = false,
    trashNodeId,
    onAction,
    rowClickAction = 'Select/Navigate',
    onRowClickActionChange,
    canUndo = false,
    canRedo = false,
    canCopy = false,
    canPaste = false,
    canDuplicate = false,
    canTrash,
    canRemove = false,
    availableTemplates = [],
    allowImport = true,
    developerModeEnabled = false,
  } = props;

  const resolvedCanTrash = typeof canTrash === 'boolean' ? canTrash : canRemove;
  const theme = useTheme();
  const { t } = useTranslation('common', { keyPrefix: 'treeConsole.toolbar' });

  const searchStrings: SearchStrings = {
    placeholder: t('search.placeholder'),
    ariaLabel: t('search.ariaLabel'),
    menuLabel: t('aria.searchModeMenu', 'Select search mode'),
    localLabel: t('searchMode.local', 'Search expanded nodes'),
    localDescription: t('searchMode.localDescription', 'Search currently expanded branches'),
    fulltextLabel: t('searchMode.fulltext', 'Full-text search'),
    fulltextDescription: t('searchMode.fulltextDescription', 'Search entire subtree'),
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
        hasTrashItems={hasTrashItems}
        trashNodeId={trashNodeId}
        onAction={onAction}
        rowClickAction={rowClickAction}
        onRowClickActionChange={onRowClickActionChange}
        canUndo={canUndo}
        canRedo={canRedo}
        canCopy={canCopy}
        canPaste={canPaste}
        canDuplicate={canDuplicate}
        canTrash={resolvedCanTrash}
        canRemove={canRemove}
        availableTemplates={availableTemplates}
        allowImport={allowImport}
        developerModeEnabled={developerModeEnabled}
        searchStrings={searchStrings}
      />
    </Box>
  );
};
