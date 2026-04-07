import { useCallback, useState } from 'react';
import { IconButton, ToggleButton, ToggleButtonGroup, useMediaQuery } from '@mui/material';
import {
    Apps as IconViewIcon,
    FormatListBulleted as ListViewIcon,
    ViewColumn as ColumnViewIcon,
} from '@mui/icons-material';
import { SelectedMenu } from './SelectedMenu.js';
import type { SelectedMenuItem } from './SelectedMenu.js';

export type ViewMode = 'icon' | 'list' | 'column';

const VIEW_MODE_ICONS: Record<ViewMode, React.ReactElement> = {
    icon: <IconViewIcon fontSize="small" />,
    list: <ListViewIcon fontSize="small" />,
    column: <ColumnViewIcon fontSize="small" />,
};

const VIEW_MENU_ITEMS: readonly SelectedMenuItem<ViewMode>[] = [
    { value: 'icon', label: 'Icon', icon: <IconViewIcon fontSize="small" /> },
    { value: 'list', label: 'List', icon: <ListViewIcon fontSize="small" /> },
    { value: 'column', label: 'Column', icon: <ColumnViewIcon fontSize="small" /> },
];

export interface ViewModeSelectorProps {
    value: ViewMode;
    onChange: (mode: ViewMode) => void;
    breakpoint?: number;
    forceWide?: boolean;
}

export function ViewModeSelector({ value, onChange, breakpoint = 600, forceWide }: ViewModeSelectorProps) {
    const mediaWide = useMediaQuery(`(min-width:${breakpoint}px)`);
    const isWide = forceWide ?? mediaWide;

    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const open = Boolean(anchorEl);

    const handleOpen = useCallback((e: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(e.currentTarget);
    }, []);

    const handleClose = useCallback(() => {
        setAnchorEl(null);
    }, []);

    const handleToggle = useCallback(
        (_: React.MouseEvent<HTMLElement>, newValue: ViewMode | null) => {
            if (newValue !== null) {
                onChange(newValue);
            }
        },
        [onChange],
    );

    if (isWide) {
        return (
            <ToggleButtonGroup
                value={value}
                exclusive
                onChange={handleToggle}
                size="small"
                aria-label="View mode"
                sx={{
                    '& .MuiToggleButton-root': {
                        border: '1px solid',
                        borderColor: 'divider',
                    },
                }}
            >
                <ToggleButton value="icon" aria-label="Icon view">
                    <IconViewIcon fontSize="small" />
                </ToggleButton>
                <ToggleButton value="list" aria-label="List view">
                    <ListViewIcon fontSize="small" />
                </ToggleButton>
                <ToggleButton value="column" aria-label="Column view">
                    <ColumnViewIcon fontSize="small" />
                </ToggleButton>
            </ToggleButtonGroup>
        );
    }

    return (
        <>
            <IconButton
                onClick={handleOpen}
                aria-label="View mode"
                size="small"
                sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
            >
                {VIEW_MODE_ICONS[value]}
            </IconButton>
            <SelectedMenu
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                items={VIEW_MENU_ITEMS}
                selectedValue={value}
                onSelect={onChange}
            />
        </>
    );
}
