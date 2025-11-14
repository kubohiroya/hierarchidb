/**
 * TreeConsoleToolbar_Deprecated -
 * eria-cartographTreeConsoleToolbarUI
 */

import { useTranslation } from '@hierarchidb/ui-i18n';
//  Icons -
import {
  CheckBox,
  Clear as ClearIcon,
  ContentCopy as ContentCopyIcon,
  ContentCut as ContentCutIcon,
  ContentPaste as ContentPasteIcon,
  DarkMode as DarkModeIcon,
  FileCopy as DuplicateIcon,
  Edit,
  FileDownload as FileDownloadIcon,
  FileUpload as FileUploadIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowRight as KeyboardArrowRightIcon,
  LightMode as LightModeIcon,
  RestoreFromTrash as RecyclingIcon,
  Redo as RedoIcon,
  Clear as RemoveIcon,
  Save as SaveIcon,
  Search as SearchIcon,
  ScreenSearchDesktop as ScreenSearchDesktopIcon,
  Settings as SettingsIcon,
  SnippetFolder as SnippetFolderIcon,
  SettingsBrightness as SystemThemeIcon,
  Translate as TranslateIcon,
  Delete as TrashIcon,
  Undo as UndoIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  ButtonGroup,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';
import {
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useMemo,
  useState,
} from 'react';

import type { TreeConsoleToolbarActionParams, TreeConsoleToolbarProps } from '../types.js';
import type { TreeConsoleSearchMode } from '@hierarchidb/ui-treeconsole-base';

const BASE_SEARCH_FIELD_WIDTH_PX = 300;
const SEARCH_FIELD_WIDTH_PX = Math.round(BASE_SEARCH_FIELD_WIDTH_PX * 1.4);
const SEARCH_FIELD_MIN_WIDTH_PX = Math.round(SEARCH_FIELD_WIDTH_PX * 0.67);
const TREECONSOLE_SEARCH_INPUT_ID = 'treeconsole-toolbar-search-input';

const SearchTextFieldContainer = styled(Box)(() => ({
  display: 'flex',
  alignItems: 'center',
  borderBottom: 1,
  borderColor: 'divider',
  backgroundColor: 'background.paper',
  minWidth: `${SEARCH_FIELD_MIN_WIDTH_PX}px`,
  width: `${SEARCH_FIELD_WIDTH_PX}px`,
  borderRadius: '24px',
}));

const TreeConsoleToolbarContainer = styled(Box)(() => ({
  display: 'flex',
  alignItems: 'center',
  gap: '20px',
  margin: '0 16px 2px',
  minHeight: '48px',
}));

function SearchField({
  searchText,
  handleSearchTextChange,
  handleSearchCommit,
  fullWidth,
  placeholder,
  ariaLabel,
  searchMode,
  onSearchModeButtonClick,
  searchModeIcon,
  searchModeAriaLabel,
}: {
  searchText: string;
  handleSearchTextChange: (_value: string) => void;
  handleSearchCommit?: () => void;
  fullWidth?: boolean;
  placeholder: string;
  ariaLabel: string;
  searchMode: TreeConsoleSearchMode;
  onSearchModeButtonClick: (event: MouseEvent<HTMLElement>) => void;
  searchModeIcon: ReactNode;
  searchModeAriaLabel: string;
}) {
  return (
    <SearchTextFieldContainer>
      <TextField
        id={TREECONSOLE_SEARCH_INPUT_ID}
        fullWidth={fullWidth}
        size="small"
        placeholder={placeholder}
        value={searchText}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
          handleSearchTextChange(event.target.value)
        }
        onBlur={() => handleSearchCommit?.()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleSearchCommit?.();
          }
        }}
        InputProps={{
          style: {
            width: `${SEARCH_FIELD_WIDTH_PX}px`,
            borderRadius: '30px',
          },
          startAdornment: (
            <InputAdornment position="start">
              <IconButton
                size="small"
                onClick={onSearchModeButtonClick}
                aria-label={searchModeAriaLabel}
                aria-pressed={searchMode === 'fulltext'}
                edge="start"
              >
                {searchModeIcon}
              </IconButton>
            </InputAdornment>
          ),
          inputProps: {
            'aria-label': ariaLabel,
            autoComplete: 'new-password',
            name: 'hdb-console-search',
            type: 'search',
            inputMode: 'search',
            spellCheck: false,
            // Ask popular password managers to ignore this field
            'data-1p-ignore': 'true',
            'data-1p-skip': 'true',
            'data-lpignore': 'true',
            'data-bwignore': 'true',
            'data-form-type': 'other',
            autoCapitalize: 'off',
            autoCorrect: 'off',
          },
        }}
      />
    </SearchTextFieldContainer>
  );
}

function RadioItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <FormControlLabel
      value={value}
      control={<Radio size="small" />}
      label={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {icon}
          <Typography variant="body2">{label}</Typography>
        </Box>
      }
    />
  );
}

/**
 * TreeConsoleToolbarContent
 */
function TreeConsoleToolbarContent({
  controller,
  hasTrashItems,
  trashNodeId,
  onAction,
  rowClickAction = 'Select/Navigate',
  onRowClickActionChange,
  canUndo = false,
  canRedo = false,
  canCopy = false,
  canPaste = false,
  canDuplicate = false,
  canTrash = false,
  canRemove,
  availableTemplates = [],
  searchPlaceholder,
  searchAriaLabel,
}: {
  controller: TreeConsoleToolbarProps['controller'];
  hasTrashItems: boolean;
  trashNodeId?: string;
  onAction?: TreeConsoleToolbarProps['onAction'];
  rowClickAction?: TreeConsoleToolbarProps['rowClickAction'];
  onRowClickActionChange?: TreeConsoleToolbarProps['onRowClickActionChange'];
  canUndo?: boolean;
  canRedo?: boolean;
  canCopy?: boolean;
  canPaste?: boolean;
  canDuplicate?: boolean;
  canTrash?: boolean;
  canRemove?: boolean;
  availableTemplates?: NonNullable<TreeConsoleToolbarProps['availableTemplates']>;
  searchPlaceholder: string;
  searchAriaLabel: string;
}) {
  const portalContainer = typeof window !== 'undefined' ? document.body : undefined;
  const [settingsAnchorEl, setSettingsAnchorEl] = useState<null | HTMLElement>(null);
  const [importExportAnchorEl, setImportExportAnchorEl] = useState<null | HTMLElement>(null);
  const [trashAnchorEl, setTrashAnchorEl] = useState<null | HTMLElement>(null);
  const [themeAnchorEl, setThemeAnchorEl] = useState<null | HTMLElement>(null);
  const [languageAnchorEl, setLanguageAnchorEl] = useState<null | HTMLElement>(null);
  const { t } = useTranslation('common', { keyPrefix: 'treeConsole.toolbar' });
  const [themeMode, setThemeMode] = useState<'system' | 'light' | 'dark'>(
    () =>
      (typeof localStorage !== 'undefined' &&
        (localStorage.getItem('app.theme') as 'system' | 'light' | 'dark')) ||
      'system'
  );
  const [language, setLanguage] = useState<string>(
    () => (typeof localStorage !== 'undefined' && localStorage.getItem('app.lang')) || 'system'
  );
  const [templateAnchorEl, setTemplateAnchorEl] = useState<null | HTMLElement>(null);
  const [searchModeAnchorEl, setSearchModeAnchorEl] = useState<null | HTMLElement>(null);

  const settingsOpen = Boolean(settingsAnchorEl);
  const importExportOpen = Boolean(importExportAnchorEl);
  const trashOpen = Boolean(trashAnchorEl);
  const templateMenuOpen = Boolean(templateAnchorEl);
  const searchModeMenuOpen = Boolean(searchModeAnchorEl);

  const currentSearchMode: TreeConsoleSearchMode = controller?.searchMode ?? 'local';
  const openSearchModeMenu = (event: MouseEvent<HTMLElement>) => {
    setSearchModeAnchorEl(event.currentTarget);
  };
  const closeSearchModeMenu = () => setSearchModeAnchorEl(null);
  const handleSelectSearchMode = (mode: TreeConsoleSearchMode) => {
    controller?.onSearchModeChange?.(mode);
    closeSearchModeMenu();
  };

  const undoTooltip = t('tooltips.undo', { shortcut: '⌘+Z' });
  const redoTooltip = t('tooltips.redo', { shortcut: '⌘+Shift+Z' });
  const cutTooltip = t('tooltips.cut', { shortcut: '⌘+X' });
  const copyTooltip = t('tooltips.copy', { shortcut: '⌘+C' });
  const pasteTooltip = t('tooltips.paste', { shortcut: '⌘+V' });
  const duplicateTooltip = t('tooltips.duplicate', { shortcut: '⌘+D' });
  const moveToTrashTooltip = t('tooltips.moveToTrash', { shortcut: '⌘+X' });
  const searchModeMenuLabel = t('aria.searchModeMenu', 'Select search mode');
  const localSearchLabel = t('searchMode.local', 'Search expanded nodes');
  const fulltextSearchLabel = t('searchMode.fulltext', 'Full-text search');
  const localSearchDescription = t('searchMode.localDescription', 'Search currently expanded branches');
  const fulltextSearchDescription = t('searchMode.fulltextDescription', 'Search entire subtree');
  const searchModeIcon =
    currentSearchMode === 'fulltext' ? (
      <ScreenSearchDesktopIcon fontSize="small" />
    ) : (
      <SearchIcon fontSize="small" />
    );

  const allowTrash =
    (typeof canTrash === 'boolean' ? canTrash : undefined) ?? canRemove ?? true;

  const resolvedTemplates = useMemo(() => {
    try {
      if (!Array.isArray(availableTemplates)) return [];
      return availableTemplates.filter(
        (item): item is { id: string; label?: string } =>
          Boolean(item && typeof item.id === 'string')
      );
    } catch (error) {
      console.warn('[TreeConsoleToolbar] availableTemplates parse failed', error);
      return [];
    }
  }, [availableTemplates]);

  const hasTemplates = resolvedTemplates.length > 0;

  const trashButtonLabel = t('aria.trashMenuButton');
  const importExportButtonLabel = t('aria.importExportButton');
  const settingsButtonLabel = t('aria.settingsButton');

  const trashRestoreLabel = t('trashMenu.restore');
  const trashEmptyLabel = t('trashMenu.empty');

  const importLabel = t('importExportMenu.import');
  const exportLabel = t('importExportMenu.export');
  const importTemplateLabel = t('importExportMenu.importTemplate');
  const importTemplateFallback = t('importExportMenu.importTemplateFallback');

  const rowClickTitle = t('rowClick.title');
  const rowClickLabels = {
    selectNavigate: t('rowClick.options.selectNavigate'),
    edit: t('rowClick.options.edit'),
  };

  const themeTitle = t('settings.theme.title');
  const themeLabels = {
    system: t('settings.theme.modes.system'),
    light: t('settings.theme.modes.light'),
    dark: t('settings.theme.modes.dark'),
  } as const;

  const languageTitle = t('settings.language.title');
  const languageLabels = {
    system: t('settings.language.modes.system'),
    en: t('settings.language.modes.en'),
    ja: t('settings.language.modes.ja'),
  } as const;

  const handleSettingsClick = (event: MouseEvent<HTMLElement>) => {
    // Close other menus before opening Settings
    setImportExportAnchorEl(null);
    setTrashAnchorEl(null);
    setThemeAnchorEl(null);
    setLanguageAnchorEl(null);
    setSettingsAnchorEl(event.currentTarget);
  };

  const closeSettingsMenu = useCallback(() => {
    setSettingsAnchorEl(null);
    setThemeAnchorEl(null);
    setLanguageAnchorEl(null);
  }, []);

  const scheduleCloseSettingsMenu = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        closeSettingsMenu();
      }, 0);
    } else {
      closeSettingsMenu();
    }
  }, [closeSettingsMenu]);

  const handleSettingsClose = () => {
    closeSettingsMenu();
  };

  const handleImportExportClick = (event: MouseEvent<HTMLElement>) => {
    // Close other menus before opening Import/Export
    setSettingsAnchorEl(null);
    setTrashAnchorEl(null);
    setThemeAnchorEl(null);
    setLanguageAnchorEl(null);
    setImportExportAnchorEl(event.currentTarget);
  };

  const handleImportExportClose = () => {
    setImportExportAnchorEl(null);
    setTemplateAnchorEl(null);
  };

  const handleTrashClick = (event: MouseEvent<HTMLElement>) => {
    // Close other menus before opening Trash menu
    setSettingsAnchorEl(null);
    setImportExportAnchorEl(null);
    setThemeAnchorEl(null);
    setLanguageAnchorEl(null);
    setTrashAnchorEl(event.currentTarget);
  };

  const handleTrashClose = () => {
    setTrashAnchorEl(null);
  };

  const handleTemplateMenuOpen = (
    event: MouseEvent<HTMLElement> | FocusEvent<HTMLElement> | KeyboardEvent<HTMLElement>
  ) => {
    event.preventDefault?.();
    event.stopPropagation?.();
    const target = event.currentTarget as HTMLElement | null;
    if (!target) return;
    setTemplateAnchorEl(target);
  };

  const handleTemplateMenuClose = () => {
    setTemplateAnchorEl(null);
  };

  // Action handler
  const handleAction = useCallback(
    (action: string, params?: TreeConsoleToolbarActionParams) => {
      if (onAction) {
        onAction(action, params);
      } else {
        console.log(`Action: ${action}`, params ? params : '- TODO: Connect to controller');
      }
    },
    [onAction]
  );

  const handleRowClickActionChange = useCallback(
    (action: 'Select/Navigate' | 'Edit') => {
      if (onRowClickActionChange) {
        onRowClickActionChange(action);
      } else {
        handleAction('setRowClickAction', action);
      }
      scheduleCloseSettingsMenu();
    },
    [handleAction, onRowClickActionChange, scheduleCloseSettingsMenu]
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

  const themeOpen = Boolean(themeAnchorEl);
  const languageOpen = Boolean(languageAnchorEl);

  // Theme submenu handlers
  const openThemeMenu = (event: MouseEvent<HTMLElement>) => {
    // Ensure sibling sub-menu is closed
    setLanguageAnchorEl(null);
    setThemeAnchorEl(event.currentTarget);
  };
  const closeThemeMenu = () => setThemeAnchorEl(null);
  const selectTheme = (mode: 'system' | 'light' | 'dark') => {
    setThemeMode(mode);
    localStorage.setItem('app.theme', mode);
    window.dispatchEvent(new CustomEvent('hierarchidb-theme-change', { detail: { mode } }));
    closeThemeMenu();
    scheduleCloseSettingsMenu();
  };

  // Language submenu handlers
  const openLanguageMenu = (event: MouseEvent<HTMLElement>) => {
    setThemeAnchorEl(null);
    setLanguageAnchorEl(event.currentTarget);
  };
  const closeLanguageMenu = () => setLanguageAnchorEl(null);
  const selectLanguage = (lang: string) => {
    setLanguage(lang);
    localStorage.setItem('app.lang', lang);
    window.dispatchEvent(new CustomEvent('hierarchidb-language-change', { detail: { lang } }));
    closeLanguageMenu();
    scheduleCloseSettingsMenu();
  };

  return (
    <TreeConsoleToolbarContainer>
      {/* Search Input */}
      <SearchField
        searchText={controller?.searchText || ''}
        handleSearchTextChange={handleSearch}
        handleSearchCommit={controller?.handleSearchCommit}
        placeholder={searchPlaceholder}
        ariaLabel={searchAriaLabel}
        searchMode={currentSearchMode}
        onSearchModeButtonClick={openSearchModeMenu}
        searchModeIcon={searchModeIcon}
        searchModeAriaLabel={searchModeMenuLabel}
      />
      <Menu anchorEl={searchModeAnchorEl} open={searchModeMenuOpen} onClose={closeSearchModeMenu}>
        <MenuItem
          selected={currentSearchMode === 'local'}
          onClick={() => handleSelectSearchMode('local')}
          aria-label={localSearchLabel}
        >
          <ListItemIcon>
            <SearchIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={localSearchLabel} secondary={localSearchDescription} />
        </MenuItem>
        <MenuItem
          selected={currentSearchMode === 'fulltext'}
          onClick={() => handleSelectSearchMode('fulltext')}
          aria-label={fulltextSearchLabel}
        >
          <ListItemIcon>
            <ScreenSearchDesktopIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={fulltextSearchLabel} secondary={fulltextSearchDescription} />
        </MenuItem>
      </Menu>

      {/* Undo/Redo Group */}
      <ButtonGroup size="small">
        <Button
          title={undoTooltip}
          aria-label={undoTooltip}
          disabled={!canUndo}
          onClick={() => handleAction('undo')}
          data-testid="treeconsole-toolbar-undo-button"
        >
          <UndoIcon fontSize="small" />
        </Button>
        <Button
          title={redoTooltip}
          aria-label={redoTooltip}
          disabled={!canRedo}
          onClick={() => handleAction('redo')}
          data-testid="treeconsole-toolbar-redo-button"
        >
          <RedoIcon fontSize="small" />
        </Button>
      </ButtonGroup>

      {/* Cut/Copy/Paste Group */}
      <ButtonGroup size="small">
        <Button
          title={cutTooltip}
          aria-label={cutTooltip}
          disabled={!canCopy}
          onClick={() => handleAction('cut')}
        >
          <ContentCutIcon fontSize="small" />
        </Button>
        <Button
          title={copyTooltip}
          aria-label={copyTooltip}
          disabled={!canCopy}
          onClick={() => handleAction('copy')}
        >
          <ContentCopyIcon fontSize="small" />
        </Button>
        <Button
          title={pasteTooltip}
          aria-label={pasteTooltip}
          disabled={!canPaste}
          onClick={() => handleAction('paste')}
        >
          <ContentPasteIcon fontSize="small" />
        </Button>
      </ButtonGroup>

      {/* Duplicate/Move to Trash Group */}
      <ButtonGroup size="small">
        <Button
          title={duplicateTooltip}
          aria-label={duplicateTooltip}
          disabled={!canDuplicate}
          onClick={() => handleAction('duplicate')}
        >
          <DuplicateIcon fontSize="small" />
        </Button>
        <Button
          title={moveToTrashTooltip}
          aria-label={moveToTrashTooltip}
          disabled={!allowTrash}
          onClick={() => handleAction('trash')}
          color="error"
        >
          <ClearIcon fontSize="small" />
        </Button>
      </ButtonGroup>

      {/* Trash Management Dropdown */}
      <ButtonGroup size="small">
        <Button
          disabled={!hasTrashItems}
          endIcon={<KeyboardArrowDownIcon />}
          onClick={handleTrashClick}
          color="error"
          title={trashButtonLabel}
          aria-label={trashButtonLabel}
        >
          <TrashIcon fontSize="small" />
        </Button>
      </ButtonGroup>
      <Menu anchorEl={trashAnchorEl} open={trashOpen} onClose={handleTrashClose}>
        <MenuItem
          onClick={() => {
            handleAction('restore', trashNodeId ? { trashNodeId } : undefined);
            handleTrashClose();
          }}
          aria-label={trashRestoreLabel}
        >
          <ListItemIcon>
            <RecyclingIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={trashRestoreLabel} />
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleAction('empty', trashNodeId ? { trashNodeId } : undefined);
            handleTrashClose();
          }}
          aria-label={trashEmptyLabel}
        >
          <ListItemIcon>
            <RemoveIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={trashEmptyLabel} />
        </MenuItem>
      </Menu>

      {/* Import/Export Menu - positioned at far right */}
      <Box sx={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
        <ButtonGroup size="small">
          <Button
            endIcon={<KeyboardArrowDownIcon />}
            onClick={handleImportExportClick}
            color="primary"
            aria-label={importExportButtonLabel}
            title={importExportButtonLabel}
          >
            <SaveIcon fontSize="small" />
          </Button>
        </ButtonGroup>
        <Menu
          anchorEl={importExportAnchorEl}
          open={importExportOpen}
          onClose={handleImportExportClose}
          container={portalContainer}
        >
          <MenuItem
            onClick={() => {
              handleAction('import');
              handleImportExportClose();
            }}
            aria-label={importLabel}
          >
            <ListItemIcon>
              <FileUploadIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={importLabel} />
          </MenuItem>
          <MenuItem
            onClick={() => {
              handleAction('export');
              handleImportExportClose();
            }}
            aria-label={exportLabel}
          >
            <ListItemIcon>
              <FileDownloadIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={exportLabel} />
          </MenuItem>
          {hasTemplates && [
            <Divider key="import-template-divider" />,
            <MenuItem
              key="import-template-trigger"
              aria-haspopup="menu"
              aria-label={importTemplateLabel}
              onMouseEnter={handleTemplateMenuOpen}
              onFocus={handleTemplateMenuOpen}
              onClick={handleTemplateMenuOpen}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowRight') {
                  handleTemplateMenuOpen(event);
                }
              }}
            >
              <ListItemIcon>
                <SnippetFolderIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={importTemplateLabel} />
              <KeyboardArrowRightIcon fontSize="small" />
            </MenuItem>,
          ]}
        </Menu>

        {hasTemplates && (
          <Menu
            anchorEl={templateAnchorEl}
            open={templateMenuOpen}
            onClose={handleTemplateMenuClose}
            container={portalContainer}
            anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            MenuListProps={{ onMouseLeave: handleTemplateMenuClose }}
          >
            {resolvedTemplates.map((template) => (
              <MenuItem
                key={template.id}
                onClick={() => {
                  handleAction('import-template', { templateId: template.id });
                  handleTemplateMenuClose();
                  handleImportExportClose();
                }}
                aria-label={template.label ?? importTemplateFallback}
              >
                <ListItemText primary={template.label ?? importTemplateFallback} />
              </MenuItem>
            ))}
          </Menu>
        )}

        {/* Settings Button */}
        <IconButton
          size="small"
          onClick={handleSettingsClick}
          aria-label={settingsButtonLabel}
          title={settingsButtonLabel}
        >
          <SettingsIcon fontSize="small" />
        </IconButton>
        <Menu
          open={settingsOpen}
          anchorEl={settingsAnchorEl}
          container={portalContainer}
          onClose={handleSettingsClose}
        >
          <MenuItem>
            <Paper
              sx={{
                p: 2,
                minWidth: 250,
                zIndex: (theme) => Math.max(theme.zIndex.modal + 2, 2001),
              }}
            >
              <Typography variant="subtitle2" gutterBottom>
                {rowClickTitle}
              </Typography>
              <RadioGroup
                value={rowClickAction}
                onChange={(e) =>
                  handleRowClickActionChange(e.target.value as 'Select/Navigate' | 'Edit')
                }
              >
                <RadioItem
                  icon={<CheckBox fontSize="small" />}
                  label={rowClickLabels.selectNavigate}
                  value={'Select/Navigate'}
                />
                <RadioItem
                  icon={<Edit fontSize="small" />}
                  label={rowClickLabels.edit}
                  value={'Edit'}
                />
              </RadioGroup>
            </Paper>
          </MenuItem>

          <Divider sx={{ my: 1 }} />

          {/* Theme selection opener */}
          <MenuItem onClick={openThemeMenu} aria-haspopup="menu" aria-label={themeTitle}>
            <ListItemIcon>
              {themeMode === 'dark' ? (
                <DarkModeIcon fontSize="small" />
              ) : themeMode === 'light' ? (
                <LightModeIcon fontSize="small" />
              ) : (
                <SystemThemeIcon fontSize="small" />
              )}
            </ListItemIcon>
            <ListItemText primary={themeTitle} secondary={themeLabels[themeMode] ?? themeMode} />
          </MenuItem>

          {/* Language selection opener */}
          <MenuItem onClick={openLanguageMenu} aria-haspopup="menu" aria-label={languageTitle}>
            <ListItemIcon>
              <TranslateIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={languageTitle}
              secondary={languageLabels[language as keyof typeof languageLabels] ?? language}
            />
          </MenuItem>
        </Menu>

        {/* Theme submenu (rendered outside parent Menu to avoid invalid children) */}
        <Menu
          anchorEl={themeAnchorEl}
          open={themeOpen}
          onClose={closeThemeMenu}
          container={typeof window !== 'undefined' ? document.body : undefined}
        >
          <MenuItem
            selected={themeMode === 'system'}
            onClick={() => selectTheme('system')}
            aria-label={themeLabels.system}
          >
            <ListItemIcon>
              <SystemThemeIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={themeLabels.system} />
          </MenuItem>
          <MenuItem
            selected={themeMode === 'light'}
            onClick={() => selectTheme('light')}
            aria-label={themeLabels.light}
          >
            <ListItemIcon>
              <LightModeIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={themeLabels.light} />
          </MenuItem>
          <MenuItem
            selected={themeMode === 'dark'}
            onClick={() => selectTheme('dark')}
            aria-label={themeLabels.dark}
          >
            <ListItemIcon>
              <DarkModeIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={themeLabels.dark} />
          </MenuItem>
        </Menu>

        {/* Language submenu (rendered outside parent Menu) */}
        <Menu
          anchorEl={languageAnchorEl}
          open={languageOpen}
          onClose={closeLanguageMenu}
          container={typeof window !== 'undefined' ? document.body : undefined}
        >
          <MenuItem
            selected={language === 'system'}
            onClick={() => selectLanguage('system')}
            aria-label={languageLabels.system}
          >
            <ListItemText primary={languageLabels.system} />
          </MenuItem>
          <MenuItem
            selected={language === 'en'}
            onClick={() => selectLanguage('en')}
            aria-label={languageLabels.en}
          >
            <ListItemText primary={languageLabels.en} />
          </MenuItem>
          <MenuItem
            selected={language === 'ja'}
            onClick={() => selectLanguage('ja')}
            aria-label={languageLabels.ja}
          >
            <ListItemText primary={languageLabels.ja} />
          </MenuItem>
        </Menu>
      </Box>
    </TreeConsoleToolbarContainer>
  );
}

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
  } = props;

  const resolvedCanTrash = typeof canTrash === 'boolean' ? canTrash : canRemove;
  const [searchOnlyAnchorEl, setSearchOnlyAnchorEl] = useState<null | HTMLElement>(null);

  const theme = useTheme();
  const { t } = useTranslation('common', { keyPrefix: 'treeConsole.toolbar' });
  const searchPlaceholder = t('search.placeholder');
  const searchAriaLabel = t('search.ariaLabel');
  const toolbarAriaLabel = t('aria.toolbarLabel');

  // Hide if console is hidden
  if (hideConsole) {
    return null;
  }

  if (showSearchOnly) {
    const currentSearchMode: TreeConsoleSearchMode = controller?.searchMode ?? 'local';
    const searchModeMenuLabel = t('aria.searchModeMenu', 'Select search mode');
    const localSearchLabel = t('searchMode.local', 'Search expanded nodes');
    const fulltextSearchLabel = t('searchMode.fulltext', 'Full-text search');
    const localSearchDescription = t('searchMode.localDescription', 'Search currently expanded branches');
    const fulltextSearchDescription = t('searchMode.fulltextDescription', 'Search entire subtree');
    const searchModeMenuOpen = Boolean(searchOnlyAnchorEl);
    const openSearchModeMenu = (event: MouseEvent<HTMLElement>) => {
      setSearchOnlyAnchorEl(event.currentTarget);
    };
    const closeSearchModeMenu = () => setSearchOnlyAnchorEl(null);
    const handleSearchModeSelect = (mode: TreeConsoleSearchMode) => {
      controller?.onSearchModeChange?.(mode);
      closeSearchModeMenu();
    };
    const searchModeIcon =
      currentSearchMode === 'fulltext' ? (
        <ScreenSearchDesktopIcon fontSize="small" />
      ) : (
        <SearchIcon fontSize="small" />
      );

    return (
      <>
        <SearchField
          fullWidth={true}
          searchText={controller?.searchText || ''}
          handleSearchTextChange={controller?.handleSearchTextChange || (() => {})}
          handleSearchCommit={controller?.handleSearchCommit}
          placeholder={searchPlaceholder}
          ariaLabel={searchAriaLabel}
          searchMode={currentSearchMode}
          onSearchModeButtonClick={openSearchModeMenu}
          searchModeIcon={searchModeIcon}
          searchModeAriaLabel={searchModeMenuLabel}
        />
        <Menu anchorEl={searchOnlyAnchorEl} open={searchModeMenuOpen} onClose={closeSearchModeMenu}>
          <MenuItem
            selected={currentSearchMode === 'local'}
            onClick={() => handleSearchModeSelect('local')}
            aria-label={localSearchLabel}
          >
            <ListItemIcon>
              <SearchIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={localSearchLabel} secondary={localSearchDescription} />
          </MenuItem>
          <MenuItem
            selected={currentSearchMode === 'fulltext'}
            onClick={() => handleSearchModeSelect('fulltext')}
            aria-label={fulltextSearchLabel}
          >
            <ListItemIcon>
              <ScreenSearchDesktopIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={fulltextSearchLabel} secondary={fulltextSearchDescription} />
          </MenuItem>
        </Menu>
      </>
    );
  }

  // Render full toolbar for any page unless explicitly hidden
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
        searchPlaceholder={searchPlaceholder}
        searchAriaLabel={searchAriaLabel}
      />
    </Box>
  );
};
