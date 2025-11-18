import { ScreenSearchDesktop as ScreenSearchDesktopIcon, Search as SearchIcon } from '@mui/icons-material';
import { ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import type { TreeConsoleSearchMode } from '../../types.js';

export interface SearchModeMenuProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  currentMode: TreeConsoleSearchMode;
  onSelect: (mode: TreeConsoleSearchMode) => void;
  localLabel: string;
  localDescription: string;
  fulltextLabel: string;
  fulltextDescription: string;
}

export function SearchModeMenu({
  anchorEl,
  open,
  onClose,
  currentMode,
  onSelect,
  localLabel,
  localDescription,
  fulltextLabel,
  fulltextDescription,
}: SearchModeMenuProps) {
  return (
    <Menu anchorEl={anchorEl} open={open} onClose={onClose} keepMounted>
      <MenuItem
        selected={currentMode === 'local'}
        onClick={() => onSelect('local')}
        aria-label={localLabel}
      >
        <ListItemIcon>
          <SearchIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary={localLabel} secondary={localDescription} />
      </MenuItem>
      <MenuItem
        selected={currentMode === 'fulltext'}
        onClick={() => onSelect('fulltext')}
        aria-label={fulltextLabel}
      >
        <ListItemIcon>
          <ScreenSearchDesktopIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary={fulltextLabel} secondary={fulltextDescription} />
      </MenuItem>
    </Menu>
  );
}
