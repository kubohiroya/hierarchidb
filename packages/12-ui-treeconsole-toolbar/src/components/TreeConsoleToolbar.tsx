/**
 * TreeConsoleToolbar - 元のデザインの忠実な再現
 *
 * 元のeria-cartographのTreeConsoleToolbarのUIを正確に再現したコンポーネント。
 * 見た目は完全に元のデザインに従い、カスタマイズ可能なハンドラーを使用。
 */

import { useState, type MouseEvent } from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  RadioGroup,
  FormControlLabel,
  Radio,
  Popper,
  Paper,
  ClickAwayListener,
  Typography,
  TextField,
  InputAdornment,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';

// Icons - 元のデザインと同じアイコンを使用
import {
  Undo as UndoIcon,
  Redo as RedoIcon,
  ContentCopy as ContentCopyIcon,
  ContentPaste as ContentPasteIcon,
  FileCopy as DuplicateIcon,
  Clear as ClearIcon,
  Delete as TrashIcon,
  RestoreFromTrash as RecyclingIcon,
  Clear as RemoveIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  SnippetFolder as SnippetFolderIcon,
  FileUpload as FileUploadIcon,
  FileDownload as FileDownloadIcon,
  Settings as SettingsIcon,
  Search as SearchIcon,
  CheckBox,
  Edit,
  ChevronRight,
} from '@mui/icons-material';

import type { TreeConsoleToolbarProps, TreeConsoleToolbarActionParams } from '../types';

/**
 * 検索専用ツールバー
 * 元のSearchOnlyToolbarの見た目を再現
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
        placeholder="Search..."
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
 * メインツールバーコンテンツ
 * 元のTreeConsoleToolbarContentの見た目を再現
 */
function TreeConsoleToolbarContent({
  controller,
  hasTrashItems,
  onAction,
  rowClickAction = 'Select',
  onRowClickActionChange,
  canUndo = false,
  canRedo = false,
  canCopy = false,
  canPaste = false,
  canDuplicate = false,
  canRemove = false,
}: {
  controller: TreeConsoleToolbarProps['controller'];
  hasTrashItems: boolean;
  onAction?: TreeConsoleToolbarProps['onAction'];
  rowClickAction?: TreeConsoleToolbarProps['rowClickAction'];
  onRowClickActionChange?: TreeConsoleToolbarProps['onRowClickActionChange'];
  canUndo?: boolean;
  canRedo?: boolean;
  canCopy?: boolean;
  canPaste?: boolean;
  canDuplicate?: boolean;
  canRemove?: boolean;
}) {
  const [settingsAnchorEl, setSettingsAnchorEl] = useState<null | HTMLElement>(null);
  const [importExportAnchorEl, setImportExportAnchorEl] = useState<null | HTMLElement>(null);
  const [trashAnchorEl, setTrashAnchorEl] = useState<null | HTMLElement>(null);

  const settingsOpen = Boolean(settingsAnchorEl);
  const importExportOpen = Boolean(importExportAnchorEl);
  const trashOpen = Boolean(trashAnchorEl);

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

  // Action handler
  const handleAction = (action: string, params?: TreeConsoleToolbarActionParams) => {
    if (onAction) {
      onAction(action, params);
    } else {
      console.log(`Action: ${action}`, params ? params : '- TODO: Connect to controller');
    }
  };

  const handleRowClickActionChange = (action: 'Select' | 'Edit' | 'Navigate') => {
    if (onRowClickActionChange) {
      onRowClickActionChange(action);
    } else {
      handleAction('setRowClickAction', action);
    }
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
        <Button title="Undo (⌘+Z)" disabled={!canUndo} onClick={() => handleAction('undo')}>
          <UndoIcon fontSize="small" />
        </Button>
        <Button title="Redo (⌘+Shift+Z)" disabled={!canRedo} onClick={() => handleAction('redo')}>
          <RedoIcon fontSize="small" />
        </Button>
      </ButtonGroup>

      {/* Copy/Paste Group */}
      <ButtonGroup size="small">
        <Button title="Copy (⌘+C)" disabled={!canCopy} onClick={() => handleAction('copy')}>
          <ContentCopyIcon fontSize="small" />
        </Button>
        <Button title="Paste (⌘+V)" disabled={!canPaste} onClick={() => handleAction('paste')}>
          <ContentPasteIcon fontSize="small" />
        </Button>
      </ButtonGroup>

      {/* Duplicate/Remove Group */}
      <ButtonGroup size="small">
        <Button
          title="Duplicate (⌘+D)"
          disabled={!canDuplicate}
          onClick={() => handleAction('duplicate')}
        >
          <DuplicateIcon fontSize="small" />
        </Button>
        <Button
          title="Remove (⌘+X)"
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
            handleAction('restore');
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
            handleAction('empty');
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
            <SnippetFolderIcon fontSize="small" />
          </Button>
        </ButtonGroup>
        <Menu
          anchorEl={importExportAnchorEl}
          open={importExportOpen}
          onClose={handleImportExportClose}
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
              handleAction('import-template', { templateId: 'population-2023' });
              handleImportExportClose();
            }}
          >
            <ListItemIcon>
              <SnippetFolderIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Import Template: Population Data</ListItemText>
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
        </Menu>

        {/* Settings Button */}
        <IconButton size="small" onClick={handleSettingsClick} aria-label="Settings">
          <SettingsIcon fontSize="small" />
        </IconButton>
        <Popper open={settingsOpen} anchorEl={settingsAnchorEl} placement="bottom-end">
          <ClickAwayListener onClickAway={handleSettingsClose}>
            <Paper sx={{ p: 2, minWidth: 250 }}>
              <Typography variant="subtitle2" gutterBottom>
                Row Click Action
              </Typography>
              <RadioGroup
                value={rowClickAction}
                onChange={(e) =>
                  handleRowClickActionChange(e.target.value as 'Select' | 'Edit' | 'Navigate')
                }
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
            </Paper>
          </ClickAwayListener>
        </Popper>
      </Box>
    </Box>
  );
}

/**
 * TreeConsoleToolbar メインコンポーネント
 * 元のTreeConsoleToolbarの構造を完全に再現
 */
export function TreeConsoleToolbar(props: TreeConsoleToolbarProps): React.JSX.Element | null {
  const {
    hideConsole = false,
    showSearchOnly = false,
    isProjectsPage = false,
    isResourcesPage = false,
    controller,
    hasTrashItems = false,
    onAction,
    rowClickAction = 'Select',
    onRowClickActionChange,
    canUndo = false,
    canRedo = false,
    canCopy = false,
    canPaste = false,
    canDuplicate = false,
    canRemove = false,
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
        onSearchTextChange={controller?.handleSearchTextChange || (() => {})}
      />
    );
  }

  // Main toolbar for Projects/Resources pages
  if (isProjectsPage || isResourcesPage) {
    return (
      <Box
        data-testid="tree-console-toolbar"
        className="tree-console-toolbar"
        aria-label="Tree console toolbar"
        style={{ backgroundColor: theme.palette.background.paper }}
      >
        <TreeConsoleToolbarContent
          controller={controller}
          hasTrashItems={hasTrashItems}
          onAction={onAction}
          rowClickAction={rowClickAction}
          onRowClickActionChange={onRowClickActionChange}
          canUndo={canUndo}
          canRedo={canRedo}
          canCopy={canCopy}
          canPaste={canPaste}
          canDuplicate={canDuplicate}
          canRemove={canRemove}
        />
      </Box>
    );
  }

  return null;
}
