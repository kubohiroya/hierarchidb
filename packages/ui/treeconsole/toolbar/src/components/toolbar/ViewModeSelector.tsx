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
    { value: 'icon', label: 'Icon' },
    { value: 'list', label: 'List' },
    { value: 'column', label: 'Column' },
];

export interface ViewModeSelectorProps {
    value: ViewMode;
    onChange: (mode: ViewMode) => void;
    /** Breakpoint width in px below which the compact menu is shown. Default: 600 */
    breakpoint?: number;
    /** Override for testing: force wide (true) or narrow (false) mode. */
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
            <IconButton onClick={handleOpen} aria-label="View mode" size="small">
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
