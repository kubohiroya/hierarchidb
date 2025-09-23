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
  // padding: '8px 16px',
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

function SearchField({ searchText, handleSearchTextChange, handleSearchCommit, fullWidth }: { searchText: string; handleSearchTextChange: (_value: string) => void; handleSearchCommit?: () => void; fullWidth?: boolean}) {
  return (
    <SearchTextFieldContainer>
      <TextField
        fullWidth={fullWidth}
        size="small"
        placeholder="Search......"
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
              'aria-label': 'Tree search',
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
}) {
  const portalContainer = typeof window !== 'undefined' ? document.body : undefined;
  const [settingsAnchorEl, setSettingsAnchorEl] = useState<null | HTMLElement>(null);
  const [importExportAnchorEl, setImportExportAnchorEl] = useState<null | HTMLElement>(null);
  const [trashAnchorEl, setTrashAnchorEl] = useState<null | HTMLElement>(null);
  const [themeAnchorEl, setThemeAnchorEl] = useState<null | HTMLElement>(null);
  const [languageAnchorEl, setLanguageAnchorEl] = useState<null | HTMLElement>(null);
  const [themeMode, setThemeMode] = useState<'system' | 'light' | 'dark'>(() =>
    (typeof localStorage !== 'undefined' && (localStorage.getItem('app.theme') as 'system' | 'light' | 'dark')) || 'system',
  );
  const [language, setLanguage] = useState<string>(
    () => (typeof localStorage !== 'undefined' && localStorage.getItem('app.lang')) || 'system',
  );

  const settingsOpen = Boolean(settingsAnchorEl);
  const importExportOpen = Boolean(importExportAnchorEl);
  const trashOpen = Boolean(trashAnchorEl);

  const handleSettingsClick = (event: MouseEvent<HTMLElement>) => {
    // Close other menus before opening Settings
    setImportExportAnchorEl(null);
    setTrashAnchorEl(null);
    setThemeAnchorEl(null);
    setLanguageAnchorEl(null);
    setSettingsAnchorEl(event.currentTarget);
  };

  const handleSettingsClose = () => {
    setSettingsAnchorEl(null);
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
  }, [handleAction, onRowClickActionChange]);


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
  };

  return (
    <TreeConsoleToolbarContainer>
      {/* Search Input */}
      <SearchField
        searchText={controller?.searchText || ''}
        handleSearchTextChange={handleSearch}
        handleSearchCommit={controller?.handleSearchCommit}
      />

      {/* Undo/Redo Group */}
      <ButtonGroup size="small">
        <Button title="Undo (⌘+Z)" disabled={!canUndo} onClick={() => handleAction('undo')}>
          <UndoIcon fontSize="small" />
        </Button>
        <Button title="Redo (⌘+Shift+Z)" disabled={!canRedo} onClick={() => handleAction('redo')}>
          <RedoIcon fontSize="small" />
        </Button>
      </ButtonGroup>

      {/* Cut/Copy/Paste Group */}
      <ButtonGroup size="small">
        <Button title="Cut (⌘+X)" disabled={!canCopy} onClick={() => handleAction('cut')}>
          <ContentCutIcon fontSize="small" />
        </Button>
        <Button title="Copy (⌘+C)" disabled={!canCopy} onClick={() => handleAction('copy')}>
          <ContentCopyIcon fontSize="small" />
        </Button>
        <Button title="Paste (⌘+V)" disabled={!canPaste} onClick={() => handleAction('paste')}>
          <ContentPasteIcon fontSize="small" />
        </Button>
      </ButtonGroup>

      {/* Duplicate/Move to Trash Group */}
      <ButtonGroup size="small">
        <Button
          title="Duplicate (⌘+D)"
          disabled={!canDuplicate}
          onClick={() => handleAction('duplicate')}
        >
          <DuplicateIcon fontSize="small" />
        </Button>
        <Button
          title="Move to Trash (⌘+X)"
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
        >
          <ListItemIcon>
            <RecyclingIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Restore from Trash</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleAction('empty', trashNodeId ? { trashNodeId } : undefined);
            handleTrashClose();
          }}
        >
          <ListItemIcon>
            <RemoveIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Remove All from Trash</ListItemText>
        </MenuItem>
      </Menu>

      {/* Import/Export Menu - positioned at far right */}
      <Box sx={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
        <ButtonGroup size="small">
          <Button
            endIcon={<KeyboardArrowDownIcon />}
            onClick={handleImportExportClick}
            color="primary"
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
          >
            <ListItemIcon>
              <FileUploadIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Import from JSON File</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => {
              handleAction('export');
              handleImportExportClose();
            }}
          >
            <ListItemIcon>
              <FileDownloadIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Export to JSON File</ListItemText>
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
            >
              <ListItemIcon>
                <SnippetFolderIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>
                {availableTemplates.length === 1
                  ? (availableTemplates[0]?.label || 'Import Template')
                  : 'Import Template'}
              </ListItemText>
            </MenuItem>
          ])}
        </Menu>

        {/* Settings Button */}
        <IconButton size="small" onClick={handleSettingsClick} aria-label="Settings">
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
                  Row Click Action
                </Typography>
                <RadioGroup
                  value={rowClickAction}
                  onChange={(e) => handleRowClickActionChange(e.target.value as 'Select/Navigate' | 'Edit')}
                >
                  <RadioItem icon={<CheckBox fontSize="small" />} label={'Select/Navigate'} value={'Select/Navigate'}/>
                  <RadioItem icon={<Edit fontSize="small" />} label={'Edit'} value={'Edit'}/>
                </RadioGroup>
              </Paper>
            </MenuItem>

            <Divider sx={{ my: 1 }} />

            {/* Theme selection opener */}
            <MenuItem onClick={openThemeMenu} aria-haspopup="menu">
              <ListItemIcon>
                {themeMode === 'dark' ? (
                  <DarkModeIcon fontSize="small" />
                ) : themeMode === 'light' ? (
                  <LightModeIcon fontSize="small" />
                ) : (
                  <SystemThemeIcon fontSize="small" />
                )}
              </ListItemIcon>
              <ListItemText primary="Theme" secondary={themeMode} />
            </MenuItem>

            {/* Language selection opener */}
            <MenuItem onClick={openLanguageMenu} aria-haspopup="menu">
              <ListItemIcon>
                <TranslateIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Language" secondary={language} />
            </MenuItem>
        </Menu>

        {/* Theme submenu (rendered outside parent Menu to avoid invalid children) */}
        <Menu
          anchorEl={themeAnchorEl}
          open={themeOpen}
          onClose={closeThemeMenu}
          container={typeof window !== 'undefined' ? document.body : undefined}
        >
          <MenuItem selected={themeMode === 'system'} onClick={() => selectTheme('system')}>
            <ListItemIcon>
              <SystemThemeIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="System" />
          </MenuItem>
          <MenuItem selected={themeMode === 'light'} onClick={() => selectTheme('light')}>
            <ListItemIcon>
              <LightModeIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Light" />
          </MenuItem>
          <MenuItem selected={themeMode === 'dark'} onClick={() => selectTheme('dark')}>
            <ListItemIcon>
              <DarkModeIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Dark" />
          </MenuItem>
        </Menu>

        {/* Language submenu (rendered outside parent Menu) */}
        <Menu
          anchorEl={languageAnchorEl}
          open={languageOpen}
          onClose={closeLanguageMenu}
          container={typeof window !== 'undefined' ? document.body : undefined}
        >
          <MenuItem selected={language === 'system'} onClick={() => selectLanguage('system')}>
            <ListItemText primary="System Default" />
          </MenuItem>
          <MenuItem selected={language === 'en'} onClick={() => selectLanguage('en')}>
            <ListItemText primary="English" />
          </MenuItem>
          <MenuItem selected={language === 'ja'} onClick={() => selectLanguage('ja')}>
            <ListItemText primary="日本語" />
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
      />
    );
  }

  // Render full toolbar for any page unless explicitly hidden
  return (
    <Box
      data-testid="tree-console-toolbar"
      className="tree-console-toolbar"
      aria-label="TreeTypes console toolbar"
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
      />
    </Box>
  );
}
