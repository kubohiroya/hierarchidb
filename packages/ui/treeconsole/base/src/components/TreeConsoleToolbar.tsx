/**
  * TreeConsoleToolbar -
  * eria-cartographTreeConsoleToolbarUI
 * WorkerAPIAdapter
  */

import { type MouseEvent, useState } from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  ClickAwayListener,
  FormControlLabel,
  IconButton,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  Divider,
  Menu,
  MenuItem,
  Paper,
  Popper,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';

//  Icons -
import {
  CheckBox,
  ChevronRight,
  Clear as ClearIcon,
  ContentCopy as ContentCopyIcon,
  ContentPaste as ContentPasteIcon,
  Delete as TrashIcon,
  DeleteForever as DeleteForeverIcon,
  Edit,
  FileCopy as DuplicateIcon,
  FileDownload as FileDownloadIcon,
  FileUpload as FileUploadIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  Redo as RedoIcon,
  RestoreFromTrash as RecyclingIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
  Translate as TranslateIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  SettingsBrightness as SystemThemeIcon,
  SnippetFolder as SnippetFolderIcon,
  Undo as UndoIcon,
} from '@mui/icons-material';

import type { TreeConsoleToolbarProps } from '../types/index';
import type { NodeId } from '@hierarchidb/common-type';

/**
   * SearchOnlyToolbar
  */
function SearchOnlyToolbar({
                             searchText,
                             onSearchTextChange,
                           }: {
  searchText: string;
  onSearchTextChange: (value: string) => void;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 16px',
        borderBottom: 1,
        borderColor: 'divider',
        backgroundColor: 'background.paper',
      }}
    >
      <TextField
        fullWidth
        size="small"
        placeholder="Search...⭐️"
        value={searchText}
        onChange={(e) => onSearchTextChange(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />
    </Box>
  );
}

/**
   * TreeConsoleToolbarContent
  */
