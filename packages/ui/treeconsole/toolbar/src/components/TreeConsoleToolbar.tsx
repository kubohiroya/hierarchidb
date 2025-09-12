/**
  * TreeConsoleToolbar -
  * eria-cartographTreeConsoleToolbarUI
   */

import { type MouseEvent, useState, useCallback } from 'react';
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
  OpenInNew,
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
  Undo as UndoIcon,
} from '@mui/icons-material';

import type { TreeConsoleToolbarActionParams, TreeConsoleToolbarProps } from '../types';

const SearchTextFieldContainer = styled(Box)(() => ({
  display: 'flex',
  alignItems: 'center',
  // padding: '8px 16px',
  borderBottom: 1,
  borderColor: 'divider',
  backgroundColor: 'background.paper',
  minWidth: '200px',
  width: '250px',
  borderRadius: '24px'
}));

const TreeConsoleToolbarContainer = styled(Box)(() => ({
  display: 'flex',
  alignItems: 'center',
  gap: '20px',
  margin: '0 16px 2px',
  minHeight: '48px',
}));

function SearchField({ searchText, handleSearchTextChange, fullWidth }: { searchText: string; handleSearchTextChange: (_value: string) => void; fullWidth?: boolean}) {
  return (
    <SearchTextFieldContainer>
      <TextField
        fullWidth={fullWidth}
        size="small"
        placeholder="Search......"
        value={searchText}
        onChange={(event: React.ChangeEvent<HTMLInputElement>)=>handleSearchTextChange(event.target.value)}
        InputProps={{
          style:{
            borderRadius: '30px',
          },
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
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
  const portalContainer = typeof window !== 'undefined' ? document.body : undefined;
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
  const handleAction = useCallback((action: string, params?: TreeConsoleToolbarActionParams) => {
    if (onAction) {
      onAction(action, params);
    } else {
      console.log(`Action: ${action}`, params ? params : '- TODO: Connect to controller');
    }
  }, [
    onAction,
  ]);

  const handleRowClickActionChange = useCallback((action: 'Select' | 'Edit' | 'Navigate') => {
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
  }, [
    controller?.handleSearchTextChange,
  ]);

  return (
    <TreeConsoleToolbarContainer>
      {/* Search Input */}
      <SearchField
        searchText={controller?.searchText || ''}
        handleSearchTextChange={handleSearch}
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
        <Menu
          open={settingsOpen}
          anchorEl={settingsAnchorEl}
          container={portalContainer}
          sx={{ zIndex: (theme) => Math.max(theme.zIndex.modal + 1, 2000) }}
        >
          <ClickAwayListener onClickAway={handleSettingsClose}>
            <Paper sx={{ p: 2, minWidth: 250, zIndex: (theme) => Math.max(theme.zIndex.modal + 2, 2001) }}>
              <Typography variant="subtitle2" gutterBottom>
                Row Click Action
              </Typography>
              <RadioGroup
                value={rowClickAction}
                onChange={(e) =>
                  handleRowClickActionChange(e.target.value as 'Select' | 'Edit' | 'Navigate')
                }
              >
                <RadioItem icon={<CheckBox fontSize="small" />} label={'Select'} value={'Select'}/>
                <RadioItem icon={<Edit fontSize="small" />} label={'Edit'} value={'Edit'}/>
                <RadioItem icon={<OpenInNew fontSize="small" />} label={'Navigate'} value={'Navigate'}/>
              </RadioGroup>
            </Paper>
          </ClickAwayListener>
        </Menu>
      </Box>
    </TreeConsoleToolbarContainer>
  );
}

export const TreeConsoleToolbar = (props: TreeConsoleToolbarProps): React.JSX.Element | null => {
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

  if (showSearchOnly) {
    return (
      <SearchField
        fullWidth={true}
        searchText={controller?.searchText || ''}
        handleSearchTextChange={controller?.handleSearchTextChange || (() => {
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
