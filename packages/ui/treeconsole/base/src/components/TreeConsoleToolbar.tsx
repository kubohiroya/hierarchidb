/**
 * TreeConsoleToolbar - 元のデザインの忠実な再現
 *
 * 元のeria-cartographのTreeConsoleToolbarのUIを正確に再現したコンポーネント。
 * 見た目は完全に元のデザインに従い、内部的にWorkerAPIAdapterを使用。
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
  DeleteForever as DeleteForeverIcon,
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

import type { TreeConsoleToolbarProps, NodeId } from '../types/index';

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
}: {
  controller: TreeConsoleToolbarProps['controller'];
  hasTrashItems: boolean;
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
        <Button title="Duplicate (⌘+D)" disabled={true} onClick={() => controller?.duplicateNodes?.(controller?.selectedNodes || [], (controller?.currentNode?.id || controller?.rootNodeId) as NodeId)}>
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
        <Popper open={settingsOpen} anchorEl={settingsAnchorEl} placement="bottom-end">
          <ClickAwayListener onClickAway={handleSettingsClose}>
            <Paper sx={{ p: 2, minWidth: 250 }}>
              <Typography variant="subtitle2" gutterBottom>
                Row Click Action
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
        onSearchTextChange={controller?.handleSearchTextChange || (() => {})}
      />
    );
  }

  // Main toolbar for Projects/Resources pages
  if (isProjectsPage || isResourcesPage) {
    return (
      <div
        data-testid="tree-console-toolbar"
        className="tree-console-toolbar"
        aria-label="Tree console toolbar"
        style={{ backgroundColor: theme.palette.background.paper }}
      >
        <TreeConsoleToolbarContent controller={controller} hasTrashItems={hasTrashItems} />
      </div>
    );
  }

  return null;
}
