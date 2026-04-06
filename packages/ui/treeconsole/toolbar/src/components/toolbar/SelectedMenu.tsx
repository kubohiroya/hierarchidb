import { Check as CheckIcon } from '@mui/icons-material';
import { Divider, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';

export type SelectedMenuItem<T extends string> = { value: T; label: string } | 'divider';

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
                        <ListItemText primary={item.label} />
                    </MenuItem>
                );
            })}
        </Menu>
    );
}
