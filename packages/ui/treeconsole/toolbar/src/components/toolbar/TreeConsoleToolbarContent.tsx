import { ScreenSearchDesktop as ScreenSearchDesktopIcon, Search as SearchIcon } from '@mui/icons-material';
import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from '@hierarchidb/ui-i18n';
import { useCallback, useMemo, useState } from 'react';
import type { TreeConsoleToolbarProps, TreeConsoleToolbarActionParams, TreeConsoleSearchMode } from '../../types.js';
import { ActionButtons } from './ActionButtons.js';
import { ImportExportMenu } from './ImportExportMenu.js';
import { SearchField } from './SearchField.js';
import type { SearchStrings } from './SearchOnlyToolbar.js';
import { SearchModeMenu } from './SearchModeMenu.js';
import { SettingsMenu } from './SettingsMenu.js';
import { TrashMenu } from './TrashMenu.js';

const TreeConsoleToolbarContainer = styled(Box)(() => ({
  display: 'flex',
  alignItems: 'center',
  gap: '20px',
  margin: '0 16px 2px',
  minHeight: '48px',
}));

interface TreeConsoleToolbarContentProps {
  controller?: TreeConsoleToolbarProps['controller'];
  hasTrashItems: boolean;
  trashNodeId?: string;
  onAction?: TreeConsoleToolbarProps['onAction'];
  rowClickAction?: TreeConsoleToolbarProps['rowClickAction'];
  onRowClickActionChange?: TreeConsoleToolbarProps['onRowClickActionChange'];
  canUndo: boolean;
  canRedo: boolean;
  canCopy: boolean;
  canPaste: boolean;
  canDuplicate: boolean;
  canTrash?: boolean;
  canRemove?: boolean;
  availableTemplates: NonNullable<TreeConsoleToolbarProps['availableTemplates']>;
  allowImport: boolean;
  developerModeEnabled: boolean;
  searchStrings: SearchStrings;
}

export function TreeConsoleToolbarContent({
  controller,
  hasTrashItems,
  trashNodeId,
  onAction,
  rowClickAction = 'Select/Navigate',
  onRowClickActionChange,
  canUndo,
  canRedo,
  canCopy,
  canPaste,
  canDuplicate,
  canTrash,
  canRemove,
  availableTemplates,
  allowImport,
  developerModeEnabled,
  searchStrings,
}: TreeConsoleToolbarContentProps) {
  const portalContainer = typeof window !== 'undefined' ? document.body : undefined;
  const [searchModeAnchorEl, setSearchModeAnchorEl] = useState<HTMLElement | null>(null);
  const [trashAnchorEl, setTrashAnchorEl] = useState<HTMLElement | null>(null);
  const { t } = useTranslation('common', { keyPrefix: 'treeConsole.toolbar' });

  const resolvedTemplates = useMemo(() => {
    try {
      if (!Array.isArray(availableTemplates)) return [];
      return availableTemplates.filter(
        (item): item is { id: string; label?: string } => Boolean(item && typeof item.id === 'string')
      );
    } catch (error) {
      console.warn('[TreeConsoleToolbar] availableTemplates parse failed', error);
      return [];
    }
  }, [availableTemplates]);

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

  const currentSearchMode: TreeConsoleSearchMode = controller?.searchMode ?? 'local';
  const searchModeIcon =
    currentSearchMode === 'fulltext' ? (
      <ScreenSearchDesktopIcon fontSize="small" />
    ) : (
      <SearchIcon fontSize="small" />
    );

  const openSearchModeMenu = (event: React.MouseEvent<HTMLElement>) => {
    setSearchModeAnchorEl(event.currentTarget);
  };
  const closeSearchModeMenu = () => setSearchModeAnchorEl(null);
  const handleSelectSearchMode = (mode: TreeConsoleSearchMode) => {
    controller?.onSearchModeChange?.(mode);
    closeSearchModeMenu();
  };

  const allowTrash = (typeof canTrash === 'boolean' ? canTrash : undefined) ?? canRemove ?? true;

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
    moveToTrash: t('tooltips.moveToTrash', { shortcut: '⌘+X' }),
  } as const;

  const trashButtonLabel = t('aria.trashMenuButton');
  const importExportButtonLabel = t('aria.importExportButton');
  const settingsButtonLabel = t('aria.settingsButton');

  const labels = {
    trashRestore: t('trashMenu.restore'),
    trashEmpty: t('trashMenu.empty'),
    import: t('importExportMenu.import'),
    export: t('importExportMenu.export'),
    importTemplate: t('importExportMenu.importTemplate'),
    importTemplateFallback: t('importExportMenu.importTemplateFallback'),
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
        onSearchModeButtonClick={openSearchModeMenu}
        searchModeIcon={searchModeIcon}
        searchModeAriaLabel={searchStrings.menuLabel}
      />

      <SearchModeMenu
        anchorEl={searchModeAnchorEl}
        open={Boolean(searchModeAnchorEl)}
        onClose={closeSearchModeMenu}
        currentMode={currentSearchMode}
        onSelect={handleSelectSearchMode}
        localLabel={searchStrings.localLabel}
        localDescription={searchStrings.localDescription}
        fulltextLabel={searchStrings.fulltextLabel}
        fulltextDescription={searchStrings.fulltextDescription}
      />

      <ActionButtons
        canUndo={canUndo}
        canRedo={canRedo}
        canCopy={canCopy}
        canPaste={canPaste}
        canDuplicate={canDuplicate}
        allowTrash={allowTrash}
        trashButtonLabel={trashButtonLabel}
        hasTrashItems={hasTrashItems}
        onAction={handleAction}
        onTrashClick={(event) => setTrashAnchorEl(event.currentTarget)}
        tooltips={tooltips}
      />

      <TrashMenu
        anchorEl={trashAnchorEl}
        open={Boolean(trashAnchorEl)}
        onClose={() => setTrashAnchorEl(null)}
        onRestore={trashMenuHandlers.onRestore}
        onEmpty={trashMenuHandlers.onEmpty}
        restoreLabel={labels.trashRestore}
        emptyLabel={labels.trashEmpty}
      />

      <Box sx={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
        <ImportExportMenu
          buttonLabel={importExportButtonLabel}
          allowImport={allowImport}
          templates={resolvedTemplates}
          importLabel={labels.import}
          exportLabel={labels.export}
          importTemplateLabel={labels.importTemplate}
          importTemplateFallback={labels.importTemplateFallback}
          onImport={() => handleAction('import')}
          onExport={() => handleAction('export')}
          onImportTemplate={(templateId) => handleAction('import-template', { templateId })}
          portalContainer={portalContainer}
        />

        <SettingsMenu
          rowClickAction={rowClickAction}
          onRowClickActionChange={onRowClickActionChange}
          onAction={handleAction}
          developerModeEnabled={developerModeEnabled}
          portalContainer={portalContainer}
          labels={{
            settingsButton: settingsButtonLabel,
            rowClickTitle: labels.rowClickTitle,
            rowClickSelectNavigate: labels.rowClickSelectNavigate,
            rowClickEdit: labels.rowClickEdit,
            themeTitle: labels.themeTitle,
            themeModes: labels.themeModes,
            languageTitle: labels.languageTitle,
            languageModes: labels.languageModes,
            developerMenuLabel: labels.developerMenuLabel,
          }}
        />
      </Box>
    </TreeConsoleToolbarContainer>
  );
}
