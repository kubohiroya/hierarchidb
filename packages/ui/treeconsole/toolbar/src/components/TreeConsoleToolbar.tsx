/**
  * TreeConsoleToolbar_Deprecated -
  * eria-cartographTreeConsoleToolbarUI
   */

import { type MouseEvent, useState, useCallback } from 'react';
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
import { useTranslation } from '@hierarchidb/ui-i18n';

//  Icons -
import {
  CheckBox,
  Clear as ClearIcon,
  Clear as RemoveIcon,
  ContentCopy as ContentCopyIcon,
  ContentPaste as ContentPasteIcon,
  ContentCut as ContentCutIcon,
  Delete as TrashIcon,
  Edit,
  FileCopy as DuplicateIcon,
  FileDownload as FileDownloadIcon,
  FileUpload as FileUploadIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  Redo as RedoIcon,
  RestoreFromTrash as RecyclingIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
  SnippetFolder as SnippetFolderIcon,
  Save as SaveIcon,
  Undo as UndoIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  Translate as TranslateIcon,
  SettingsBrightness as SystemThemeIcon,
} from '@mui/icons-material';

import type { TreeConsoleToolbarActionParams, TreeConsoleToolbarProps } from '../types.js';

const SearchTextFieldContainer = styled(Box)(() => ({
  display: 'flex',
  alignItems: 'center',
  borderBottom: 1,
  borderColor: 'divider',
  backgroundColor: 'background.paper',
  minWidth: '200px',
  width: '300px',
  borderRadius: '24px'
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
}: {
  searchText: string;
  handleSearchTextChange: (_value: string) => void;
  handleSearchCommit?: () => void;
  fullWidth?: boolean;
  placeholder: string;
  ariaLabel: string;
}) {
  return (
    <SearchTextFieldContainer>
      <TextField
        fullWidth={fullWidth}
        size="small"
        placeholder={placeholder}
        value={searchText}
        onChange={(event: React.ChangeEvent<HTMLInputElement>)=>handleSearchTextChange(event.target.value)}
        onBlur={() => handleSearchCommit?.()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleSearchCommit?.();
          }
        }}
          InputProps={{
            style:{
              width: '300px',
              borderRadius: '30px',
            },
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            inputProps: {
              'aria-label': ariaLabel,
            autoComplete: 'new-password',
              name: 'hdb-tree-search',
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

function RadioItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <FormControlLabel
    value={value}
    control={<Radio size="small" />}
    label={
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {icon}
        <Typography variant="body2">{label}</Typography>
      </Box>
    }
  />
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
                                     canRemove = false,
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
  const [themeMode, setThemeMode] = useState<'system' | 'light' | 'dark'>(() =>
    (typeof localStorage !== 'undefined' && (localStorage.getItem('app.theme') as 'system' | 'light' | 'dark')) || 'system',
  );
  const [language, setLanguage] = useState<string>(
    () => (typeof localStorage !== 'undefined' && localStorage.getItem('app.lang')) || 'system',
  );

  const settingsOpen = Boolean(settingsAnchorEl);
  const importExportOpen = Boolean(importExportAnchorEl);
  const trashOpen = Boolean(trashAnchorEl);

  const undoTooltip = t('tooltips.undo', { shortcut: '⌘+Z' });
  const redoTooltip = t('tooltips.redo', { shortcut: '⌘+Shift+Z' });
  const cutTooltip = t('tooltips.cut', { shortcut: '⌘+X' });
  const copyTooltip = t('tooltips.copy', { shortcut: '⌘+C' });
  const pasteTooltip = t('tooltips.paste', { shortcut: '⌘+V' });
  const duplicateTooltip = t('tooltips.duplicate', { shortcut: '⌘+D' });
  const moveToTrashTooltip = t('tooltips.moveToTrash', { shortcut: '⌘+X' });

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

  // Action handler
  const handleAction = useCallback((action: string, params?: TreeConsoleToolbarActionParams) => {
    if (onAction) {
      onAction(action, params);
    } else {
      console.log(`Action: ${action}`, params ? params : '- TODO: Connect to controller');
    }
  }, [
    onAction,
  ]);

  const handleRowClickActionChange = useCallback((action: 'Select/Navigate' | 'Edit') => {
    if (onRowClickActionChange) {
      onRowClickActionChange(action);
    } else {
      handleAction('setRowClickAction', action);
    }
    scheduleCloseSettingsMenu();
  }, [handleAction, onRowClickActionChange, scheduleCloseSettingsMenu]);


  const handleSearch = useCallback((value: string) => {
    try {
      controller?.handleSearchTextChange?.(value);
    } catch (error) {
      console.warn('Search not implemented:', error);
    }
  }, [controller]);

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
      />

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
        <Button title={cutTooltip} aria-label={cutTooltip} disabled={!canCopy} onClick={() => handleAction('cut')}>
          <ContentCutIcon fontSize="small" />
        </Button>
        <Button title={copyTooltip} aria-label={copyTooltip} disabled={!canCopy} onClick={() => handleAction('copy')}>
          <ContentCopyIcon fontSize="small" />
        </Button>
        <Button title={pasteTooltip} aria-label={pasteTooltip} disabled={!canPaste} onClick={() => handleAction('paste')}>
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
          disabled={!canRemove}
          onClick={() => handleAction('remove')}
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
          {availableTemplates && availableTemplates.length > 0 && ([
            <Divider key="tmpl-divider" />,
            <MenuItem
              key="tmpl-import"
              onClick={() => {
                const first = availableTemplates[0]!;
                handleAction('import-template', { templateId: first.id });
                handleImportExportClose();
              }}
              aria-label={availableTemplates.length === 1 ? (availableTemplates[0]?.label ?? importTemplateFallback) : importTemplateLabel}
            >
              <ListItemIcon>
                <SnippetFolderIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>
                {availableTemplates.length === 1
                  ? (availableTemplates[0]?.label || importTemplateFallback)
                  : importTemplateLabel}
              </ListItemText>
            </MenuItem>
          ])}
        </Menu>

        {/* Settings Button */}
        <IconButton size="small" onClick={handleSettingsClick} aria-label={settingsButtonLabel} title={settingsButtonLabel}>
          <SettingsIcon fontSize="small" />
        </IconButton>
        <Menu
          open={settingsOpen}
          anchorEl={settingsAnchorEl}
          container={portalContainer}
          onClose={handleSettingsClose}
        >
            <MenuItem>
              <Paper sx={{ p: 2, minWidth: 250, zIndex: (theme) => Math.max(theme.zIndex.modal + 2, 2001) }}>
                <Typography variant="subtitle2" gutterBottom>
                  {rowClickTitle}
                </Typography>
                <RadioGroup
                  value={rowClickAction}
                  onChange={(e) => handleRowClickActionChange(e.target.value as 'Select/Navigate' | 'Edit')}
                >
                  <RadioItem icon={<CheckBox fontSize="small" />} label={rowClickLabels.selectNavigate} value={'Select/Navigate'}/>
                  <RadioItem icon={<Edit fontSize="small" />} label={rowClickLabels.edit} value={'Edit'}/>
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
              <ListItemText primary={languageTitle} secondary={languageLabels[language as keyof typeof languageLabels] ?? language} />
            </MenuItem>
        </Menu>

        {/* Theme submenu (rendered outside parent Menu to avoid invalid children) */}
        <Menu
          anchorEl={themeAnchorEl}
          open={themeOpen}
          onClose={closeThemeMenu}
          container={typeof window !== 'undefined' ? document.body : undefined}
        >
          <MenuItem selected={themeMode === 'system'} onClick={() => selectTheme('system')} aria-label={themeLabels.system}>
            <ListItemIcon>
              <SystemThemeIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={themeLabels.system} />
          </MenuItem>
          <MenuItem selected={themeMode === 'light'} onClick={() => selectTheme('light')} aria-label={themeLabels.light}>
            <ListItemIcon>
              <LightModeIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={themeLabels.light} />
          </MenuItem>
          <MenuItem selected={themeMode === 'dark'} onClick={() => selectTheme('dark')} aria-label={themeLabels.dark}>
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
          <MenuItem selected={language === 'system'} onClick={() => selectLanguage('system')} aria-label={languageLabels.system}>
            <ListItemText primary={languageLabels.system} />
          </MenuItem>
          <MenuItem selected={language === 'en'} onClick={() => selectLanguage('en')} aria-label={languageLabels.en}>
            <ListItemText primary={languageLabels.en} />
          </MenuItem>
          <MenuItem selected={language === 'ja'} onClick={() => selectLanguage('ja')} aria-label={languageLabels.ja}>
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
    canRemove = false,
    availableTemplates = [],
  } = props;

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
    return (
      <SearchField
        fullWidth={true}
        searchText={controller?.searchText || ''}
        handleSearchTextChange={controller?.handleSearchTextChange || (() => {
        })}
        handleSearchCommit={controller?.handleSearchCommit}
        placeholder={searchPlaceholder}
        ariaLabel={searchAriaLabel}
      />
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
        canRemove={canRemove}
        availableTemplates={availableTemplates}
        searchPlaceholder={searchPlaceholder}
        searchAriaLabel={searchAriaLabel}
      />
    </Box>
  );
}