function TreeConsoleToolbarContent({
                                     controller,
                                     hasTrashItems,
                                   }: {
  controller: TreeConsoleToolbarProps['controller'];
  hasTrashItems: boolean;
}) {
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
  const themeOpen = Boolean(themeAnchorEl);
  const languageOpen = Boolean(languageAnchorEl);

  const handleSettingsClick = (event: MouseEvent<HTMLElement>) => {
    setSettingsAnchorEl(settingsAnchorEl ? null : event.currentTarget);
  };

  const handleSettingsClose = () => {
    setSettingsAnchorEl(null);
  };

  const handleImportExportClick = (event: MouseEvent<HTMLElement>) => {
    setImportExportAnchorEl(event.currentTarget);
  };

  const handleImportExportClose = () => {
    setImportExportAnchorEl(null);
  };

  const handleTrashClick = (event: MouseEvent<HTMLElement>) => {
    setTrashAnchorEl(event.currentTarget);
  };

  const handleTrashClose = () => {
    setTrashAnchorEl(null);
  };

  // Theme submenu handlers
  const openThemeMenu = (event: MouseEvent<HTMLElement>) => setThemeAnchorEl(event.currentTarget);
  const closeThemeMenu = () => setThemeAnchorEl(null);
  const selectTheme = (mode: 'system' | 'light' | 'dark') => {
    setThemeMode(mode);
    try { localStorage.setItem('app.theme', mode); } catch {}
    try { window.dispatchEvent(new CustomEvent('hierarchidb-theme-change', { detail: { mode } })); } catch {}
    closeThemeMenu();
  };

  // Language submenu handlers
  const openLanguageMenu = (event: MouseEvent<HTMLElement>) => setLanguageAnchorEl(event.currentTarget);
  const closeLanguageMenu = () => setLanguageAnchorEl(null);
  const selectLanguage = (lang: string) => {
    setLanguage(lang);
    try { localStorage.setItem('app.lang', lang); } catch {}
    try { window.dispatchEvent(new CustomEvent('hierarchidb-language-change', { detail: { lang } })); } catch {}
    closeLanguageMenu();
  };

  // Dummy handlers for now - will be connected to controller
  const handleAction = (action: string) => {
    console.log(`Action: ${action} - TODO: Connect to controller`);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        margin: '0 16px 2px',
        minHeight: '48px',
      }}
    >
      {/* Search Input */}
      <Box sx={{ minWidth: 200 }}>
        <TextField
          size="small"
          placeholder="Search..."
          value={controller?.searchText || ''}
          onChange={(e) => {
            try {
              controller?.handleSearchTextChange?.(e.target.value);
            } catch (error) {
              console.warn('Search not implemented:', error);
            }
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Undo/Redo Group */}
      <ButtonGroup size="small">
        <Button
          title="Undo (⌘+Z)"
          disabled={true}
          onClick={() => controller?.undo?.()}
        >
          <UndoIcon fontSize="small" />
        </Button>
        <Button
          title="Redo (⌘+Shift+Z)"
          disabled={true}
          onClick={() => controller?.redo?.()}
        >
          <RedoIcon fontSize="small" />
        </Button>
      </ButtonGroup>

      {/* Copy/Paste Group */}
      <ButtonGroup size="small">
        <Button
          title="Copy (⌘+C)"
          disabled={true}
          onClick={() => {
            // Copy operation is handled in-memory, no API call needed
            console.log('Copy nodes:', controller?.selectedNodes);
          }}
        >
          <ContentCopyIcon fontSize="small" />
        </Button>
        <Button
          title="Paste (⌘+V)"
          disabled={true}
          onClick={() => {
            // Paste operation needs new API implementation
            console.log('Paste nodes - needs implementation');
          }}
        >
          <ContentPasteIcon fontSize="small" />
        </Button>
      </ButtonGroup>

      {/* Duplicate/Remove Group */}
      <ButtonGroup size="small">
        <Button title="Duplicate (⌘+D)" disabled={true}
                onClick={() => controller?.duplicateNodes?.(controller?.selectedNodes || [], (controller?.currentNode?.id || controller?.rootNodeId) as NodeId)}>
          <DuplicateIcon fontSize="small" />
        </Button>
        <Button
          title="Remove (⌘+X)"
          disabled={true}
          onClick={() => controller?.deleteNodes?.(controller?.selectedNodes || [])}
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
          onClick={async () => {
            // TODO: Implement via new WorkerAPI
            // const mutationAPI = await workerAPI.getMutationAPI();
            // await mutationAPI.recoverNodesFromTrash(selectedNodeIds);
            console.log('Restore from trash - needs implementation with new API');
            handleTrashClose();
          }}
        >
          <ListItemIcon>
            <RecyclingIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Restore from Trash</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={async () => {
            // TODO: Implement via new WorkerAPI
            // const mutationAPI = await workerAPI.getMutationAPI();
            // await mutationAPI.removeNodes(trashNodeIds);
            console.log('Empty trash - needs implementation with new API');
            handleTrashClose();
          }}
        >
          <ListItemIcon>
            <DeleteForeverIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Empty Trash</ListItemText>
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
            <SnippetFolderIcon fontSize="small" />
          </Button>
        </ButtonGroup>
        <Menu
          anchorEl={importExportAnchorEl}
          open={importExportOpen}
          onClose={handleImportExportClose}
          container={typeof window !== 'undefined' ? document.body : undefined}
        >
          <MenuItem
            onClick={() => {
              // Import operation needs new API implementation
              console.log('Import data - needs implementation');
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
              // Export operation needs new API implementation
              console.log('Export data - needs implementation');
              handleImportExportClose();
            }}
          >
            <ListItemIcon>
              <FileDownloadIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Export to JSON File</ListItemText>
          </MenuItem>
        </Menu>

        {/* Settings Button */}
        <IconButton size="small" onClick={handleSettingsClick} aria-label="Settings">
          <SettingsIcon fontSize="small" />
        </IconButton>
        <Popper
          open={settingsOpen}
          anchorEl={settingsAnchorEl}
          placement="bottom-end"
          disablePortal={false}
          container={typeof window !== 'undefined' ? document.body : undefined}
          sx={{ zIndex: (theme) => Math.max(theme.zIndex.modal + 100, 2000) }}
        >
          <ClickAwayListener onClickAway={handleSettingsClose}>
            <Paper sx={{ p: 2, minWidth: 280, zIndex: (theme) => Math.max(theme.zIndex.modal + 101, 2001) }}>
              <Typography variant="subtitle2" gutterBottom>
                [DEPRECATED] Row Click Action
              </Typography>
              <RadioGroup
                value={'Select'}
                onChange={(e) => handleAction(`setRowClickAction:${e.target.value}`)}
              >
                <FormControlLabel
                  value="Select"
                  control={<Radio size="small" />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <CheckBox fontSize="small" />
                      <Typography variant="body2">Select</Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="Edit"
                  control={<Radio size="small" />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Edit fontSize="small" />
                      <Typography variant="body2">Edit</Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="Navigate"
                  control={<Radio size="small" />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <ChevronRight fontSize="small" />
                      <Typography variant="body2">Navigate</Typography>
                    </Box>
                  }
                />
              </RadioGroup>

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
            </Paper>
          </ClickAwayListener>
        </Popper>

        {/* Theme submenu */}
        <Menu anchorEl={themeAnchorEl} open={themeOpen} onClose={closeThemeMenu} container={typeof window !== 'undefined' ? document.body : undefined}>
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

        {/* Language submenu */}
        <Menu anchorEl={languageAnchorEl} open={languageOpen} onClose={closeLanguageMenu} container={typeof window !== 'undefined' ? document.body : undefined}>
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
    </Box>
  );
}

/**
  * TreeConsoleToolbar
 * TreeConsoleToolbar
  */
export function TreeConsoleToolbar(props: TreeConsoleToolbarProps): React.JSX.Element | null {
  const {
    hideConsole,
    showSearchOnly,
    isProjectsPage,
    isResourcesPage,
    controller,
    hasTrashItems = false,
  } = props;

  const theme = useTheme();

  // Hide if console is hidden
  if (hideConsole) {
    return null;
  }

  // Search-only mode
  if (showSearchOnly) {
    return (
      <SearchOnlyToolbar
        searchText={controller?.searchText || ''}
        onSearchTextChange={controller?.handleSearchTextChange || (() => {
        })}
      />
    );
  }

  // Main toolbar for Projects/Resources pages
  if (isProjectsPage || isResourcesPage) {
    return (
      <Box
        data-testid="tree-console-toolbar"
        className="tree-console-toolbar"
        aria-label="TreeTypes console toolbar"
        style={{ backgroundColor: theme.palette.background.paper }}
      >
        <TreeConsoleToolbarContent controller={controller} hasTrashItems={hasTrashItems} />
      </Box>
    );
  }

  return null;
}
