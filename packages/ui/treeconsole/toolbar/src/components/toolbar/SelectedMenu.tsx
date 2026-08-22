import { Check as CheckIcon } from '@mui/icons-material';
import { Box, Divider, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import type { ReactElement } from 'react';

export type SelectedMenuItem<T extends string> =
  | { value: T; label: string; icon?: ReactElement }
  | 'divider';

export interface SelectedMenuProps<T extends string> {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  items: readonly SelectedMenuItem<T>[];
  selectedValue: T;
  onSelect: (value: T) => void;
}

export function SelectedMenu<T extends string>({
  anchorEl,
  open,
  onClose,
  items,
  selectedValue,
  onSelect,
}: SelectedMenuProps<T>) {
  return (
    <Menu anchorEl={anchorEl} open={open} onClose={onClose}>
      {items.map((item, index) => {
        if (item === 'divider') {
          return <Divider key={`divider-${index}`} />;
        }
        const isSelected = item.value === selectedValue;
        return (
          <MenuItem
            key={item.value}
            onClick={() => {
              onSelect(item.value);
              onClose();
            }}
            aria-label={item.label}
            selected={isSelected}
          >
            <ListItemIcon sx={{ visibility: isSelected ? 'visible' : 'hidden' }}>
              <CheckIcon fontSize="small" />
            </ListItemIcon>
            {item.icon && (
              <Box component="span" sx={{ display: 'inline-flex', mr: 1 }}>
                {item.icon}
              </Box>
            )}
            <ListItemText primary={item.label} />
          </MenuItem>
        );
      })}
    </Menu>
  );
}
