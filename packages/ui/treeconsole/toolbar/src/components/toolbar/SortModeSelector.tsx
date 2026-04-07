import { useCallback, useState } from 'react';
import { IconButton } from '@mui/material';
import { Sort as SortIcon } from '@mui/icons-material';
import { SelectedMenu } from './SelectedMenu.js';
import type { SelectedMenuItem } from './SelectedMenu.js';

export type SortMode =
    | 'none'
    | 'name'
    | 'type'
    | 'lastOpened'
    | 'created'
    | 'modified'
    | 'size'
    | 'tag';

const SORT_MENU_ITEMS: readonly SelectedMenuItem<SortMode>[] = [
    { value: 'none', label: 'None' },
    'divider',
    { value: 'name', label: 'Name' },
    { value: 'type', label: 'Type' },
    { value: 'lastOpened', label: 'Last Opened' },
    { value: 'created', label: 'Created' },
    { value: 'modified', label: 'Modified' },
    { value: 'size', label: 'Size' },
    { value: 'tag', label: 'Tag' },
];

export interface SortModeSelectorProps {
    value: SortMode;
    onChange: (mode: SortMode) => void;
}

export function SortModeSelector({ value, onChange }: SortModeSelectorProps) {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const open = Boolean(anchorEl);

    const handleOpen = useCallback((e: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(e.currentTarget);
    }, []);

    const handleClose = useCallback(() => {
        setAnchorEl(null);
    }, []);

    return (
        <>
            <IconButton
                onClick={handleOpen}
                aria-label="Sort mode"
                size="small"
                sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
            >
                <SortIcon fontSize="small" />
            </IconButton>
            <SelectedMenu
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                items={SORT_MENU_ITEMS}
                selectedValue={value}
                onSelect={onChange}
            />
        </>
    );
}
